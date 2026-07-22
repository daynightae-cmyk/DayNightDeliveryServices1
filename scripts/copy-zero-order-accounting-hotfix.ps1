param(
    [string]$RepoPath = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

$ResolvedRepo = (Resolve-Path -LiteralPath $RepoPath).Path
$MigrationPath = Join-Path $ResolvedRepo "supabase\migrations\20260722043000_zero_order_deferred_merchant_accounting_hotfix.sql"

if (-not (Test-Path -LiteralPath $MigrationPath)) {
    throw "Migration file not found: $MigrationPath`nRun git pull origin main, then execute this script again."
}

$Sql = Get-Content -LiteralPath $MigrationPath -Raw -Encoding UTF8
if ([string]::IsNullOrWhiteSpace($Sql)) {
    throw "Migration file is empty."
}

Set-Clipboard -Value $Sql
Start-Process "https://supabase.com/dashboard/project/ngdwybpgacauorygoedi/sql/new"

Write-Host "" 
Write-Host "====================================================" -ForegroundColor Green
Write-Host " DAY NIGHT ZERO-ORDER ACCOUNTING HOTFIX COPIED" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host "" 
Write-Host "1. Supabase SQL Editor is opening." -ForegroundColor Cyan
Write-Host "2. Click inside the empty editor and press Ctrl+V." -ForegroundColor Cyan
Write-Host "3. Press Run once." -ForegroundColor Cyan
Write-Host "4. Then run: select public.zero_order_accounting_hotfix_health();" -ForegroundColor Yellow
Write-Host "5. The result must contain ok=true and default_merchant_delivery_fee=30." -ForegroundColor Yellow
Write-Host "" 
Write-Host "No merchant, order, expense, driver, or fake row is created by this script." -ForegroundColor DarkGray
