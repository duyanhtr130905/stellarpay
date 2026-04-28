#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype,
    symbol_short, token, Address, Env,
};

// ── Storage keys ─────────────────────────────────────────────────────────────
#[contracttype]
pub enum DataKey {
    Owner,
    Token,
    TotalTips,
    TipCount,
    Tipper(Address),
}

// ── Tip record returned to frontend ──────────────────────────────────────────
#[contracttype]
#[derive(Clone)]
pub struct TipJarInfo {
    pub owner: Address,
    pub total_tips: i128,   // in stroops (1 XLM = 10_000_000 stroops)
    pub tip_count: u32,
}

// ── Contract ──────────────────────────────────────────────────────────────────
#[contract]
pub struct TipJarContract;

#[contractimpl]
impl TipJarContract {
    /// Initialize the tip jar. Call once after deploy.
    /// owner    = the address that will receive tips
    /// token    = XLM native contract address on testnet:
    ///            CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCN
    pub fn initialize(env: Env, owner: Address, token: Address) {
        if env.storage().instance().has(&DataKey::Owner) {
            panic!("already initialized");
        }
        owner.require_auth();
        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::TotalTips, &0_i128);
        env.storage().instance().set(&DataKey::TipCount, &0_u32);

        env.events().publish(
            (symbol_short!("tipjar"), symbol_short!("init")),
            owner,
        );
    }

    /// Send a tip to the owner. amount is in stroops.
    pub fn tip(env: Env, tipper: Address, amount: i128) {
        tipper.require_auth();

        if amount <= 0 {
            panic!("amount must be positive");
        }

        let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();

        // Transfer directly from tipper → owner (no escrow)
        token::Client::new(&env, &token).transfer(&tipper, &owner, &amount);

        // Update stats
        let total: i128 = env.storage().instance().get(&DataKey::TotalTips).unwrap();
        let count: u32  = env.storage().instance().get(&DataKey::TipCount).unwrap();
        env.storage().instance().set(&DataKey::TotalTips, &(total + amount));
        env.storage().instance().set(&DataKey::TipCount,  &(count + 1));

        // Per-tipper running total (persistent storage so it survives ledger expiry)
        let prev: i128 = env.storage()
            .persistent()
            .get(&DataKey::Tipper(tipper.clone()))
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::Tipper(tipper.clone()), &(prev + amount));

        // Emit event — frontend polls for this
        env.events().publish(
            (symbol_short!("tipjar"), symbol_short!("tip")),
            (tipper, amount, total + amount),
        );
    }

    /// Read-only: get tip jar stats.
    pub fn get_info(env: Env) -> TipJarInfo {
        TipJarInfo {
            owner:      env.storage().instance().get(&DataKey::Owner).unwrap(),
            total_tips: env.storage().instance().get(&DataKey::TotalTips).unwrap(),
            tip_count:  env.storage().instance().get(&DataKey::TipCount).unwrap(),
        }
    }

    /// Read-only: how much has a specific address tipped in total.
    pub fn get_my_tips(env: Env, tipper: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Tipper(tipper))
            .unwrap_or(0)
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, token, Env};

    /// Helper: register tip jar contract + SAC token, initialize, and return everything.
    fn setup() -> (Env, Address, Address, TipJarContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();

        // Deploy the tip jar contract
        let contract_id = env.register(TipJarContract, ());
        let client = TipJarContractClient::new(&env, &contract_id);

        // Deploy a Stellar Asset Contract (SAC) to act as XLM token
        let admin = Address::generate(&env);
        let token_contract = env.register_stellar_asset_contract_v2(admin.clone());
        let token_id = token_contract.address();

        // Owner = the person who will receive tips
        let owner = Address::generate(&env);

        // Initialize the tip jar
        client.initialize(&owner, &token_id);

        (env, owner, token_id, client)
    }

    #[test]
    fn test_initialize() {
        let (_env, owner, _token_id, client) = setup();

        let info = client.get_info();
        assert_eq!(info.owner, owner);
        assert_eq!(info.total_tips, 0_i128);
        assert_eq!(info.tip_count, 0_u32);
    }

    #[test]
    fn test_tip() {
        let (env, owner, token_id, client) = setup();

        // Create a tipper and mint tokens to them
        let tipper = Address::generate(&env);
        let token_admin = token::StellarAssetClient::new(&env, &token_id);
        token_admin.mint(&tipper, &100_0000000); // 100 XLM in stroops

        // Send a 10 XLM tip
        let tip_amount: i128 = 10_0000000;
        client.tip(&tipper, &tip_amount);

        // Verify tip jar stats updated
        let info = client.get_info();
        assert_eq!(info.total_tips, tip_amount);
        assert_eq!(info.tip_count, 1);

        // Verify per-tipper tracking
        assert_eq!(client.get_my_tips(&tipper), tip_amount);

        // Verify XLM was actually transferred: owner should have received it
        let token_client = token::Client::new(&env, &token_id);
        assert_eq!(token_client.balance(&owner), tip_amount);
        assert_eq!(token_client.balance(&tipper), 100_0000000 - tip_amount);
    }

    #[test]
    fn test_tip_updates_stats_cumulatively() {
        let (env, _owner, token_id, client) = setup();

        let tipper_a = Address::generate(&env);
        let tipper_b = Address::generate(&env);
        let token_admin = token::StellarAssetClient::new(&env, &token_id);
        token_admin.mint(&tipper_a, &500_0000000);
        token_admin.mint(&tipper_b, &500_0000000);

        // Tipper A sends 5 XLM
        client.tip(&tipper_a, &5_0000000);
        // Tipper B sends 15 XLM
        client.tip(&tipper_b, &15_0000000);
        // Tipper A sends another 10 XLM
        client.tip(&tipper_a, &10_0000000);

        let info = client.get_info();
        assert_eq!(info.total_tips, 30_0000000); // 5 + 15 + 10
        assert_eq!(info.tip_count, 3);

        // Per-tipper totals
        assert_eq!(client.get_my_tips(&tipper_a), 15_0000000); // 5 + 10
        assert_eq!(client.get_my_tips(&tipper_b), 15_0000000); // 15
    }

    #[test]
    #[should_panic(expected = "amount must be positive")]
    fn test_tip_zero_amount_panics() {
        let (env, _owner, token_id, client) = setup();

        let tipper = Address::generate(&env);
        let token_admin = token::StellarAssetClient::new(&env, &token_id);
        token_admin.mint(&tipper, &100_0000000);

        // Tipping 0 should panic
        client.tip(&tipper, &0);
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn test_double_initialize_panics() {
        let (env, _owner, token_id, client) = setup();

        // Second initialization should panic
        let another_owner = Address::generate(&env);
        client.initialize(&another_owner, &token_id);
    }
}
