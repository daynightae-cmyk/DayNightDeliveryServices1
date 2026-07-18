[CmdletBinding()]
param([switch]$NoLaunch)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$LiveUrl = "https://daynightae.com/?dn_live=" + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$InstallRoot = Join-Path $env:LOCALAPPDATA "DAY-NIGHT-LIVE"
$ProfileRoot = Join-Path $InstallRoot "BrowserProfile"
$MarkerPath = Join-Path $InstallRoot "installed-version.txt"

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Restart-Elevated {
    $hostExe = (Get-Process -Id $PID).Path
    $arguments = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ('"{0}"' -f $PSCommandPath))
    if ($NoLaunch) { $arguments += "-NoLaunch" }
    Start-Process -FilePath $hostExe -Verb RunAs -ArgumentList ($arguments -join " ")
    exit
}

function Find-Browser {
    $candidates = @(
        (Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe"),
        (Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
        (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
        (Join-Path $env:LOCALAPPDATA "Microsoft\Edge\Application\msedge.exe"),
        (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe")
    )

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            return $candidate
        }
    }

    foreach ($name in @("msedge.exe", "chrome.exe")) {
        $command = Get-Command $name -ErrorAction SilentlyContinue
        if ($command -and $command.Source) { return $command.Source }
    }

    throw "Microsoft Edge or Google Chrome was not found."
}

function Stop-StaleDayNightWindows {
    Get-Process -ErrorAction SilentlyContinue | Where-Object {
        $_.ProcessName -match "(?i)^DAY[ -]?NIGHT" -or
        $_.MainWindowTitle -match "(?i)Admin\s*\|\s*DAY NIGHT|DAY NIGHT Admin"
    } | ForEach-Object {
        try {
            if ($_.MainWindowHandle -ne 0) {
                $null = $_.CloseMainWindow()
                Start-Sleep -Milliseconds 600
            }
            if (-not $_.HasExited) {
                Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
            }
        } catch {
            # Continue. The live shortcut can still be created.
        }
    }
}

function Save-ExistingShortcut {
    param([Parameter(Mandatory=$true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return }

    $backupRoot = Join-Path $InstallRoot "PreviousShortcuts"
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
    $safeName = ([IO.Path]::GetFileNameWithoutExtension($Path) + "-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".lnk")
    Copy-Item -LiteralPath $Path -Destination (Join-Path $backupRoot $safeName) -Force
}

function New-LiveShortcut {
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [Parameter(Mandatory=$true)][string]$Browser
    )

    $directory = Split-Path -Parent $Path
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    Save-ExistingShortcut -Path $Path

    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($Path)
    $shortcut.TargetPath = $Browser
    $shortcut.Arguments = "--app=`"$LiveUrl`" --start-maximized --user-data-dir=`"$ProfileRoot`" --no-first-run --disable-features=msEdgeSidebarV2 --disk-cache-size=1"
    $shortcut.WorkingDirectory = $InstallRoot
    $shortcut.IconLocation = "$Browser,0"
    $shortcut.Description = "DAY NIGHT live platform - always loads the latest production version"
    $shortcut.Save()
}

if (-not (Test-IsAdministrator)) {
    Restart-Elevated
}

Write-Host ""
Write-Host "DAY NIGHT LIVE REMOTE FIX" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan

New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
New-Item -ItemType Directory -Path $ProfileRoot -Force | Out-Null

$browser = Find-Browser
Write-Host ("Browser: " + $browser) -ForegroundColor Green

Stop-StaleDayNightWindows

$desktopCurrent = [Environment]::GetFolderPath("Desktop")
$desktopPublic = [Environment]::GetFolderPath("CommonDesktopDirectory")
$startCurrent = Join-Path ([Environment]::GetFolderPath("StartMenu")) "Programs"
$startCommon = Join-Path ([Environment]::GetFolderPath("CommonStartMenu")) "Programs"

$shortcutPaths = @(
    (Join-Path $desktopCurrent "DAY NIGHT.lnk"),
    (Join-Path $desktopCurrent "DAY NIGHT Admin.lnk"),
    (Join-Path $desktopPublic "DAY NIGHT.lnk"),
    (Join-Path $desktopPublic "DAY NIGHT Admin.lnk"),
    (Join-Path $startCurrent "DAY NIGHT.lnk"),
    (Join-Path $startCurrent "DAY NIGHT Admin.lnk"),
    (Join-Path $startCommon "DAY NIGHT.lnk"),
    (Join-Path $startCommon "DAY NIGHT Admin.lnk")
) | Select-Object -Unique

foreach ($shortcutPath in $shortcutPaths) {
    try {
        New-LiveShortcut -Path $shortcutPath -Browser $browser
        Write-Host ("Live shortcut: " + $shortcutPath) -ForegroundColor Green
    } catch {
        Write-Warning ("Shortcut skipped: " + $shortcutPath + " | " + $_.Exception.Message)
    }
}

@"
DAY NIGHT LIVE REMOTE FIX
Installed: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Portal: https://daynightae.com/
Browser: $browser
Mode: live Vercel production shell
"@ | Set-Content -LiteralPath $MarkerPath -Encoding UTF8

foreach ($folder in @([Environment]::GetFolderPath("Startup"), [Environment]::GetFolderPath("CommonStartup"))) {
    foreach ($name in @("DAY NIGHT Admin.lnk", "DAY-NIGHT Admin.lnk")) {
        $startupLink = Join-Path $folder $name
        if (Test-Path -LiteralPath $startupLink -PathType Leaf) {
            Move-Item -LiteralPath $startupLink -Destination ($startupLink + ".disabled") -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host ""
Write-Host "DONE: DAY NIGHT shortcuts now open the live production platform." -ForegroundColor Green
Write-Host "All Vercel web changes will appear automatically." -ForegroundColor Green

if (-not $NoLaunch) {
    Start-Process -FilePath $browser -ArgumentList @(
        "--app=$LiveUrl",
        "--start-maximized",
        "--user-data-dir=$ProfileRoot",
        "--no-first-run",
        "--disable-features=msEdgeSidebarV2",
        "--disk-cache-size=1"
    )
}

Start-Sleep -Seconds 2
