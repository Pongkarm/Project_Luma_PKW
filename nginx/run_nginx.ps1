$nginxDir = "$PSScriptRoot"
Set-Location $nginxDir

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " [LUMA] Starting Nginx Server on Port 80" -ForegroundColor Green
Write-Host " [LUMA] Streaming LIVE Access Logs (Press Ctrl+C to stop)" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

if (!(Test-Path "$nginxDir\logs")) { New-Item -ItemType Directory -Path "$nginxDir\logs" -Force | Out-Null }
if (!(Test-Path "$nginxDir\logs\access.log")) { New-Item -ItemType File -Path "$nginxDir\logs\access.log" -Force | Out-Null }

# Start Nginx
start nginx -ArgumentList "-p `"$nginxDir`""

try {
    Get-Content -Path "$nginxDir\logs\access.log" -Wait -Tail 0
}
finally {
    Write-Host "`n[LUMA] Stopping Nginx..." -ForegroundColor Yellow
    & "$nginxDir\nginx.exe" -p "$nginxDir" -s stop 2>$null
    Write-Host "[LUMA] Nginx stopped cleanly.`n" -ForegroundColor Green
}
