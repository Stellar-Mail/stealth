// Upgrade management module for Policies contract

use soroban_sdk::{Env, Address, Symbol, Bytes, Vec};

// Storage keys (public for tests)
pub(crate) const AUTHORITY_KEY: Symbol = Symbol::short("authority");
pub(crate) const THRESHOLD_KEY: Symbol = Symbol::short("threshold");
pub(crate) const TIMELOCK_KEY: Symbol = Symbol::short("timelock");
pub(crate) const PENDING_HASH_KEY: Symbol = Symbol::short("pending_hash");
pub(crate) const CURRENT_HASH_KEY: Symbol = Symbol::short("current_hash");
pub(crate) const VERSION_KEY: Symbol = Symbol::short("version");
pub(crate) const FREEZE_FLAG_KEY: Symbol = Symbol::short("freeze");
pub(crate) const ROLLBACK_HASH_KEY: Symbol = Symbol::short("rollback_hash");

pub(crate) const DEFAULT_TIMELOCK: u64 = 86_400; // 24h default

// Upgrade management module for Policies contract

use soroban_sdk::{Env, Address, Bytes, Symbol, Vec};

pub const AUTHORITY_KEY: Symbol = Symbol::short("authority");
pub const THRESHOLD_KEY: Symbol = Symbol::short("threshold");
pub const TIMELOCK_KEY: Symbol = Symbol::short("timelock");
pub const PENDING_HASH_KEY: Symbol = Symbol::short("pending_hash");
pub const CURRENT_HASH_KEY: Symbol = Symbol::short("current_hash");
pub const VERSION_KEY: Symbol = Symbol::short("version");
pub const FREEZE_FLAG_KEY: Symbol = Symbol::short("freeze");
pub const ROLLBACK_HASH_KEY: Symbol = Symbol::short("rollback_hash");
pub const DEFAULT_TIMELOCK: u64 = 86_400; // 24h default

// ---------- Authority ----------
pub fn set_authority(env: Env, owners: Vec<Address>, threshold: u32) -> Result<(), ()> {
    // TODO: proper auth check – only current admin should call
    env.storage().persistent().set(&AUTHORITY_KEY, &owners);
    env.storage().persistent().set(&THRESHOLD_KEY, &threshold);
    Ok(())
}

pub fn get_authority(env: Env) -> (Vec<Address>, u32) {
    let owners: Vec<Address> = env
        .storage()
        .persistent()
        .get(&AUTHORITY_KEY)
        .unwrap_or_else(|| Vec::new(&env));
    let threshold: u32 = env.storage().persistent().get(&THRESHOLD_KEY).unwrap_or(1);
    (owners, threshold)
}

// ---------- Freeze ----------
pub fn set_freeze(env: Env, flag: bool) -> Result<(), ()> {
    // Only admin should call – omitted for brevity
    env.storage().persistent().set(&FREEZE_FLAG_KEY, &flag);
    Ok(())
}

pub fn is_frozen(env: Env) -> bool {
    env.storage().persistent().get(&FREEZE_FLAG_KEY).unwrap_or(false)
}

// ---------- Upgrade flow ----------
pub fn propose_upgrade(env: Env, wasm_hash: Bytes) -> Result<(), ()> {
    if PoliciesContract::is_frozen(env.clone()) {
        return Err(());
    }
    env.storage().persistent().set(&PENDING_HASH_KEY, &wasm_hash);
    let now = env.ledger().timestamp();
    env.storage().persistent().set(&TIMELOCK_KEY, &(now + DEFAULT_TIMELOCK));
    Ok(())
}

pub fn execute_upgrade(env: Env) -> Result<(), ()> {
    if PoliciesContract::is_frozen(env.clone()) {
        return Err(());
    }
    let now = env.ledger().timestamp();
    let unlock: u64 = env.storage().persistent().get(&TIMELOCK_KEY).ok_or(())?;
    if now < unlock {
        return Err(());
    }
    let pending: Bytes = env.storage().persistent().get(&PENDING_HASH_KEY).ok_or(())?;
    // Store current hash as rollback if exists
    if let Some(current) = env.storage().persistent().get(&CURRENT_HASH_KEY) {
        env.storage().persistent().set(&ROLLBACK_HASH_KEY, &current);
    }
    env.storage().persistent().set(&CURRENT_HASH_KEY, &pending);
    let ver: u32 = env.storage().persistent().get(&VERSION_KEY).unwrap_or(0) + 1;
    env.storage().persistent().set(&VERSION_KEY, &ver);
    // Cleanup
    env.storage().persistent().remove(&PENDING_HASH_KEY);
    env.storage().persistent().remove(&TIMELOCK_KEY);
    Ok(())
}

pub fn get_version(env: Env) -> u32 {
    env.storage().persistent().get(&VERSION_KEY).unwrap_or(0)
}

pub fn get_timelock(env: Env) -> Option<u64> {
    env.storage().persistent().get(&TIMELOCK_KEY)
}

pub fn get_current_hash(env: Env) -> Option<Bytes> {
    env.storage().persistent().get(&CURRENT_HASH_KEY)
}

pub fn get_pending_hash(env: Env) -> Option<Bytes> {
    env.storage().persistent().get(&PENDING_HASH_KEY)
}

// ---------- Rollback ----------
pub fn rollback(env: Env) -> Result<(), ()> {
    if PoliciesContract::is_frozen(env.clone()) {
        return Err(());
    }
    let rollback_hash: Bytes = env.storage().persistent().get(&ROLLBACK_HASH_KEY).ok_or(())?;
    env.storage().persistent().set(&CURRENT_HASH_KEY, &rollback_hash);
    let ver: u32 = env.storage().persistent().get(&VERSION_KEY).unwrap_or(0) + 1;
    env.storage().persistent().set(&VERSION_KEY, &ver);
    env.storage().persistent().remove(&ROLLBACK_HASH_KEY);
    Ok(())
}
