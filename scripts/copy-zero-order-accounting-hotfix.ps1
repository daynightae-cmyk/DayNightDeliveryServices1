param(
    [string]$RepoPath = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

$ResolvedRepo = (Resolve-Path -LiteralPath $RepoPath).Path
$MigrationFiles = @(
    "supabase\migrations\20260722043000_zero_order_deferred_merchant_accounting_hotfix.sql",
    "supabase\migrations\20260722044000_zero_order_delivery_mode_correction.sql"
)

$SqlParts = foreach ($RelativePath in $MigrationFiles) {
    $FullPath = Join-Path $ResolvedRepo $RelativePath
    if (-not (Test-Path -LiteralPath $FullPath)) {
        throw "Migration file not found: $FullPath`nRun git pull origin main, then execute this script again."
    }

    $Part = Get-Content -LiteralPath $FullPath -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($Part)) {
        throw "Migration file is empty: $FullPath"
    }
    $Part
}

$Sql = $SqlParts -join "`r`n`r`n-- ============================================================`r`n`r`n"
Set-Clipboard -Value $Sql
Start-Process "https://supabase.com/dashboard/project/ngdwybpgacauorygoedi/sql/new"

Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host " DAY NIGHT ZERO-ORDER ACCOUNTING HOTFIX COPIED" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "1. Supabase SQL Editor is opening." -ForegroundColor Cyan
Write-Host "2. Click inside the empty editor and press Ctrl+V." -ForegroundColor Cyan
Write-Host "3. Press Run once. Both required migrations are included." -ForegroundColor Cyan
Write-Host "4. Then run: select public.zero_order_accounting_hotfix_health();" -ForegroundColor Yellow
Write-Host "5. The result must contain ok=true and default_merchant_delivery_fee=30." -ForegroundColor Yellow
Write-Host ""
Write-Host "No merchant, order, expense, driver, or fake row is created by this script." -ForegroundColor DarkGray
