#![no_std]

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype, Address,
    BytesN, Env,
};

#[contract]
pub struct ReceiptsContract;

mod lifecycle_guard {
    use super::*;

    #[contracttype]
    #[derive(Clone, Copy, Debug, Eq, PartialEq)]
    pub enum PolicyReason {
        SenderAllowed,
        SenderBlocked,
        UnknownSendersDisabled,
        VerificationRequired,
        ReceiptRequired,
        InsufficientPostage,
        PolicySatisfied,
        TierSatisfied,
    }

    #[contracttype]
    #[derive(Clone, Copy, Debug, Eq, PartialEq)]
    pub enum LifecycleTerminal {
        Open,
        Delivered,
        Read,
        Settled,
        Refunded,
        Disputed,
        Expired,
        Reclaimed,
    }

    #[contracttype]
    #[derive(Clone, Debug, Eq, PartialEq)]
    pub struct LifecycleRecord {
        pub message_id: BytesN<32>,
        pub owner: Address,
        pub sender: Address,
        pub recipient: Address,
        pub amount: i128,
        pub verified: bool,
        pub receipt_required: bool,
        pub policy_version: u32,
        pub decision_reason: PolicyReason,
        pub payload_hash: Option<BytesN<32>>,
        pub protocol_version: Option<u32>,
        pub delivered_at: Option<u64>,
        pub read_at: Option<u64>,
        pub terminal: LifecycleTerminal,
        pub bound_at: u64,
    }

    #[contracttype]
    #[derive(Clone, Debug, Eq, PartialEq)]
    pub struct ReceiptState {
        pub message_id: BytesN<32>,
        pub payload_hash: BytesN<32>,
        pub protocol_version: u32,
        pub sender: Address,
        pub recipient: Address,
        pub delivered_at: u64,
        pub read_at: Option<u64>,
    }

    #[contracterror]
    #[derive(Clone, Copy, Debug, Eq, PartialEq)]
    #[repr(u32)]
    pub enum LifecycleError {
        AlreadyInitialized = 1,
        NotInitialized = 2,
        UnauthorizedContract = 3,
        PolicyRejected = 4,
        PolicyVersionMismatch = 5,
        PostageMismatch = 6,
        ReceiptMismatch = 7,
        MissingLifecycle = 8,
        TerminalStateMismatch = 9,
        DuplicateLifecycle = 10,
        AlreadyDelivered = 11,
        AlreadyRead = 12,
    }

    #[contractclient(name = "LifecycleContractClient")]
    pub trait LifecycleContractInterface {
        fn verify_delivered(
            message_id: BytesN<32>,
            receipt: ReceiptState,
        ) -> Result<LifecycleRecord, LifecycleError>;
        fn verify_read(
            message_id: BytesN<32>,
            receipt: ReceiptState,
        ) -> Result<LifecycleRecord, LifecycleError>;
    }
}

use lifecycle_guard::{LifecycleContractClient, ReceiptState as LifecycleReceiptState};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Receipt {
    pub message_id: BytesN<32>,
    pub payload_hash: BytesN<32>,
    pub protocol_version: u32,
    pub sender: Address,
    pub recipient: Address,
    pub delivered_at: u64,
    pub read_at: Option<u64>,
}

#[contractevent(data_format = "single-value")]
pub struct Delivered {
    #[topic]
    pub message_id: BytesN<32>,
    pub receipt: Receipt,
}

#[contractevent(data_format = "single-value")]
pub struct Read {
    #[topic]
    pub message_id: BytesN<32>,
    pub receipt: Receipt,
}

#[contracttype]
enum DataKey {
    Guard,
    Receipt(BytesN<32>),
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    DuplicateReceipt = 1,
    ReceiptNotFound = 2,
    AlreadyRead = 3,
    CommitmentMismatch = 4,
    GuardNotConfigured = 5,
    GuardAlreadyConfigured = 6,
    LifecycleRejected = 7,
}

