# Simple test script for Flask Backend Integration
Write-Host "=== Testing Flask Backend Integration ===" -ForegroundColor Cyan
Write-Host ""

# Load API key from .env.local
$apiKey = $null
if (Test-Path ".env.local") {
    $lines = Get-Content ".env.local"
    foreach ($line in $lines) {
        if ($line -match "^LLM_API_KEY=(.+)$") {
            $apiKey = $matches[1].Trim()
        }
    }
}

# Test 1: Health Check
Write-Host "1. Testing Health Endpoint..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-WebRequest -Uri "http://localhost:8000/health" -Method GET -UseBasicParsing
    Write-Host "   ✓ Health endpoint is accessible (Status: $($healthResponse.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Health endpoint failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 2: Chat Endpoint
Write-Host "2. Testing Chat Endpoint..." -ForegroundColor Yellow
if (-not $apiKey) {
    Write-Host "   ⚠ LLM_API_KEY not found in .env.local" -ForegroundColor Yellow
} else {
    $testBody = '{"messages": [{"role": "user", "content": "Hello, this is a test message"}]}'
    $headers = @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer $apiKey"
    }
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:8000/api/llm/chat" -Method POST -Headers $headers -Body $testBody
        Write-Host "   ✓ Chat endpoint is accessible" -ForegroundColor Green
        Write-Host "   Response:" -ForegroundColor Gray
        $response | ConvertTo-Json -Depth 5
    } catch {
        Write-Host "   ✗ Chat endpoint failed: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $statusCode = $_.Exception.Response.StatusCode.value__
            Write-Host "   Status Code: $statusCode" -ForegroundColor Red
        }
    }
}
Write-Host ""

Write-Host "=== Testing Complete ===" -ForegroundColor Cyan

