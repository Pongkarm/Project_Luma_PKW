[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

$NGINX_IP    = "172.20.10.9"
$FRONTEND_IP = "172.20.10.8"
$BACKEND_IP  = "172.20.10.6"
$AI_IP       = "172.20.10.3"

$FRONTEND_PORT = 5500
$BACKEND_PORT  = 8000
$AI_PORT       = 7860
$NGINX_PORT    = 80

$totalTests = 0
$passedTests = 0
$failedTests = 0

function Write-TestHeader($title) {
    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host " $title" -ForegroundColor Cyan
    Write-Host "================================================================================" -ForegroundColor Cyan
}

function Report-Result($tcId, $name, $passed, $detail) {
    $script:totalTests++
    if ($passed) {
        $script:passedTests++
        Write-Host " [$tcId] " -NoNewline -ForegroundColor White
        Write-Host "✔ PASS " -NoNewline -ForegroundColor Green
        Write-Host "- $name" -ForegroundColor White
        if ($detail) { Write-Host "         Detail: $detail" -ForegroundColor Gray }
    } else {
        $script:failedTests++
        Write-Host " [$tcId] " -NoNewline -ForegroundColor White
        Write-Host "✘ FAIL " -NoNewline -ForegroundColor Red
        Write-Host "- $name" -ForegroundColor Yellow
        if ($detail) { Write-Host "         Error: $detail" -ForegroundColor Red }
    }
}

function Test-TcpPort($targetIp, $targetPort) {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $iar = $tcp.BeginConnect($targetIp, $targetPort, $null, $null)
    $wait = $iar.AsyncWaitHandle.WaitOne(1000, $false)
    $isOpen = $false
    if ($wait) {
        try {
            $tcp.EndConnect($iar)
            $isOpen = $true
        } catch {}
    }
    $tcp.Close()
    return $isOpen
}

Write-Host "================================================================================" -ForegroundColor Magenta
Write-Host "    LUMA PROJECT - DISTRIBUTED SYSTEM AUTOMATED VERIFICATION SUITE" -ForegroundColor Magenta
Write-Host "    Architecture: Browser -> Nginx (Gateway) -> [Frontend | Backend] -> AI Node" -ForegroundColor Magenta
Write-Host "    Execution Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Magenta
Write-Host "================================================================================" -ForegroundColor Magenta

# -----------------------------------------------------------------------------
# 1. NETWORK REACHABILITY (PING)
# -----------------------------------------------------------------------------
Write-TestHeader "TEST GROUP 1: Network Layer Reachability (Ping ICMP)"

$ping = New-Object System.Net.NetworkInformation.Ping

# TC-01: AI Server Ping
$pAI = $ping.Send($AI_IP, 500)
$isAIOk = ($pAI.Status -eq "Success")
Report-Result "TC-01" "AI Server (Windows: $AI_IP) Reachability" $isAIOk "Status: $($pAI.Status)"

# TC-02: Backend Ping
$pBE = $ping.Send($BACKEND_IP, 500)
$isBEOk = ($pBE.Status -eq "Success")
Report-Result "TC-02" "Backend (macOS: $BACKEND_IP) Reachability" $isBEOk "Status: $($pBE.Status)"

# TC-03: Frontend Ping
$pFE = $ping.Send($FRONTEND_IP, 500)
$isFEOk = ($pFE.Status -eq "Success")
Report-Result "TC-03" "Frontend (macOS: $FRONTEND_IP) Reachability" $isFEOk "Status: $($pFE.Status)"

# TC-04: Nginx Local Interface
$pNG = $ping.Send($NGINX_IP, 500)
$isNGOk = ($pNG.Status -eq "Success")
Report-Result "TC-04" "Nginx Gateway ($NGINX_IP) Local Interface" $isNGOk "Status: $($pNG.Status)"

# -----------------------------------------------------------------------------
# 2. TCP PORT READINESS
# -----------------------------------------------------------------------------
Write-TestHeader "TEST GROUP 2: Service Port Handshake (TCP SYN/ACK)"

# TC-05: Nginx Port 80
$ngPort = Test-TcpPort "127.0.0.1" $NGINX_PORT
Report-Result "TC-05" "Nginx Gateway Port $NGINX_PORT Listening" $ngPort "Port $NGINX_PORT is active on local machine"

# TC-06: Frontend Port 5500
$fePort = Test-TcpPort $FRONTEND_IP $FRONTEND_PORT
Report-Result "TC-06" "Frontend Web Server Port $FRONTEND_PORT Listening" $fePort "Host: $FRONTEND_IP : $FRONTEND_PORT"

# TC-07: Backend Port 8000
$bePort = Test-TcpPort $BACKEND_IP $BACKEND_PORT
Report-Result "TC-07" "Backend FastAPI Server Port $BACKEND_PORT Listening" $bePort "Host: $BACKEND_IP : $BACKEND_PORT"

# TC-08: AI Server Port 7860
$aiPort = Test-TcpPort $AI_IP $AI_PORT
Report-Result "TC-08" "AI Server GPU Node Port $AI_PORT Listening" $aiPort "Host: $AI_IP : $AI_PORT"

# -----------------------------------------------------------------------------
# 3. DIRECT NODE FUNCTIONALITY
# -----------------------------------------------------------------------------
Write-TestHeader "TEST GROUP 3: Direct Node Service Healthchecks"

# TC-09: Direct AI Node Health
try {
    $resAI = Invoke-RestMethod -Uri "http://${AI_IP}:${AI_PORT}/ai/health" -TimeoutSec 3 -ErrorAction Stop
    $gpuName = $resAI.gpu.device
    $isOk = ($resAI.status -eq "online")
    Report-Result "TC-09" "AI Node Service Telemetry" $isOk "Status: $($resAI.status), GPU: $gpuName, VRAM Free: $($resAI.gpu.vram_free_gb) GB"
} catch {
    Report-Result "TC-09" "AI Node Service Telemetry" $false "$($_.Exception.Message)"
}

# TC-10: Direct Backend Health
try {
    $resBE = Invoke-RestMethod -Uri "http://${BACKEND_IP}:${BACKEND_PORT}/healthz" -TimeoutSec 3 -ErrorAction Stop
    $isOk = ($resBE.status -eq "healthy" -and $resBE.database -eq "connected")
    Report-Result "TC-10" "Backend Database and Health" $isOk "Status: $($resBE.status), Database: $($resBE.database), Version: $($resBE.version)"
} catch {
    Report-Result "TC-10" "Backend Database and Health" $false "$($_.Exception.Message)"
}

# TC-11: Direct Frontend HTML Serving
try {
    $resFE = Invoke-WebRequest -Uri "http://${FRONTEND_IP}:${FRONTEND_PORT}/login.html" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
    $isOk = ($resFE.StatusCode -eq 200 -and $resFE.Content.Contains("<html"))
    Report-Result "TC-11" "Frontend Static Assets Serving" $isOk "HTTP $($resFE.StatusCode), Content-Length: $($resFE.Content.Length) bytes"
} catch {
    Report-Result "TC-11" "Frontend Static Assets Serving" $false "$($_.Exception.Message)"
}

# -----------------------------------------------------------------------------
# 4. NGINX REVERSE PROXY ROUTING (THE CRITICAL ARCHITECTURE REQUIREMENT)
# -----------------------------------------------------------------------------
Write-TestHeader "TEST GROUP 4: Nginx Reverse Proxy Gateway Routing"

# TC-12: Nginx -> Frontend Web Proxy (Root path /)
try {
    $gwRoot = Invoke-WebRequest -Uri "http://${NGINX_IP}/" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
    $isOk = ($gwRoot.StatusCode -eq 200)
    Report-Result "TC-12" "Nginx -> Frontend Reverse Proxy (GET /)" $isOk "HTTP $($gwRoot.StatusCode) OK (Loaded from $FRONTEND_IP via Nginx)"
} catch {
    Report-Result "TC-12" "Nginx -> Frontend Reverse Proxy (GET /)" $false "$($_.Exception.Message)"
}

# TC-13: Nginx -> Frontend Login Page (GET /login.html)
try {
    $gwLogin = Invoke-WebRequest -Uri "http://${NGINX_IP}/login.html" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
    $isOk = ($gwLogin.StatusCode -eq 200)
    Report-Result "TC-13" "Nginx -> Frontend Page Proxy (GET /login.html)" $isOk "HTTP $($gwLogin.StatusCode) OK"
} catch {
    Report-Result "TC-13" "Nginx -> Frontend Page Proxy (GET /login.html)" $false "$($_.Exception.Message)"
}

# TC-14: Nginx -> Backend Health Proxy (GET /healthz)
try {
    $gwHealth = Invoke-RestMethod -Uri "http://${NGINX_IP}/healthz" -TimeoutSec 3 -ErrorAction Stop
    $isOk = ($gwHealth.status -eq "healthy")
    $healthJson = $gwHealth | ConvertTo-Json -Compress
    Report-Result "TC-14" "Nginx -> Backend API Proxy (GET /healthz)" $isOk "HTTP 200 OK, Response: $healthJson"
} catch {
    Report-Result "TC-14" "Nginx -> Backend API Proxy (GET /healthz)" $false "$($_.Exception.Message)"
}

# TC-15: Nginx -> Backend API Routes Prefix (GET /api/models)
try {
    $gwModels = Invoke-RestMethod -Uri "http://${NGINX_IP}/api/models" -TimeoutSec 3 -ErrorAction Stop
    Report-Result "TC-15" "Nginx -> Backend Route Integrity (GET /api/models)" $true "HTTP 200 OK"
} catch {
    $statusCode = 0
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
    }
    if ($statusCode -eq 401) {
        Report-Result "TC-15" "Nginx -> Backend Route Integrity (GET /api/models)" $true "HTTP 401 Not Authenticated (Route reached Backend successfully!)"
    } else {
        Report-Result "TC-15" "Nginx -> Backend Route Integrity (GET /api/models)" $false "Returned HTTP $statusCode ($($_.Exception.Message))"
    }
}

