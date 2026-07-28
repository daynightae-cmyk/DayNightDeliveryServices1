$ErrorActionPreference = 'Stop'

Write-Host ''
Write-Host 'DAY NIGHT - FINAL 17TRACK DATABASE REPAIR' -ForegroundColor Cyan
Write-Host 'This applies the corrective schema migration that creates the missing international tracking tables.' -ForegroundColor DarkGray
Write-Host ''

$projectRef = 'ngdwybpgacauorygoedi'

Write-Host 'Pulling the latest main branch...' -ForegroundColor Yellow
& git pull origin main
if ($LASTEXITCODE -ne 0) {
  throw "git pull failed with exit code $LASTEXITCODE."
}

Write-Host 'Applying pending Supabase migrations...' -ForegroundColor Yellow
& npx supabase db push --project-ref $projectRef
if ($LASTEXITCODE -ne 0) {
  throw "Supabase db push failed with exit code $LASTEXITCODE."
}

Write-Host 'Checking migration history...' -ForegroundColor Yellow
& npx supabase migration list --project-ref $projectRef
if ($LASTEXITCODE -ne 0) {
  throw "Unable to list migration history (exit code $LASTEXITCODE)."
}

Write-Host 'Checking Edge Functions...' -ForegroundColor Yellow
& npx supabase functions list --project-ref $projectRef
if ($LASTEXITCODE -ne 0) {
  throw "Unable to list Edge Functions (exit code $LASTEXITCODE)."
}

Write-Host ''
Write-Host 'International tracking database repair completed.' -ForegroundColor Green
Write-Host 'Expected migration: 20260729193000_repair_aramex_17track_schema' -ForegroundColor Green
Write-Host 'The missing tables and PostgREST schema cache are now repaired.' -ForegroundColor Green
