#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, symbol_short, token,
    Address, BytesN, Env, MuxedAddress, Symbol,
};

#[contract]
pub struct PostageContract;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Postage {
    pub sender: Address,
    pub recipient: Address,
    pub amount: i128,
    pub fee: i128,
    pub created_at: u64,
    pub expires_at: u64,
    pub dispute_until: u64,
    pub status: PostageStatus,
}

#[contractevent(topics = ["postage"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PostageEvent {
    #[topic]
    pub action: Symbol,
    #[topic]
    pub message_id: BytesN<32>,
    pub postage: Postage,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowConfig {
    pub asset: Address,
    pub minimum: i128,
    pub treasury: Address,
    pub fee_bps: u32,
    pub expiry_seconds: u64,
    pub dispute_seconds: u64,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PostageStatus {
    Pending,
    Expired,
    Disputed,
    Settled,
    Refunded,
    Reclaimed,
}

#[contracttype]
enum DataKey {
    Config,
    Postage(BytesN<32>),
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidAmount = 3,
    DuplicateMessage = 4,
    PostageNotFound = 5,
    AlreadyResolved = 6,
    InvalidFee = 7,
    InvalidWindow = 8,
    NotExpired = 9,
    DisputeUnavailable = 10,
}

#[contractimpl]
impl PostageContract {
    pub fn initialize(
        env: Env,
        asset: Address,
        treasury: Address,
        minimum: i128,
        fee_bps: u32,
        expiry_seconds: u64,
        dispute_seconds: u64,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Config) {
            return Err(Error::AlreadyInitialized);
        }
        if minimum < 0 {
            return Err(Error::InvalidAmount);
        }
        if fee_bps > 10_000 {
            return Err(Error::InvalidFee);
        }
        if expiry_seconds == 0 {
            return Err(Error::InvalidWindow);
        }

        env.storage().instance().set(
            &DataKey::Config,
            &EscrowConfig {
                asset,
                minimum,
                treasury,
                fee_bps,
                expiry_seconds,
                dispute_seconds,
            },
        );
        Ok(())
    }

    pub fn config(env: Env) -> Result<EscrowConfig, Error> {
        Self::read_config(&env)
    }

    pub fn minimum(env: Env) -> Result<i128, Error> {
        Ok(Self::read_config(&env)?.minimum)
    }

    pub fn quote(env: Env, sender_trusted: bool) -> Result<i128, Error> {
        if sender_trusted {
            return Ok(0);
        }
        Self::minimum(env)
    }

    pub fn submit(
        env: Env,
        message_id: BytesN<32>,
        sender: Address,
        recipient: Address,
        amount: i128,
    ) -> Result<Postage, Error> {
        sender.require_auth();

        let config = Self::read_config(&env)?;
        if amount < config.minimum {
            return Err(Error::InvalidAmount);
        }

        let key = DataKey::Postage(message_id.clone());
        if env.storage().persistent().has(&key) {
            return Err(Error::DuplicateMessage);
        }

        let fee = Self::fee_for(amount, config.fee_bps)?;
        let created_at = env.ledger().timestamp();
        let expires_at = Self::checked_deadline(created_at, config.expiry_seconds)?;
        let dispute_until = Self::checked_deadline(expires_at, config.dispute_seconds)?;

        token::TokenClient::new(&env, &config.asset).transfer(
            &sender,
            &MuxedAddress::from(env.current_contract_address()),
            &amount,
        );

        let postage = Postage {
            sender,
            recipient,
            amount,
            fee,
            created_at,
            expires_at,
            dispute_until,
            status: PostageStatus::Pending,
        };
        env.storage().persistent().set(&key, &postage);
        Self::publish_event(&env, symbol_short!("submit"), message_id, postage.clone());
        Ok(postage)
    }

    pub fn expire(env: Env, message_id: BytesN<32>) -> Result<Postage, Error> {
        let key = DataKey::Postage(message_id.clone());
        let mut postage: Postage = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::PostageNotFound)?;

        if Self::is_terminal(postage.status) {
            return Err(Error::AlreadyResolved);
        }
        if postage.status != PostageStatus::Pending {
            return Err(Error::DisputeUnavailable);
        }
        if env.ledger().timestamp() < postage.expires_at {
            return Err(Error::NotExpired);
        }

        postage.status = PostageStatus::Expired;
        env.storage().persistent().set(&key, &postage);
        Self::publish_event(&env, symbol_short!("expire"), message_id, postage.clone());
        Ok(postage)
    }

    pub fn settle(env: Env, message_id: BytesN<32>) -> Result<Postage, Error> {
        Self::resolve(env, message_id, PostageStatus::Settled)
    }

    pub fn refund(env: Env, message_id: BytesN<32>) -> Result<Postage, Error> {
        Self::resolve(env, message_id, PostageStatus::Refunded)
    }

    pub fn dispute(env: Env, message_id: BytesN<32>) -> Result<Postage, Error> {
        let key = DataKey::Postage(message_id.clone());
        let mut postage: Postage = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::PostageNotFound)?;

        postage.recipient.require_auth();
        if Self::is_terminal(postage.status) {
            return Err(Error::AlreadyResolved);
        }
        if !matches!(
            postage.status,
            PostageStatus::Pending | PostageStatus::Expired
        ) || postage.dispute_until == postage.expires_at
        {
            return Err(Error::DisputeUnavailable);
        }

        let now = env.ledger().timestamp();
        if now < postage.expires_at || now >= postage.dispute_until {
            return Err(Error::DisputeUnavailable);
        }

        postage.status = PostageStatus::Disputed;
        env.storage().persistent().set(&key, &postage);
        Self::publish_event(&env, symbol_short!("dispute"), message_id, postage.clone());
        Ok(postage)
    }

    pub fn reclaim(env: Env, message_id: BytesN<32>) -> Result<Postage, Error> {
        let key = DataKey::Postage(message_id.clone());
        let mut postage: Postage = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::PostageNotFound)?;

        postage.sender.require_auth();
        if Self::is_terminal(postage.status) {
            return Err(Error::AlreadyResolved);
        }

        let reclaimable_at = Self::reclaimable_at(&postage);
        if env.ledger().timestamp() < reclaimable_at {
            return Err(Error::NotExpired);
        }

        let config = Self::read_config(&env)?;
        token::TokenClient::new(&env, &config.asset).transfer(
            &env.current_contract_address(),
            &MuxedAddress::from(postage.sender.clone()),
            &postage.amount,
        );

        postage.status = PostageStatus::Reclaimed;
        env.storage().persistent().set(&key, &postage);
        Self::publish_event(&env, symbol_short!("reclaim"), message_id, postage.clone());
        Ok(postage)
    }

    pub fn get(env: Env, message_id: BytesN<32>) -> Result<Postage, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Postage(message_id))
            .ok_or(Error::PostageNotFound)
    }

    fn resolve(env: Env, message_id: BytesN<32>, status: PostageStatus) -> Result<Postage, Error> {
        let key = DataKey::Postage(message_id.clone());
        let mut postage: Postage = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::PostageNotFound)?;

        postage.recipient.require_auth();
        if Self::is_terminal(postage.status) {
            return Err(Error::AlreadyResolved);
        }
        if env.ledger().timestamp() >= Self::reclaimable_at(&postage) {
            return Err(Error::AlreadyResolved);
        }

        let config = Self::read_config(&env)?;
        let escrow = env.current_contract_address();
        let token = token::TokenClient::new(&env, &config.asset);
        match status {
            PostageStatus::Settled => {
                let recipient_amount = postage.amount - postage.fee;
                if recipient_amount > 0 {
                    token.transfer(
                        &escrow,
                        &MuxedAddress::from(postage.recipient.clone()),
                        &recipient_amount,
                    );
                }
                if postage.fee > 0 {
                    token.transfer(&escrow, &MuxedAddress::from(config.treasury), &postage.fee);
                }
            }
            PostageStatus::Refunded => {
                token.transfer(
                    &escrow,
                    &MuxedAddress::from(postage.sender.clone()),
                    &postage.amount,
                );
            }
            PostageStatus::Pending
            | PostageStatus::Expired
            | PostageStatus::Disputed
            | PostageStatus::Reclaimed => return Err(Error::AlreadyResolved),
        }

        postage.status = status;
        env.storage().persistent().set(&key, &postage);
        Self::publish_event(
            &env,
            Self::status_symbol(status),
            message_id,
            postage.clone(),
        );
        Ok(postage)
    }

    fn read_config(env: &Env) -> Result<EscrowConfig, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(Error::NotInitialized)
    }

    fn checked_deadline(timestamp: u64, seconds: u64) -> Result<u64, Error> {
        timestamp.checked_add(seconds).ok_or(Error::InvalidWindow)
    }

    fn is_terminal(status: PostageStatus) -> bool {
        matches!(
            status,
            PostageStatus::Settled | PostageStatus::Refunded | PostageStatus::Reclaimed
        )
    }

    fn reclaimable_at(postage: &Postage) -> u64 {
        if postage.dispute_until > postage.expires_at {
            postage.dispute_until
        } else {
            postage.expires_at
        }
    }

    fn publish_event(env: &Env, action: Symbol, message_id: BytesN<32>, postage: Postage) {
        PostageEvent {
            action,
            message_id,
            postage,
        }
        .publish(env);
    }

    fn status_symbol(status: PostageStatus) -> Symbol {
        match status {
            PostageStatus::Settled => symbol_short!("settle"),
            PostageStatus::Refunded => symbol_short!("refund"),
            PostageStatus::Reclaimed => symbol_short!("reclaim"),
            PostageStatus::Expired => symbol_short!("expire"),
            PostageStatus::Disputed => symbol_short!("dispute"),
            PostageStatus::Pending => symbol_short!("pending"),
        }
    }

    fn fee_for(amount: i128, fee_bps: u32) -> Result<i128, Error> {
        if amount < 0 {
            return Err(Error::InvalidAmount);
        }
        amount
            .checked_mul(fee_bps as i128)
            .and_then(|gross| gross.checked_div(10_000))
            .ok_or(Error::InvalidAmount)
    }
}

