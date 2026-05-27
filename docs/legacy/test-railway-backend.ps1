# Test script for Railway Backend Integration
# Run this script to verify your Railway backend is accessible

Write-Host "=== Testing Railway Backend Integration ===" -ForegroundColor Cyan
Write-Host ""

$railwayUrl = "https://api-production-adbf.up.railway.app"

# Test 1: Health Check
Write-Host "1. Testing Health Endpoint..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-WebRequest -Uri "$railwayUrl/health" -Method GET -UseBasicParsing -TimeoutSec 10
    Write-Host "   ✓ Health endpoint is accessible (Status: $($healthResponse.StatusCode))" -ForegroundColor Green
    $content = $healthResponse.Content
    if ($content) {
        Write-Host "   Response: $content" -ForegroundColor Gray
    } else {
        Write-Host "   Response: (empty body)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ✗ Health endpoint failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   This might mean the service isn't deployed yet or there's a connection issue." -ForegroundColor Yellow
}
Write-Host ""

# Test 2: Check if API endpoint exists
Write-Host "2. Testing API Endpoint Structure..." -ForegroundColor Yellow
try {
    $apiResponse = Invoke-WebRequest -Uri "$railwayUrl/api/llm/chat" -Method GET -UseBasicParsing -TimeoutSec 10 -ErrorAction SilentlyContinue
    Write-Host "   ✓ API endpoint exists (Status: $($apiResponse.StatusCode))" -ForegroundColor Green
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 405) {
        Write-Host "   ✓ API endpoint exists (Method not allowed for GET, but endpoint exists)" -ForegroundColor Green
    } elseif ($statusCode -eq 401) {
        Write-Host "   ✓ API endpoint exists (Requires authentication - this is expected)" -ForegroundColor Green
    } else {
        Write-Host "   ⚠ API endpoint check: Status $statusCode" -ForegroundColor Yellow
    }
}
Write-Host ""

# Test 3: Chat Endpoint (with API key from env)
Write-Host "3. Testing Chat Endpoint (requires LLM_API_KEY)..." -ForegroundColor Yellow

# Load API key from environment or .env.local
$apiKey = $env:LLM_API_KEY
if (-not $apiKey) {
    $envFilePath = Join-Path (Get-Location) ".env.local"
    if (Test-Path $envFilePath) {
        foreach ($line in Get-Content $envFilePath) {
            if ($line -match '^LLM_API_KEY=(.+)$') {
                $apiKey = $matches[1].Trim().Trim('"')
                break
            }
        }
    }
}

if ($apiKey) {
    $testBody = @{
        messages = @(
            @{
                role = "user"
                content = "Hello, this is a test message from PowerShell"
            }
        )
    } | ConvertTo-Json

    $headers = @{
        Authorization = "Bearer $apiKey"
        "Content-Type" = "application/json"
    }

    try {
        $chatResponse = Invoke-RestMethod -Uri "$railwayUrl/api/llm/chat" -Method POST -Headers $headers -Body $testBody -TimeoutSec 30
        Write-Host "   ✓ Chat endpoint is working!" -ForegroundColor Green
        Write-Host "   Response preview: $($chatResponse.message.Substring(0, [Math]::Min(100, $chatResponse.message.Length)))..." -ForegroundColor Gray
    } catch {
        Write-Host "   ✗ Chat endpoint failed: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "   Error details: $responseBody" -ForegroundColor Red
        }
    }
} else {
    Write-Host "   ⚠ LLM_API_KEY not found. Set it in .env.local or environment to test authenticated endpoint." -ForegroundColor Yellow
}
Write-Host ""

# Summary
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "Railway URL: $railwayUrl" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. If health check passed, your Railway backend is deployed ✓" -ForegroundColor White
Write-Host "2. Update Vercel environment variables:" -ForegroundColor White
Write-Host "   - NEXT_PUBLIC_BACKEND_API_URL = $railwayUrl" -ForegroundColor Gray
Write-Host "   - LLM_API_KEY = (your API key)" -ForegroundColor Gray
Write-Host "3. Redeploy Vercel application" -ForegroundColor White
Write-Host "4. Test the full integration from your Vercel app" -ForegroundColor White

