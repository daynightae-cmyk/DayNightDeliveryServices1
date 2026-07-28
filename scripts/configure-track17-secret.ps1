$ErrorActionPreference = 'Stop'

$projectRef = 'ngdwybpgacauorygoedi'
$settingsUrl = 'https://admin.17track.net/api/settings'
$quotaUrl = 'https://api.17track.net/track/v2.4/getquota'
$tempFile = Join-Path ([System.IO.Path]::GetTempPath()) ("daynight-track17-{0}.env" -f ([guid]::NewGuid().ToString('N')))

function ConvertFrom-SecureValue([Security.SecureString]$SecureValue) {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

Write-Host ''
Write-Host 'DAY NIGHT - 17TRACK API KEY CONFIGURATION' -ForegroundColor Cyan
Write-Host 'This checks the real 17TRACK API key, stores it in Supabase, and never commits it to GitHub.' -ForegroundColor DarkGray
Write-Host ''

try {
  Start-Process $settingsUrl
} catch {
  Write-Host "Open this page manually: $settingsUrl" -ForegroundColor Yellow
}

Write-Host 'In 17TRACK Settings, open Security and copy the complete API key.' -ForegroundColor Yellow
$secureKey = Read-Host 'Paste the complete 17TRACK API key here (input is hidden)' -AsSecureString
$key = ConvertFrom-SecureValue $secureKey

if ([string]::IsNullOrWhiteSpace($key) -or $key.Trim().Length -lt 10) {
  throw 'The API key is empty or too short.'
}
$key = $key.Trim()

Write-Host 'Validating the key directly with 17TRACK v2.4...' -ForegroundColor Yellow
$headers = @{
  '17token' = $key
  'Content-Type' = 'application/json'
  'User-Agent' = 'DAY-NIGHT-Delivery-Services/17TRACK-v2.4'
}

try {
  $quota = Invoke-RestMethod -Method Post -Uri $quotaUrl -Headers $headers -Body '[]' -TimeoutSec 30
} catch {
  throw "17TRACK rejected the key or could not be reached: $($_.Exception.Message)"
}

if ([int]$quota.code -ne 0) {
  $providerMessage = [string]$quota.message
  throw "17TRACK rejected the key. Code: $($quota.code). Message: $providerMessage"
}

Write-Host 'The key is valid. Saving it to Supabase Edge Function Secrets...' -ForegroundColor Green

try {
  [System.IO.File]::WriteAllText($tempFile, "TRACK17_API_KEY=$key`n", [System.Text.UTF8Encoding]::new($false))
  & npx supabase secrets set --env-file $tempFile --project-ref $projectRef
  if ($LASTEXITCODE -ne 0) {
    throw "Supabase secrets set failed with exit code $LASTEXITCODE."
  }
} finally {
  if (Test-Path $tempFile) {
    Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
  }
  $key = $null
  $secureKey = $null
}

Write-Host 'Confirming the secret name without exposing its value...' -ForegroundColor Yellow
& npx supabase secrets list --project-ref $projectRef
if ($LASTEXITCODE -ne 0) {
  throw "Unable to list Supabase secrets (exit code $LASTEXITCODE)."
}

Write-Host ''
Write-Host 'TRACK17_API_KEY is configured and validated successfully.' -ForegroundColor Green
Write-Host 'You can now register the Aramex AWB from the DAY NIGHT admin center.' -ForegroundColor Green