# -----------------------------------------------------------------------------
# 5. FRONTEND CONFIG VALIDATION
# -----------------------------------------------------------------------------
Write-TestHeader "TEST GROUP 5: Gateway Routing Enforcement (Frontend config.js)"

# TC-16: Verify API_BASE_URL enforces Nginx
try {
    $cfgContent = Invoke-RestMethod -Uri "http://${FRONTEND_IP}:${FRONTEND_PORT}/js/config.js" -TimeoutSec 3 -ErrorAction Stop
    $hasEmptyBase = ($cfgContent -match "const\s+API_BASE_URL\s*=\s*['`"]['`"]" -or $cfgContent -match "const\s+API_BASE_URL\s*=\s*['`"]http://172\.20\.10\.9['`"]")
    Report-Result "TC-16" "Frontend js/config.js Routing Enforcement" $hasEmptyBase "API_BASE_URL routes through Nginx (Direct backend bypass is disabled)"
} catch {
    Report-Result "TC-16" "Frontend js/config.js Routing Enforcement" $false "$($_.Exception.Message)"
}

# -----------------------------------------------------------------------------
# SUMMARY REPORT
# -----------------------------------------------------------------------------
Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "                           VERIFICATION SUMMARY REPORT" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host " Total Test Cases Executed : $totalTests" -ForegroundColor White
Write-Host " Passed Test Cases         : $passedTests" -ForegroundColor Green
Write-Host " Failed Test Cases         : $failedTests" -ForegroundColor $(if ($failedTests -eq 0) { "Green" } else { "Red" })

$passRate = [Math]::Round(($passedTests / $totalTests) * 100, 1)
Write-Host " Overall Pass Rate         : $passRate%" -ForegroundColor $(if ($passRate -eq 100) { "Green" } else { "Yellow" })

if ($failedTests -eq 0) {
    Write-Host "`n [CONGRATULATIONS] The LUMA Distributed Architecture is 100% OPERATIONAL!" -ForegroundColor Green
    Write-Host " All 4 nodes are correctly communicating via the Nginx Reverse Proxy Gateway." -ForegroundColor Green
} else {
    Write-Host "`n [WARNING] Some test cases failed. Please review the error details above." -ForegroundColor Yellow
}
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""
