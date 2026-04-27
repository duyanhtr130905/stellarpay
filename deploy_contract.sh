#!/bin/bash
# deploy_contract.sh
# Chạy file này từ root của repo stellarpay
# Yêu cầu: Rust + stellar-cli đã cài, ví deployer đã có XLM testnet

set -e

echo "=== Build Soroban contract ==="
cd contract
cargo build --target wasm32-unknown-unknown --release
cd ..

WASM="contract/target/wasm32-unknown-unknown/release/tip_jar.wasm"

echo "=== Deploy contract to testnet ==="
CONTRACT_ID=$(stellar contract deploy \
  --wasm "$WASM" \
  --source deployer \
  --network testnet)

echo "Contract ID: $CONTRACT_ID"

echo "=== Initialize tip jar ==="
# Thay YOUR_PUBLIC_KEY bằng public key của bạn
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source deployer \
  --network testnet \
  -- initialize \
  --owner GA5KXH57NDL2NEYXVYCE2P72T6RQAAVECXK7QWI6XL2XMFJJTFAKRJQ5 \
  --token CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCN

echo "=== Write .env ==="
echo "VITE_CONTRACT_ID=$CONTRACT_ID" > .env

echo ""
echo "✅ Done! Contract deployed: $CONTRACT_ID"
echo "✅ .env file updated."
echo "👉 Now run: npm run dev"
