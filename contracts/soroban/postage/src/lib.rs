#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, BytesN, Env,
    MuxedAddress,
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
    pub status: PostageStatus,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowConfig {
    pub asset: Address,
    pub minimum: i128,
    pub treasury: Address,
    pub fee_bps: u32,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PostageStatus {
    Pending,
    Settled,
    Refunded,
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
}

#[contractimpl]
impl PostageContract {
    pub fn initialize(
        env: Env,
        asset: Address,
        treasury: Address,
        minimum: i128,
        fee_bps: u32,
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

        env.storage().instance().set(
            &DataKey::Config,
            &EscrowConfig {
                asset,
                minimum,
                treasury,
                fee_bps,
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
            created_at: env.ledger().timestamp(),
            status: PostageStatus::Pending,
        };
        env.storage().persistent().set(&key, &postage);
        env.events()
            .publish((symbol_short!("postage"), message_id), postage.clone());
        Ok(postage)
    }

    pub fn settle(env: Env, message_id: BytesN<32>) -> Result<Postage, Error> {
        Self::resolve(env, message_id, PostageStatus::Settled)
    }

    pub fn refund(env: Env, message_id: BytesN<32>) -> Result<Postage, Error> {
        Self::resolve(env, message_id, PostageStatus::Refunded)
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
        if postage.status != PostageStatus::Pending {
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
            PostageStatus::Pending => return Err(Error::AlreadyResolved),
        }

        postage.status = status;
        env.storage().persistent().set(&key, &postage);
        env.events()
            .publish((symbol_short!("resolved"), message_id), postage.clone());
        Ok(postage)
    }

    fn read_config(env: &Env) -> Result<EscrowConfig, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(Error::NotInitialized)
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
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, AuthorizedFunction, AuthorizedInvocation, Ledger},
        IntoVal,
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
        client.initialize(&asset, &treasury, &100, &fee_bps);

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
        client.initialize(&asset, &treasury, &100, &0);

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
}
