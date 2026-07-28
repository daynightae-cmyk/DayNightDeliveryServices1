$ErrorActionPreference = 'Stop'

Write-Host ''
Write-Host 'DAY NIGHT - APPLYING 17TRACK DATABASE SCHEMA REPAIR' -ForegroundColor Cyan
Write-Host 'This creates the missing international tracking tables and reloads the PostgREST schema cache.' -ForegroundColor DarkGray
Write-Host ''

$migration = Join-Path $PSScriptRoot '..\supabase\migrations\20260729030000_repair_track17_schema.sql'
if (-not (Test-Path $migration)) {
  throw "Repair migration is missing: $migration"
}

Write-Host 'Pushing the pending repair migration to the linked Supabase project...' -ForegroundColor Yellow
& npx supabase db push
if ($LASTEXITCODE -ne 0) {
  throw "Supabase db push failed with exit code $LASTEXITCODE."
}

Write-Host ''
Write-Host 'Migration history after repair:' -ForegroundColor Yellow
& npx supabase migration list
if ($LASTEXITCODE -ne 0) {
  throw "Unable to read migration history (exit code $LASTEXITCODE)."
}

Write-Host ''
Write-Host '17TRACK_SCHEMA_REPAIR_APPLIED_SUCCESSFULLY' -ForegroundColor Green
Write-Host 'The tables international_shipments, international_tracking_events, track17_webhook_logs, track17_api_logs and track17_quota_cache are now created.' -ForegroundColor Green