#[cfg(test)]
mod test {
    extern crate std;

    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, AuthorizedFunction, AuthorizedInvocation, Events, Ledger},
        Event, IntoVal,
    };

    fn id(env: &Env, byte: u8) -> BytesN<32> {
        BytesN::from_array(env, &[byte; 32])
    }

    struct Setup {
        env: Env,
        contract_id: Address,
        asset: Address,
        sender: Address,
        recipient: Address,
        treasury: Address,
    }

    fn setup(fee_bps: u32) -> Setup {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().set_timestamp(42);
        env.ledger().set_sequence_number(10);
        let admin = Address::generate(&env);
        let token_contract = env.register_stellar_asset_contract_v2(admin.clone());
        let asset = token_contract.address();
        let token_admin = token::StellarAssetClient::new(&env, &asset);
        let contract_id = env.register(PostageContract, ());
        let client = PostageContractClient::new(&env, &contract_id);
        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let treasury = Address::generate(&env);

        token_admin.mint(&sender, &1_000);
        client.initialize(&asset, &treasury, &100, &fee_bps, &86_400, &3_600);

        Setup {
            env,
            contract_id,
            asset,
            sender,
            recipient,
            treasury,
        }
    }

    #[test]
    fn records_escrows_and_settles_postage() {
        let setup = setup(500);
        let client = PostageContractClient::new(&setup.env, &setup.contract_id);
        let token = token::TokenClient::new(&setup.env, &setup.asset);

        let postage = client.submit(&id(&setup.env, 1), &setup.sender, &setup.recipient, &200);
        assert_eq!(postage.status, PostageStatus::Pending);
        assert_eq!(postage.created_at, 42);
        assert_eq!(postage.expires_at, 86_442);
        assert_eq!(postage.dispute_until, 90_042);
        assert_eq!(postage.fee, 10);
        assert_eq!(token.balance(&setup.sender), 800);
        assert_eq!(token.balance(&setup.contract_id), 200);

        let settled = client.settle(&id(&setup.env, 1));
        assert_eq!(settled.status, PostageStatus::Settled);
        assert_eq!(token.balance(&setup.contract_id), 0);
        assert_eq!(token.balance(&setup.recipient), 190);
        assert_eq!(token.balance(&setup.treasury), 10);
        assert_eq!(
            token.balance(&setup.sender)
                + token.balance(&setup.recipient)
                + token.balance(&setup.treasury)
                + token.balance(&setup.contract_id),
            1_000
        );
    }

    #[test]
    fn refund_returns_full_escrow_to_sender() {
        let setup = setup(250);
        let client = PostageContractClient::new(&setup.env, &setup.contract_id);
        let token = token::TokenClient::new(&setup.env, &setup.asset);

        client.submit(&id(&setup.env, 1), &setup.sender, &setup.recipient, &200);
        let refunded = client.refund(&id(&setup.env, 1));

        assert_eq!(refunded.status, PostageStatus::Refunded);
        assert_eq!(token.balance(&setup.sender), 1_000);
        assert_eq!(token.balance(&setup.recipient), 0);
        assert_eq!(token.balance(&setup.treasury), 0);
        assert_eq!(token.balance(&setup.contract_id), 0);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #6)")]
    fn double_settlement_and_refund_are_impossible() {
        let setup = setup(0);
        let client = PostageContractClient::new(&setup.env, &setup.contract_id);

        client.submit(&id(&setup.env, 1), &setup.sender, &setup.recipient, &125);
        client.settle(&id(&setup.env, 1));
        client.refund(&id(&setup.env, 1));
    }

    #[test]
    fn accepted_asset_and_fee_policy_are_explicit() {
        let setup = setup(125);
        let client = PostageContractClient::new(&setup.env, &setup.contract_id);

        assert_eq!(
            client.config(),
            EscrowConfig {
                asset: setup.asset,
                minimum: 100,
                treasury: setup.treasury,
                fee_bps: 125,
                expiry_seconds: 86_400,
                dispute_seconds: 3_600,
            }
        );
    }

    #[test]
    fn trusted_sender_has_zero_quote() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let asset = env.register_stellar_asset_contract_v2(admin).address();
        let treasury = Address::generate(&env);
        let contract_id = env.register(PostageContract, ());
        let client = PostageContractClient::new(&env, &contract_id);
        client.initialize(&asset, &treasury, &100, &0, &86_400, &0);

        assert_eq!(client.quote(&true), 0);
        assert_eq!(client.quote(&false), 100);
    }

    #[test]
    fn authorization_tree_captures_sender_deposit_and_recipient_resolution() {
        let setup = setup(0);
        let client = PostageContractClient::new(&setup.env, &setup.contract_id);

        client.submit(&id(&setup.env, 1), &setup.sender, &setup.recipient, &125);
        assert_eq!(
            setup.env.auths(),
            [(
                setup.sender.clone(),
                AuthorizedInvocation {
                    function: AuthorizedFunction::Contract((
                        setup.contract_id.clone(),
                        symbol_short!("submit"),
                        (
                            id(&setup.env, 1),
                            setup.sender.clone(),
                            setup.recipient.clone(),
                            125_i128,
                        )
                            .into_val(&setup.env),
                    )),
                    sub_invocations: [AuthorizedInvocation {
                        function: AuthorizedFunction::Contract((
                            setup.asset.clone(),
                            symbol_short!("transfer"),
                            (
                                setup.sender.clone(),
                                MuxedAddress::from(setup.contract_id.clone()),
                                125_i128,
                            )
                                .into_val(&setup.env),
                        )),
                        sub_invocations: [].into(),
                    }]
                    .into(),
                }
            )]
        );

        client.settle(&id(&setup.env, 1));
        assert_eq!(
            setup.env.auths(),
            [(
                setup.recipient.clone(),
                AuthorizedInvocation {
                    function: AuthorizedFunction::Contract((
                        setup.contract_id.clone(),
                        symbol_short!("settle"),
                        (id(&setup.env, 1),).into_val(&setup.env),
                    )),
                    sub_invocations: [].into(),
                }
            )]
        );
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #9)")]
    fn reclaim_fails_before_expiry() {
        let setup = setup(0);
        let client = PostageContractClient::new(&setup.env, &setup.contract_id);

        client.submit(&id(&setup.env, 1), &setup.sender, &setup.recipient, &125);
        setup.env.ledger().set_timestamp(86_441);
        client.reclaim(&id(&setup.env, 1));
    }

    #[test]
    fn reclaim_succeeds_at_expiry_when_dispute_window_is_disabled() {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().set_timestamp(10);
        let admin = Address::generate(&env);
        let token_contract = env.register_stellar_asset_contract_v2(admin.clone());
        let asset = token_contract.address();
        let token_admin = token::StellarAssetClient::new(&env, &asset);
        let contract_id = env.register(PostageContract, ());
        let client = PostageContractClient::new(&env, &contract_id);
        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let treasury = Address::generate(&env);
        let token = token::TokenClient::new(&env, &asset);

        token_admin.mint(&sender, &1_000);
        client.initialize(&asset, &treasury, &100, &0, &30, &0);
        let postage = client.submit(&id(&env, 1), &sender, &recipient, &125);
        assert_eq!(postage.expires_at, 40);
        assert_eq!(postage.dispute_until, 40);

        env.ledger().set_timestamp(40);
        let reclaimed = client.reclaim(&id(&env, 1));

        assert_eq!(reclaimed.status, PostageStatus::Reclaimed);
        assert_eq!(token.balance(&sender), 1_000);
        assert_eq!(token.balance(&contract_id), 0);
    }

    #[test]
    fn expiry_state_is_fixed_and_callable_at_boundary() {
        let setup = setup(0);
        let client = PostageContractClient::new(&setup.env, &setup.contract_id);

        let postage = client.submit(&id(&setup.env, 1), &setup.sender, &setup.recipient, &125);
        assert_eq!(postage.expires_at, 86_442);

        setup.env.ledger().set_timestamp(86_441);
        assert_eq!(
            client.try_expire(&id(&setup.env, 1)),
            Err(Ok(Error::NotExpired))
        );

        setup.env.ledger().set_timestamp(86_442);
        let expired = client.expire(&id(&setup.env, 1));
        assert_eq!(expired.status, PostageStatus::Expired);
        assert_eq!(expired.expires_at, 86_442);
        assert_eq!(expired.dispute_until, 90_042);
    }

    #[test]
    fn dispute_window_blocks_reclaim_until_boundary() {
        let setup = setup(0);
        let client = PostageContractClient::new(&setup.env, &setup.contract_id);
        let token = token::TokenClient::new(&setup.env, &setup.asset);

        client.submit(&id(&setup.env, 1), &setup.sender, &setup.recipient, &125);
        setup.env.ledger().set_timestamp(86_442);
        let disputed = client.dispute(&id(&setup.env, 1));
        assert_eq!(disputed.status, PostageStatus::Disputed);

        setup.env.ledger().set_timestamp(90_041);
        assert_eq!(
            client.try_reclaim(&id(&setup.env, 1)),
            Err(Ok(Error::NotExpired))
        );

        setup.env.ledger().set_timestamp(90_042);
        let reclaimed = client.reclaim(&id(&setup.env, 1));
        assert_eq!(reclaimed.status, PostageStatus::Reclaimed);
        assert_eq!(token.balance(&setup.sender), 1_000);
        assert_eq!(token.balance(&setup.contract_id), 0);
    }

    #[test]
    fn expired_postage_can_be_disputed_or_reclaimed() {
        let setup = setup(0);
        let client = PostageContractClient::new(&setup.env, &setup.contract_id);
        let token = token::TokenClient::new(&setup.env, &setup.asset);

        client.submit(&id(&setup.env, 1), &setup.sender, &setup.recipient, &125);
        client.submit(&id(&setup.env, 2), &setup.sender, &setup.recipient, &125);
        setup.env.ledger().set_timestamp(86_442);
        client.expire(&id(&setup.env, 1));
        let disputed = client.dispute(&id(&setup.env, 1));
        assert_eq!(disputed.status, PostageStatus::Disputed);

        setup.env.ledger().set_timestamp(90_042);
        client.expire(&id(&setup.env, 2));
        let reclaimed = client.reclaim(&id(&setup.env, 2));
        assert_eq!(reclaimed.status, PostageStatus::Reclaimed);
        assert_eq!(token.balance(&setup.contract_id), 125);
    }

    #[test]
    fn expiry_and_reclaim_emit_typed_events() {
        let setup = setup(0);
        let client = PostageContractClient::new(&setup.env, &setup.contract_id);
        let message_id = id(&setup.env, 1);

        client.submit(&message_id, &setup.sender, &setup.recipient, &125);
        setup.env.ledger().set_timestamp(90_042);

        let expired = client.expire(&message_id);
        assert_eq!(
            setup
                .env
                .events()
                .all()
                .filter_by_contract(&setup.contract_id),
            std::vec![PostageEvent {
                action: symbol_short!("expire"),
                message_id: message_id.clone(),
                postage: expired,
            }
            .to_xdr(&setup.env, &setup.contract_id)]
        );

        let reclaimed = client.reclaim(&message_id);
        assert_eq!(
            setup
                .env
                .events()
                .all()
                .filter_by_contract(&setup.contract_id),
            std::vec![PostageEvent {
                action: symbol_short!("reclaim"),
                message_id,
                postage: reclaimed,
            }
            .to_xdr(&setup.env, &setup.contract_id)]
        );
    }

    #[test]
    fn dispute_fails_at_dispute_deadline() {
        let setup = setup(0);
        let client = PostageContractClient::new(&setup.env, &setup.contract_id);

        client.submit(&id(&setup.env, 1), &setup.sender, &setup.recipient, &125);
        setup.env.ledger().set_timestamp(90_042);

        assert_eq!(
            client.try_dispute(&id(&setup.env, 1)),
            Err(Ok(Error::DisputeUnavailable))
        );
    }

    #[test]
    fn disputed_postage_can_be_refunded_before_deadline() {
        let setup = setup(0);
        let client = PostageContractClient::new(&setup.env, &setup.contract_id);
        let token = token::TokenClient::new(&setup.env, &setup.asset);

        client.submit(&id(&setup.env, 1), &setup.sender, &setup.recipient, &125);
        setup.env.ledger().set_timestamp(86_442);
        client.dispute(&id(&setup.env, 1));
        setup.env.ledger().set_timestamp(90_041);
        let refunded = client.refund(&id(&setup.env, 1));

        assert_eq!(refunded.status, PostageStatus::Refunded);
        assert_eq!(token.balance(&setup.sender), 1_000);
        assert_eq!(token.balance(&setup.contract_id), 0);
    }

    #[test]
    fn recipient_resolution_fails_at_reclaim_boundary() {
        let setup = setup(0);
        let client = PostageContractClient::new(&setup.env, &setup.contract_id);

        client.submit(&id(&setup.env, 1), &setup.sender, &setup.recipient, &125);
        client.submit(&id(&setup.env, 2), &setup.sender, &setup.recipient, &125);
        setup.env.ledger().set_timestamp(90_041);
        assert_eq!(
            client.settle(&id(&setup.env, 1)).status,
            PostageStatus::Settled
        );

        setup.env.ledger().set_timestamp(90_042);
        assert_eq!(
            client.try_refund(&id(&setup.env, 2)),
            Err(Ok(Error::AlreadyResolved))
        );
        assert_eq!(
            client.try_settle(&id(&setup.env, 2)),
            Err(Ok(Error::AlreadyResolved))
        );
    }

    #[test]
    fn terminal_states_cannot_transition() {
        let setup = setup(0);
        let client = PostageContractClient::new(&setup.env, &setup.contract_id);

        client.submit(&id(&setup.env, 1), &setup.sender, &setup.recipient, &125);
        setup.env.ledger().set_timestamp(90_042);
        client.reclaim(&id(&setup.env, 1));

        assert_eq!(
            client.try_settle(&id(&setup.env, 1)),
            Err(Ok(Error::AlreadyResolved))
        );
        assert_eq!(
            client.try_refund(&id(&setup.env, 1)),
            Err(Ok(Error::AlreadyResolved))
        );
        assert_eq!(
            client.try_dispute(&id(&setup.env, 1)),
            Err(Ok(Error::AlreadyResolved))
        );
        assert_eq!(
            client.try_expire(&id(&setup.env, 1)),
            Err(Ok(Error::AlreadyResolved))
        );

        client.submit(&id(&setup.env, 2), &setup.sender, &setup.recipient, &125);
        client.refund(&id(&setup.env, 2));
        assert_eq!(
            client.try_reclaim(&id(&setup.env, 2)),
            Err(Ok(Error::AlreadyResolved))
        );

        client.submit(&id(&setup.env, 3), &setup.sender, &setup.recipient, &125);
        client.settle(&id(&setup.env, 3));
        assert_eq!(
            client.try_dispute(&id(&setup.env, 3)),
            Err(Ok(Error::AlreadyResolved))
        );
    }
}
