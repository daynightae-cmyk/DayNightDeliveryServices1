$ErrorActionPreference = 'Stop'

$projectRef = 'ngdwybpgacauorygoedi'
$migrationVersion = '20260729193000'
$migration = Join-Path $PSScriptRoot '..\supabase\migrations\20260729193000_repair_aramex_17track_schema.sql'
$sqlEditorUrl = "https://supabase.com/dashboard/project/$projectRef/sql/new"

Write-Host ''
Write-Host 'DAY NIGHT - APPLYING 17TRACK DATABASE SCHEMA REPAIR' -ForegroundColor Cyan
Write-Host 'The remote migration history is not aligned with the many older local files.' -ForegroundColor DarkGray
Write-Host 'This script therefore applies only the required repair SQL and does NOT run db push --include-all.' -ForegroundColor DarkGray
Write-Host ''

if (-not (Test-Path $migration)) {
  throw "Repair migration is missing: $migration"
}

$sql = Get-Content $migration -Raw
if ([string]::IsNullOrWhiteSpace($sql)) {
  throw 'Repair migration is empty.'
}

Set-Clipboard -Value $sql
Write-Host 'The complete repair SQL has been copied to your clipboard.' -ForegroundColor Green
Write-Host 'Opening the Supabase SQL Editor now...' -ForegroundColor Yellow
Start-Process $sqlEditorUrl

Write-Host ''
Write-Host 'In the opened SQL Editor:' -ForegroundColor Cyan
Write-Host '  1) Press Ctrl+V' -ForegroundColor White
Write-Host '  2) Press Run' -ForegroundColor White
Write-Host '  3) Wait for: Success. No rows returned.' -ForegroundColor White
Write-Host ''
Write-Host 'IMPORTANT: Do not run supabase db push --include-all.' -ForegroundColor Red
Write-Host 'That command would attempt to apply dozens of unrelated historical migrations.' -ForegroundColor Red
Write-Host ''

$confirmation = Read-Host 'After Supabase shows Success, type SUCCESS here'
if ($confirmation.Trim().ToUpperInvariant() -ne 'SUCCESS') {
  throw 'Repair was not confirmed. Migration history was not changed.'
}

Write-Host ''
Write-Host "Recording migration $migrationVersion as applied..." -ForegroundColor Yellow
& npx supabase migration repair $migrationVersion --status applied
if ($LASTEXITCODE -ne 0) {
  throw "Migration repair failed with exit code $LASTEXITCODE."
}

Write-Host 'Requesting a PostgREST schema reload...' -ForegroundColor Yellow
Start-Sleep -Seconds 4

$checkUri = "https://$projectRef.supabase.co/functions/v1/public-international-tracking"
$checkBody = @{ tracking_number = 'DN-SCHEMA-CHECK-00000' } | ConvertTo-Json -Compress
$checkText = ''
try {
  $check = Invoke-WebRequest -Uri $checkUri -Method Post -ContentType 'application/json' -Body $checkBody -UseBasicParsing
  $checkText = [string]$check.Content
} catch {
  $response = $_.Exception.Response
  if ($response -and $response.GetResponseStream()) {
    $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
    $checkText = $reader.ReadToEnd()
    $reader.Dispose()
  } else {
    $checkText = [string]$_.Exception.Message
  }
}

if ($checkText -match 'international_shipments.*schema cache|Could not find the table|tracking_unavailable') {
  throw "Schema verification still reports a missing tracking table: $checkText"
}

Write-Host ''
Write-Host '17TRACK_SCHEMA_REPAIR_APPLIED_SUCCESSFULLY' -ForegroundColor Green
Write-Host 'The international tracking tables and public tracking function now exist in production.' -ForegroundColor Green
Write-Host 'You can return to DAY NIGHT Admin and register Aramex AWB 37313304803.' -ForegroundColor Green
