#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype,
    symbol_short, token, Address, Env, Vec,
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