#[contractimpl]
impl ReceiptsContract {
    pub fn configure_guard(env: Env, guard: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Guard) {
            return Err(Error::GuardAlreadyConfigured);
        }
        env.storage().instance().set(&DataKey::Guard, &guard);
        Ok(())
    }

    pub fn guard(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Guard)
            .ok_or(Error::GuardNotConfigured)
    }

    pub fn delivered(
        env: Env,
        message_id: BytesN<32>,
        payload_hash: BytesN<32>,
        protocol_version: u32,
        sender: Address,
        recipient: Address,
    ) -> Result<Receipt, Error> {
        sender.require_auth();
        let key = DataKey::Receipt(message_id.clone());
        if let Some(existing) = env.storage().persistent().get::<DataKey, Receipt>(&key) {
            if existing.payload_hash != payload_hash
                || existing.protocol_version != protocol_version
                || existing.sender != sender
                || existing.recipient != recipient
            {
                return Err(Error::CommitmentMismatch);
            }
            return Err(Error::DuplicateReceipt);
        }

        Self::verify_guard(
            &env,
            message_id.clone(),
            &Receipt {
                message_id: message_id.clone(),
                payload_hash: payload_hash.clone(),
                protocol_version,
                sender: sender.clone(),
                recipient: recipient.clone(),
                delivered_at: env.ledger().timestamp(),
                read_at: None,
            },
        )?;

        let receipt = Receipt {
            message_id: message_id.clone(),
            payload_hash,
            protocol_version,
            sender,
            recipient,
            delivered_at: env.ledger().timestamp(),
            read_at: None,
        };
        env.storage().persistent().set(&key, &receipt);
        Delivered {
            message_id,
            receipt: receipt.clone(),
        }
        .publish(&env);
        Ok(receipt)
    }

    pub fn read(env: Env, message_id: BytesN<32>) -> Result<Receipt, Error> {
        let key = DataKey::Receipt(message_id.clone());
        let mut receipt: Receipt = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::ReceiptNotFound)?;

        receipt.recipient.require_auth();
        if receipt.read_at.is_some() {
            return Err(Error::AlreadyRead);
        }

        let read_at = env.ledger().timestamp();
        let mut lifecycle_receipt = receipt.clone();
        lifecycle_receipt.read_at = Some(read_at);
        Self::verify_guard(&env, message_id.clone(), &lifecycle_receipt)?;

        receipt.read_at = Some(read_at);
        env.storage().persistent().set(&key, &receipt);
        Read {
            message_id,
            receipt: receipt.clone(),
        }
        .publish(&env);
        Ok(receipt)
    }

    pub fn get(env: Env, message_id: BytesN<32>) -> Result<Receipt, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Receipt(message_id))
            .ok_or(Error::ReceiptNotFound)
    }

    fn verify_guard(env: &Env, message_id: BytesN<32>, receipt: &Receipt) -> Result<(), Error> {
        let guard = env
            .storage()
            .instance()
            .get(&DataKey::Guard)
            .ok_or(Error::GuardNotConfigured)?;
        let lifecycle_receipt = LifecycleReceiptState {
            message_id: receipt.message_id.clone(),
            payload_hash: receipt.payload_hash.clone(),
            protocol_version: receipt.protocol_version,
            sender: receipt.sender.clone(),
            recipient: receipt.recipient.clone(),
            delivered_at: receipt.delivered_at,
            read_at: receipt.read_at,
        };
        let result = if receipt.read_at.is_some() {
            LifecycleContractClient::new(env, &guard).try_verify_read(&message_id, &lifecycle_receipt)
        } else {
            LifecycleContractClient::new(env, &guard)
                .try_verify_delivered(&message_id, &lifecycle_receipt)
        };

        match result {
            Ok(Ok(_)) => Ok(()),
            Ok(Err(_)) | Err(_) => Err(Error::LifecycleRejected),
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, AuthorizedFunction, AuthorizedInvocation, Ledger},
        symbol_short, IntoVal,
    };
    use stealth_lifecycle::{LifecycleContract, LifecycleContractClient};
    use stealth_policies::{MailboxPolicy, PoliciesContract, PoliciesContractClient};

    fn hash(env: &Env, byte: u8) -> BytesN<32> {
        BytesN::from_array(env, &[byte; 32])
    }

    fn configure_lifecycle(
        env: &Env,
        receipts: &Address,
        message_id: &BytesN<32>,
        sender: &Address,
        recipient: &Address,
    ) {
        let policies = env.register(PoliciesContract, ());
        let policies_client = PoliciesContractClient::new(env, &policies);
        policies_client.set_policy(
            &recipient.clone(),
            &MailboxPolicy {
                allow_unknown: true,
                require_verified: false,
                require_receipt: false,
                minimum_postage: 0,
            },
        );

        let postage = Address::generate(env);
        let lifecycle = env.register(LifecycleContract, ());
        let lifecycle_client = LifecycleContractClient::new(env, &lifecycle);
        lifecycle_client.initialize(&policies, &postage, receipts);
        ReceiptsContractClient::new(env, receipts).configure_guard(&lifecycle);
        lifecycle_client.bind(
            message_id,
            &recipient.clone(),
            &sender.clone(),
            &recipient.clone(),
            &0_i128,
            &false,
            &true,
        );
    }

    #[test]
    fn delivery_receipt_commits_payload_and_protocol() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(ReceiptsContract, ());
        let client = ReceiptsContractClient::new(&env, &contract_id);
        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let message_id = hash(&env, 7);
        let payload_hash = hash(&env, 8);
        configure_lifecycle(&env, &contract_id, &message_id, &sender, &recipient);

        env.ledger().set_timestamp(10);
        let delivered = client.delivered(&message_id, &payload_hash, &1, &sender, &recipient);
        assert_eq!(delivered.message_id, message_id);
        assert_eq!(delivered.payload_hash, payload_hash);
        assert_eq!(delivered.protocol_version, 1);
        assert_eq!(delivered.sender, sender);
        assert_eq!(delivered.recipient, recipient);
        assert_eq!(delivered.delivered_at, 10);
        assert_eq!(delivered.read_at, None);

        let fetched = client.get(&message_id);
        assert_eq!(fetched, delivered);
    }

    #[test]
    fn duplicate_id_with_different_payload_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(ReceiptsContract, ());
        let client = ReceiptsContractClient::new(&env, &contract_id);
        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let message_id = hash(&env, 7);
        configure_lifecycle(&env, &contract_id, &message_id, &sender, &recipient);

        client.delivered(&message_id, &hash(&env, 8), &1, &sender, &recipient);
        assert_eq!(
            client
                .try_delivered(&message_id, &hash(&env, 9), &1, &sender, &recipient)
                .unwrap_err()
                .unwrap(),
            Error::CommitmentMismatch
        );
    }

    #[test]
    fn duplicate_id_with_same_commitment_still_cannot_overwrite() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(ReceiptsContract, ());
        let client = ReceiptsContractClient::new(&env, &contract_id);
        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let message_id = hash(&env, 7);
        let payload_hash = hash(&env, 8);
        configure_lifecycle(&env, &contract_id, &message_id, &sender, &recipient);

        client.delivered(&message_id, &payload_hash, &1, &sender, &recipient);
        assert_eq!(
            client
                .try_delivered(&message_id, &payload_hash, &1, &sender, &recipient)
                .unwrap_err()
                .unwrap(),
            Error::DuplicateReceipt
        );
    }

    #[test]
    fn recipient_can_publish_read_receipt() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(ReceiptsContract, ());
        let client = ReceiptsContractClient::new(&env, &contract_id);
        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let message_id = hash(&env, 7);
        let payload_hash = hash(&env, 8);
        configure_lifecycle(&env, &contract_id, &message_id, &sender, &recipient);

        env.ledger().set_timestamp(10);
        client.delivered(&message_id, &payload_hash, &1, &sender, &recipient);

        env.ledger().set_timestamp(20);
        let read = client.read(&message_id);
        assert_eq!(read.payload_hash, payload_hash);
        assert_eq!(read.read_at, Some(20));
    }

    #[test]
    fn authorization_tree_binds_delivery_to_sender_and_read_to_recipient() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(ReceiptsContract, ());
        let client = ReceiptsContractClient::new(&env, &contract_id);
        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let message_id = hash(&env, 7);
        let payload_hash = hash(&env, 8);
        configure_lifecycle(&env, &contract_id, &message_id, &sender, &recipient);

        client.delivered(&message_id, &payload_hash, &1, &sender, &recipient);
        assert_eq!(
            env.auths(),
            [(
                sender.clone(),
                AuthorizedInvocation {
                    function: AuthorizedFunction::Contract((
                        contract_id.clone(),
                        symbol_short!("delivered"),
                        (
                            message_id.clone(),
                            payload_hash.clone(),
                            1_u32,
                            sender.clone(),
                            recipient.clone(),
                        )
                            .into_val(&env),
                    )),
                    sub_invocations: [].into(),
                }
            )]
        );

        client.read(&message_id);
        assert_eq!(
            env.auths(),
            [(
                recipient.clone(),
                AuthorizedInvocation {
                    function: AuthorizedFunction::Contract((
                        contract_id,
                        symbol_short!("read"),
                        (message_id,).into_val(&env),
                    )),
                    sub_invocations: [].into(),
                }
            )]
        );
    }
}
