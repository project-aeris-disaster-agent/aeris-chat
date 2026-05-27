# Post-Deployment Test Script
# Run this after redeploying Vercel to verify the integration

param(
    [string]$VercelUrl = "",
    [string]$ApiKey = ""
)

Write-Host "=== Testing Vercel-Railway Integration ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Railway Backend Health
Write-Host "1. Testing Railway Backend..." -ForegroundColor Yellow
$railwayUrl = "https://api-production-adbf.up.railway.app"
try {
    $health = Invoke-RestMethod -Uri "$railwayUrl/health" -Method GET -TimeoutSec 10
    Write-Host "   ✓ Railway backend is accessible" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Railway backend check failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 2: Vercel App (if URL provided)
if ($VercelUrl) {
    Write-Host "2. Testing Vercel App..." -ForegroundColor Yellow
    try {
        $vercel = Invoke-WebRequest -Uri $VercelUrl -Method GET -UseBasicParsing -TimeoutSec 10
        Write-Host "   ✓ Vercel app is accessible (Status: $($vercel.StatusCode))" -ForegroundColor Green
    } catch {
        Write-Host "   ✗ Vercel app check failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    Write-Host ""
}

# Test 3: Full Integration Test (if API key provided)
if ($ApiKey) {
    Write-Host "3. Testing Chat Endpoint Integration..." -ForegroundColor Yellow
    $testBody = @{
        messages = @(
            @{
                role = "user"
                content = "Hello, this is an integration test"
            }
        )
    } | ConvertTo-Json

    $headers = @{
        Authorization = "Bearer $ApiKey"
        "Content-Type" = "application/json"
    }

    try {
        $response = Invoke-RestMethod -Uri "$railwayUrl/api/llm/chat" -Method POST -Headers $headers -Body $testBody -TimeoutSec 30
        Write-Host "   ✓ Chat endpoint working!" -ForegroundColor Green
        if ($response.message) {
            $preview = $response.message.Substring(0, [Math]::Min(80, $response.message.Length))
            Write-Host "   Response preview: $preview..." -ForegroundColor Gray
        }
    } catch {
        Write-Host "   ✗ Chat endpoint failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    Write-Host ""
}

# Summary
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "Railway URL: $railwayUrl" -ForegroundColor White
if ($VercelUrl) {
    Write-Host "Vercel URL: $VercelUrl" -ForegroundColor White
}
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Open your Vercel app in browser" -ForegroundColor White
Write-Host "2. Open DevTools (F12) → Network tab" -ForegroundColor White
Write-Host "3. Send a test message in chat" -ForegroundColor White
Write-Host "4. Check /api/chat request:" -ForegroundColor White
Write-Host "   - Should show 200 OK" -ForegroundColor Gray
Write-Host "   - Should call Railway backend" -ForegroundColor Gray
Write-Host "   - Should return AI response" -ForegroundColor Gray

