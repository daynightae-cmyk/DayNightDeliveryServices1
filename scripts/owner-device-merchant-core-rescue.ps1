param(
  [string]$RepoPath = ""
)

$ErrorActionPreference = "Stop"
Set-ExecutionPolicy -Scope Process Bypass -Force

if ([string]::IsNullOrWhiteSpace($RepoPath)) {
  $Candidate = Get-ChildItem -Path ([Environment]::GetFolderPath("Desktop")) -Directory -Filter "DAY-NIGHT-OWNER-AUDIT-*" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    ForEach-Object { Join-Path $_.FullName "DayNightDeliveryServices1" } |
    Where-Object { Test-Path -LiteralPath $_ } |
    Select-Object -First 1

  if ($Candidate) {
    $RepoPath = $Candidate
  } else {
    $RepoPath = Join-Path ([Environment]::GetFolderPath("Desktop")) "DayNightDeliveryServices1"
  }
}

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][scriptblock]$Command
  )

  Write-Host ""
  Write-Host "RUNNING: $Name" -ForegroundColor Cyan

  $Previous = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    & $Command
    $ExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $Previous
  }

  if ($ExitCode -ne 0) {
    throw "$Name failed with exit code $ExitCode"
  }

  Write-Host "PASSED: $Name" -ForegroundColor Green
}

