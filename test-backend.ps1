# Test script for Flask Backend Integration
# Run this script to verify your Flask backend is accessible

Write-Host "=== Testing Flask Backend Integration ===" -ForegroundColor Cyan
Write-Host ""

# Load configuration from .env.local if present
$config = @{}
$envFilePath = Join-Path (Get-Location) ".env.local"
if (Test-Path $envFilePath) {
    foreach ($line in Get-Content $envFilePath) {
        if ($line -match '^\s*#' -or $line.Trim() -eq "" -or $line.IndexOf("=") -eq -1) {
            continue
        }
        $parts = $line.Split("=", 2)
        $key = $parts[0].Trim()
        $value = $parts[1].Trim().Trim('"')
        $config[$key] = $value
    }
}

$backendBaseUrl = $config["NEXT_PUBLIC_BACKEND_API_URL"]
if (-not $backendBaseUrl) {
    $backendBaseUrl = $env:NEXT_PUBLIC_BACKEND_API_URL
}
if (-not $backendBaseUrl) {
    $backendBaseUrl = "http://localhost:8000"
}

$apiKey = $config["LLM_API_KEY"]
if (-not $apiKey) {
    $apiKey = $env:LLM_API_KEY
}

# Test 1: Health Check
Write-Host "1. Testing Health Endpoint..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-WebRequest -Uri "$backendBaseUrl/health" -Method GET -UseBasicParsing
    Write-Host "   ✓ Health endpoint is accessible (Status: $($healthResponse.StatusCode))" -ForegroundColor Green
    $content = $healthResponse.Content
    if ($content) {
        Write-Host "   Response: $content" -ForegroundColor Gray
    } else {
        Write-Host "   Response: (empty body)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ✗ Health endpoint failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 2: Chat Endpoint (Direct)
Write-Host "2. Testing Chat Endpoint (Direct)..." -ForegroundColor Yellow
$testBody = @{
    messages = @(
        @{
            role = "user"
            content = "Hello, this is a test message"
        }
    )
} | ConvertTo-Json

if (-not $apiKey) {
    Write-Host "   ⚠ LLM_API_KEY not found. Set it in .env.local or environment to test authenticated endpoint." -ForegroundColor Yellow
} else {
    try {
        $headers = @{
            "Content-Type" = "application/json"
            "Authorization" = "Bearer $apiKey"
        }

        $chatResponse = Invoke-RestMethod -Uri "$backendBaseUrl/api/llm/chat" -Method POST -Headers $headers -Body $testBody
        Write-Host "   ✓ Chat endpoint is accessible" -ForegroundColor Green
        Write-Host "   Response:" -ForegroundColor Gray
        $chatResponse | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor Gray
    } catch {
        Write-Host "   ✗ Chat endpoint failed: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "   Error details: $responseBody" -ForegroundColor Red
        }
    }
}
Write-Host ""

# Test 3: Check Environment Variables
Write-Host "3. Checking Environment Variables..." -ForegroundColor Yellow
Write-Host "   Backend URL: $backendBaseUrl" -ForegroundColor Gray
if ($apiKey) {
    Write-Host "   ✓ LLM_API_KEY loaded (hidden)" -ForegroundColor Green
} else {
    Write-Host "   ⚠ LLM_API_KEY not detected. Backend will return 401 without it." -ForegroundColor Yellow
}
Write-Host ""

# Test 4: Test Next.js API Route (if Next.js is running)
Write-Host "4. Testing Next.js API Route..." -ForegroundColor Yellow
Write-Host "   Note: This requires Next.js dev server to be running (npm run dev)" -ForegroundColor Gray
try {
    $nextjsBody = @{
        sessionId = "test-session-id"
        messages = @(
            @{
                role = "user"
                content = "Hello from Next.js API"
            }
        )
    } | ConvertTo-Json

    $nextjsResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/chat" -Method POST -ContentType "application/json" -Body $nextjsBody -ErrorAction Stop
    Write-Host "   ✓ Next.js API route is working" -ForegroundColor Green
    Write-Host "   Response:" -ForegroundColor Gray
    $nextjsResponse | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor Gray
} catch {
    if ($_.Exception.Message -like "*Unable to connect*") {
        Write-Host "   ⚠ Next.js dev server is not running. Start it with: npm run dev" -ForegroundColor Yellow
    } else {
        Write-Host "   ✗ Next.js API route failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}
Write-Host ""

Write-Host "=== Testing Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Ensure Flask backend is running at http://localhost:8000" -ForegroundColor White
Write-Host "2. Verify .env.local has NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8000" -ForegroundColor White
Write-Host "3. Start Next.js dev server: npm run dev" -ForegroundColor White
Write-Host "4. Test chat functionality in the browser at http://localhost:3000" -ForegroundColor White

