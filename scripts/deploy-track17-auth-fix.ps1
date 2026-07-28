$ErrorActionPreference = 'Stop'

Write-Host 'DAY NIGHT - deploying protected Track17 functions with gateway JWT verification disabled...' -ForegroundColor Cyan

$projectRef = 'ngdwybpgacauorygoedi'
$functions = @(
  'track17-admin',
  'register-track17-shipment',
  'sync-track17-shipment'
)

foreach ($functionName in $functions) {
  Write-Host "Deploying $functionName..." -ForegroundColor Yellow
  & npx supabase functions deploy $functionName --project-ref $projectRef --no-verify-jwt --use-api
  if ($LASTEXITCODE -ne 0) {
    throw "Deployment failed for $functionName (exit code $LASTEXITCODE)."
  }
}

Write-Host 'Checking deployed functions...' -ForegroundColor Yellow
& npx supabase functions list --project-ref $projectRef
if ($LASTEXITCODE -ne 0) {
  throw "Unable to list deployed functions (exit code $LASTEXITCODE)."
}

Write-Host 'Track17 authentication deployment completed successfully.' -ForegroundColor Green