function Remove-DirectoryRobust {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  Write-Host "Removing stale dependency directory: $Path" -ForegroundColor Yellow

  $Previous = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    & cmd.exe /d /c "rmdir /s /q `"$Path`""
    $ExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $Previous
  }

  if ($ExitCode -ne 0 -and (Test-Path -LiteralPath $Path)) {
    Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
  }
}

function Install-WorkspaceDependencies {
  param([Parameter(Mandatory = $true)][string]$Root)

  $IsWindowsHost = $env:OS -eq "Windows_NT"
  if (-not $IsWindowsHost) {
    Invoke-Checked -Name "Install workspace dependencies" -Command {
      pnpm install --frozen-lockfile
    }
    return
  }

  $WorkspaceFile = Join-Path $Root "pnpm-workspace.yaml"
  $LockFile = Join-Path $Root "pnpm-lock.yaml"
  $PackageFile = Join-Path $Root "package.json"
  $NodeModules = Join-Path $Root "node_modules"

  if (-not (Test-Path -LiteralPath $WorkspaceFile)) {
    throw "pnpm-workspace.yaml is missing. Resolved repository root: $Root"
  }

  if (-not (Test-Path -LiteralPath $LockFile)) {
    throw "pnpm-lock.yaml is missing. Resolved repository root: $Root"
  }

  if (-not (Test-Path -LiteralPath $PackageFile)) {
    throw "package.json is missing. Resolved repository root: $Root"
  }

  $WorkspaceOriginal = Get-Content -LiteralPath $WorkspaceFile -Raw
  $LockOriginal = Get-Content -LiteralPath $LockFile -Raw
  $PackageOriginal = Get-Content -LiteralPath $PackageFile -Raw

  try {
    $ExcludedKeys = @(
      '"esbuild>@esbuild/win32-x64":',
      '"lightningcss>lightningcss-win32-x64-msvc":',
      '"@tailwindcss/oxide>@tailwindcss/oxide-win32-x64-msvc":',
      '"rollup>@rollup/rollup-win32-x64-msvc":'
    )

    $WorkspaceLines = [System.IO.File]::ReadAllLines($WorkspaceFile)
    $WorkspaceWindowsLines = foreach ($Line in $WorkspaceLines) {
      $Trimmed = $Line.TrimStart()
      $ShouldRemove = $false

      foreach ($Key in $ExcludedKeys) {
        if ($Trimmed.StartsWith($Key, [System.StringComparison]::Ordinal)) {
          $ShouldRemove = $true
          break
        }
      }

      if (-not $ShouldRemove) {
        $Line
      }
    }

    [System.IO.File]::WriteAllLines(
      $WorkspaceFile,
      [string[]]$WorkspaceWindowsLines,
      [System.Text.UTF8Encoding]::new($false)
    )

    Invoke-Checked -Name "Validate temporary Windows pnpm workspace" -Command {
      pnpm config get minimumReleaseAge --location project | Out-Null
    }

    Remove-DirectoryRobust -Path $NodeModules

    Invoke-Checked -Name "Install Windows-native workspace dependencies" -Command {
      pnpm install --no-frozen-lockfile --force
    }

    $OxideBinary = Get-ChildItem -LiteralPath $NodeModules -Recurse -File -Filter "tailwindcss-oxide.win32-x64-msvc.node" -ErrorAction SilentlyContinue |
      Select-Object -First 1

    if (-not $OxideBinary) {
      Write-Host "Tailwind Oxide was not pulled transitively; installing the exact Windows binding..." -ForegroundColor Yellow
      Invoke-Checked -Name "Install exact Tailwind Oxide Windows binding" -Command {
        pnpm add --workspace-root --save-optional "@tailwindcss/oxide-win32-x64-msvc@4.3.0" --no-frozen-lockfile
      }

      $OxideBinary = Get-ChildItem -LiteralPath $NodeModules -Recurse -File -Filter "tailwindcss-oxide.win32-x64-msvc.node" -ErrorAction SilentlyContinue |
        Select-Object -First 1
    }

    if (-not $OxideBinary) {
      throw "Tailwind Oxide Windows native binding was not installed."
    }

    Write-Host "PASSED: Tailwind Oxide Windows native binding is installed" -ForegroundColor Green
    Write-Host "Native binding: $($OxideBinary.FullName)" -ForegroundColor DarkGreen
  } finally {
    [System.IO.File]::WriteAllText(
      $WorkspaceFile,
      $WorkspaceOriginal,
      [System.Text.UTF8Encoding]::new($false)
    )

    [System.IO.File]::WriteAllText(
      $LockFile,
      $LockOriginal,
      [System.Text.UTF8Encoding]::new($false)
    )

    [System.IO.File]::WriteAllText(
      $PackageFile,
      $PackageOriginal,
      [System.Text.UTF8Encoding]::new($false)
    )
  }
}

if (-not (Test-Path -LiteralPath $RepoPath)) {
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git is not installed. Run the owner audit installer first."
  }

  Invoke-Checked -Name "Clone DAY NIGHT repository" -Command {
    git clone "https://github.com/daynightae-cmyk/DayNightDeliveryServices1.git" $RepoPath
  }
}

$RepoPath = (Resolve-Path -LiteralPath $RepoPath).Path
Set-Location -LiteralPath $RepoPath

Invoke-Checked -Name "Update main" -Command {
  git checkout main
  git pull --ff-only origin main
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  Invoke-Checked -Name "Install pnpm" -Command {
    npm install --global pnpm@10.34.4
  }
}

Install-WorkspaceDependencies -Root $RepoPath

Invoke-Checked -Name "Validate production web application" -Command {
  pnpm run web:validate
}

$MigrationOne = Join-Path $RepoPath "supabase\migrations\20260722013000_merchant_multi_account_link_and_core_repair.sql"
$MigrationTwo = Join-Path $RepoPath "supabase\migrations\20260722013100_merchant_link_grants_and_health.sql"
$MigrationThree = Join-Path $RepoPath "supabase\migrations\20260722023000_restore_merchant_create_order_rpc.sql"

foreach ($Migration in @($MigrationOne, $MigrationTwo, $MigrationThree)) {
  if (-not (Test-Path -LiteralPath $Migration)) {
    throw "Required merchant production migration is missing: $Migration"
  }
}

$Sql = @(
  Get-Content -LiteralPath $MigrationOne -Raw
  "`r`n"
  Get-Content -LiteralPath $MigrationTwo -Raw
  "`r`n"
  Get-Content -LiteralPath $MigrationThree -Raw
) -join "`r`n"

$Sql | Set-Clipboard

Write-Host ""
Write-Host "====================================================" -ForegroundColor Yellow
Write-Host " MERCHANT DATABASE REPAIR COPIED TO CLIPBOARD" -ForegroundColor Yellow
Write-Host "====================================================" -ForegroundColor Yellow
Write-Host "1. Supabase SQL Editor will open." -ForegroundColor White
Write-Host "2. Press Ctrl+V." -ForegroundColor White
Write-Host "3. Press Run once." -ForegroundColor White
Write-Host "4. Every verification row must show true." -ForegroundColor White
Write-Host "5. Refresh /merchant with Ctrl+Shift+R." -ForegroundColor White

Start-Process "https://supabase.com/dashboard/project/ngdwybpgacauorygoedi/sql/new"
Start-Sleep -Seconds 2
Start-Process "https://daynightae.com/merchant"
Start-Process "https://daynightae.com/admin"
Start-Process "https://daynightae.com/driver"

Write-Host ""
Write-Host "No orders, expenses, statements, COD rows, or fake driver locations were created." -ForegroundColor Green
Write-Host "The repair links approved real accounts and restores the real merchant -> admin -> driver chain." -ForegroundColor Green
