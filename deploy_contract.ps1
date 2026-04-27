# deploy_contract.ps1
# Chạy file này từ root của repo stellarpay (PowerShell)
# Yêu cầu: Rust + stellar-cli đã cài, ví deployer đã có XLM testnet

$ErrorActionPreference = "Stop"

# Refresh PATH to pick up newly installed tools
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'User') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'Machine')

# ── Step 0: Setup deployer identity (chỉ cần chạy 1 lần) ──
$hasDeployer = stellar keys show deployer 2>$null
if (-not $hasDeployer) {
    Write-Host "=== Creating deployer identity ===" -ForegroundColor Cyan
    stellar keys generate deployer --network testnet --fund
    Write-Host "Deployer public key:"
    stellar keys address deployer
    Write-Host ""
}

# ── Step 1: Build Soroban contract ──
Write-Host "=== Build Soroban contract ===" -ForegroundColor Cyan
Push-Location contract
cargo build --target wasm32-unknown-unknown --release
Pop-Location

$WASM = "contract/target/wasm32-unknown-unknown/release/tip_jar.wasm"

if (-not (Test-Path $WASM)) {
    Write-Host "ERROR: WASM file not found at $WASM" -ForegroundColor Red
    exit 1
}

# ── Step 2: Deploy contract to testnet ──
Write-Host "=== Deploy contract to testnet ===" -ForegroundColor Cyan
$CONTRACT_ID = stellar contract deploy `
    --wasm $WASM `
    --source deployer `
    --network testnet

Write-Host "Contract ID: $CONTRACT_ID" -ForegroundColor Green

# ── Step 3: Initialize tip jar ──
Write-Host "=== Initialize tip jar ===" -ForegroundColor Cyan

# Lấy public key của deployer làm owner
$OWNER_KEY = stellar keys address deployer

stellar contract invoke `
    --id $CONTRACT_ID `
    --source deployer `
    --network testnet `
    -- initialize `
    --owner $OWNER_KEY `
    --token CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCN

# ── Step 4: Write .env ──
Write-Host "=== Write .env ===" -ForegroundColor Cyan
"VITE_CONTRACT_ID=$CONTRACT_ID" | Out-File -FilePath .env -Encoding utf8 -NoNewline

Write-Host ""
Write-Host "Done! Contract deployed: $CONTRACT_ID" -ForegroundColor Green
Write-Host ".env file updated." -ForegroundColor Green
Write-Host "Now run: npm run dev" -ForegroundColor Yellow
