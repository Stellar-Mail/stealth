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
    /// Configures the contract guard (e.g. the Lifecycle contract) that verifies
    /// receipt operations. This is a one-time configuration (first-write-wins).
    ///
    /// # Errors
    /// Returns `Error::GuardAlreadyConfigured` if a guard is already set.
    pub fn configure_guard(env: Env, guard: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Guard) {
            return Err(Error::GuardAlreadyConfigured);
        }
        env.storage().instance().set(&DataKey::Guard, &guard);
        Ok(())
    }

    /// Returns the currently configured guard address.
    ///
    /// # Errors
    /// Returns `Error::GuardNotConfigured` if no guard has been set.
    pub fn guard(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Guard)
            .ok_or(Error::GuardNotConfigured)
    }

    /// Records a delivery receipt for a message, registering its payload hash,
    /// protocol version, sender, and recipient. The sender must authorize this action.
    ///
    /// # Errors
    /// - `Error::DuplicateReceipt` if a matching receipt already exists.
    /// - `Error::CommitmentMismatch` if a receipt exists but with different parameters.
    /// - `Error::GuardNotConfigured` if no guard has been configured.
    /// - `Error::LifecycleRejected` if the guard contract rejects verification.
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

    /// Marks an existing delivery receipt as read. The recipient must authorize this action.
    ///
    /// # Errors
    /// - `Error::ReceiptNotFound` if no receipt exists for the given message ID.
    /// - `Error::AlreadyRead` if the receipt was already marked as read.
    /// - `Error::GuardNotConfigured` if no guard has been configured.
    /// - `Error::LifecycleRejected` if the guard contract rejects verification.
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

    /// Retrieves the stored receipt for the given message ID.
    ///
    /// # Errors
    /// Returns `Error::ReceiptNotFound` if no receipt exists.
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
            LifecycleContractClient::new(env, &guard)
                .try_verify_read(&message_id, &lifecycle_receipt)
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
        symbol_short,
        testutils::{
            Address as _, AuthorizedFunction, AuthorizedInvocation, Ledger, MockAuth,
            MockAuthInvoke,
        },
        IntoVal,
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

    #[test]
    fn delivered_fails_without_sender_authorization() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(ReceiptsContract, ());
        let client = ReceiptsContractClient::new(&env, &contract_id);
        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let message_id = hash(&env, 7);
        configure_lifecycle(&env, &contract_id, &message_id, &sender, &recipient);

        env.set_auths(&[]);
        assert!(client
            .try_delivered(&message_id, &hash(&env, 8), &1, &sender, &recipient)
            .is_err());

        env.mock_all_auths();
        assert_eq!(
            client.try_get(&message_id).unwrap_err().unwrap(),
            Error::ReceiptNotFound
        );
    }

    #[test]
    fn delivered_fails_when_only_recipient_authorizes() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(ReceiptsContract, ());
        let client = ReceiptsContractClient::new(&env, &contract_id);
        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let message_id = hash(&env, 7);
        let payload_hash = hash(&env, 8);
        configure_lifecycle(&env, &contract_id, &message_id, &sender, &recipient);

        env.mock_auths(&[MockAuth {
            address: &recipient,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "delivered",
                args: (
                    message_id.clone(),
                    payload_hash.clone(),
                    1_u32,
                    sender.clone(),
                    recipient.clone(),
                )
                    .into_val(&env),
                sub_invokes: &[],
            },
        }]);
        assert!(client
            .try_delivered(&message_id, &payload_hash, &1, &sender, &recipient)
            .is_err());
    }

    #[test]
    fn delivered_authorization_is_bound_to_exact_arguments() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(ReceiptsContract, ());
        let client = ReceiptsContractClient::new(&env, &contract_id);
        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let message_id = hash(&env, 7);
        let payload_hash = hash(&env, 8);
        configure_lifecycle(&env, &contract_id, &message_id, &sender, &recipient);

        // The sender signed a commitment to payload hash 8; a relay cannot
        // reuse that signature to record a different payload hash.
        env.mock_auths(&[MockAuth {
            address: &sender,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "delivered",
                args: (
                    message_id.clone(),
                    payload_hash.clone(),
                    1_u32,
                    sender.clone(),
                    recipient.clone(),
                )
                    .into_val(&env),
                sub_invokes: &[],
            },
        }]);
        assert!(client
            .try_delivered(&message_id, &hash(&env, 9), &1, &sender, &recipient)
            .is_err());
    }

    #[test]
    fn read_fails_without_recipient_authorization() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(ReceiptsContract, ());
        let client = ReceiptsContractClient::new(&env, &contract_id);
        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let message_id = hash(&env, 7);
        configure_lifecycle(&env, &contract_id, &message_id, &sender, &recipient);
        client.delivered(&message_id, &hash(&env, 8), &1, &sender, &recipient);

        env.set_auths(&[]);
        assert!(client.try_read(&message_id).is_err());

        env.mock_all_auths();
        assert_eq!(client.get(&message_id).read_at, None);
    }

    #[test]
    fn read_fails_when_sender_authorizes_instead_of_recipient() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(ReceiptsContract, ());
        let client = ReceiptsContractClient::new(&env, &contract_id);
        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let message_id = hash(&env, 7);
        configure_lifecycle(&env, &contract_id, &message_id, &sender, &recipient);
        client.delivered(&message_id, &hash(&env, 8), &1, &sender, &recipient);

        // The read authorizer comes from stored receipt state, not from the
        // caller, so the sender cannot forge a read acknowledgement.
        env.mock_auths(&[MockAuth {
            address: &sender,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "read",
                args: (message_id.clone(),).into_val(&env),
                sub_invokes: &[],
            },
        }]);
        assert!(client.try_read(&message_id).is_err());

        env.mock_all_auths();
        assert_eq!(client.get(&message_id).read_at, None);
    }

    #[test]
    fn read_of_unknown_message_fails_without_needing_authorization() {
        let env = Env::default();
        let contract_id = env.register(ReceiptsContract, ());
        let client = ReceiptsContractClient::new(&env, &contract_id);

        env.set_auths(&[]);
        assert_eq!(
            client.try_read(&hash(&env, 7)).unwrap_err().unwrap(),
            Error::ReceiptNotFound
        );
    }

    #[test]
    fn get_is_public_and_requires_no_authorization() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(ReceiptsContract, ());
        let client = ReceiptsContractClient::new(&env, &contract_id);
        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let message_id = hash(&env, 7);
        configure_lifecycle(&env, &contract_id, &message_id, &sender, &recipient);
        client.delivered(&message_id, &hash(&env, 8), &1, &sender, &recipient);

        env.set_auths(&[]);
        let fetched = client.get(&message_id);
        assert_eq!(fetched.message_id, message_id);
        assert_eq!(env.auths(), []);
    }

    #[test]
    fn configure_guard_is_first_write_wins_and_immutable() {
        let env = Env::default();
        let contract_id = env.register(ReceiptsContract, ());
        let client = ReceiptsContractClient::new(&env, &contract_id);
        let guard = Address::generate(&env);
        let attacker_guard = Address::generate(&env);

        client.configure_guard(&guard);
        assert_eq!(
            client
                .try_configure_guard(&attacker_guard)
                .unwrap_err()
                .unwrap(),
            Error::GuardAlreadyConfigured
        );
        assert_eq!(client.guard(), guard);
    }

    #[test]
    fn delivered_fails_before_guard_is_configured() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(ReceiptsContract, ());
        let client = ReceiptsContractClient::new(&env, &contract_id);
        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let message_id = hash(&env, 7);

        assert_eq!(
            client
                .try_delivered(&message_id, &hash(&env, 8), &1, &sender, &recipient)
                .unwrap_err()
                .unwrap(),
            Error::GuardNotConfigured
        );
    }
}

#[cfg(test)]
mod event_schema {
    // Event schema pinning tests.
    //
    // Off-chain consumers (relays, indexers, clients) filter and decode these
    // events straight from the ledger, so their wire format is a public
    // contract. These tests pin the exact topic vector and data payload; any
    // change to the event structs, topic layout, or data format fails here
    // before it can silently break integrators. The schema is documented in
    // docs/events.md.
    extern crate std;

    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Events, Ledger},
        xdr::{ContractEventBody, ScSymbol, ScVal},
        Event as _,
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
    fn delivered_and_read_emit_schema_stable_events() {
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
        assert_eq!(
            env.events().all().filter_by_contract(&contract_id),
            std::vec![Delivered {
                message_id: message_id.clone(),
                receipt: delivered,
            }
            .to_xdr(&env, &contract_id)]
        );

        env.ledger().set_timestamp(20);
        let read = client.read(&message_id);
        assert_eq!(
            env.events().all().filter_by_contract(&contract_id),
            std::vec![Read {
                message_id: message_id.clone(),
                receipt: read,
            }
            .to_xdr(&env, &contract_id)]
        );
    }

    #[test]
    fn delivered_event_wire_format_is_pinned() {
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
        let receipt = client.delivered(&message_id, &payload_hash, &1, &sender, &recipient);

        let filtered = env.events().all().filter_by_contract(&contract_id);
        let events = filtered.events();
        assert_eq!(events.len(), 1);
        let ContractEventBody::V0(body) = &events[0].body;

        // Topics: [symbol "delivered", message_id]. The event-name symbol is
        // derived from the struct name; the message id is the only #[topic]
        // field, so consumers can filter by message without decoding data.
        assert_eq!(body.topics.len(), 2);
        assert_eq!(
            body.topics[0],
            ScVal::Symbol(ScSymbol("delivered".try_into().unwrap()))
        );
        assert_eq!(
            body.topics[1],
            ScVal::Bytes(message_id.to_array().to_vec().try_into().unwrap())
        );

        // Data: the Receipt struct as a bare value (data_format =
        // "single-value"), an ScMap with field names as symbol keys sorted
        // alphabetically per SCMap canonical ordering.
        let ScVal::Map(Some(map)) = &body.data else {
            std::panic!("event data must be a single map value, got {:?}", body.data);
        };
        let keys: std::vec::Vec<std::string::String> = map
            .iter()
            .map(|entry| match &entry.key {
                ScVal::Symbol(symbol) => symbol.to_utf8_string_lossy(),
                other => std::panic!("map keys must be symbols, got {other:?}"),
            })
            .collect();
        assert_eq!(
            keys,
            std::vec![
                "delivered_at",
                "message_id",
                "payload_hash",
                "protocol_version",
                "read_at",
                "recipient",
                "sender",
            ]
        );
        assert_eq!(map.len(), 7);
        assert_eq!(receipt.delivered_at, 10);
    }

    #[test]
    fn read_event_reuses_the_delivered_topic_shape() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(ReceiptsContract, ());
        let client = ReceiptsContractClient::new(&env, &contract_id);
        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let message_id = hash(&env, 7);
        configure_lifecycle(&env, &contract_id, &message_id, &sender, &recipient);

        client.delivered(&message_id, &hash(&env, 8), &1, &sender, &recipient);
        env.ledger().set_timestamp(20);
        client.read(&message_id);

        let filtered = env.events().all().filter_by_contract(&contract_id);
        let events = filtered.events();
        assert_eq!(events.len(), 1);
        let ContractEventBody::V0(body) = &events[0].body;
        assert_eq!(body.topics.len(), 2);
        assert_eq!(
            body.topics[0],
            ScVal::Symbol(ScSymbol("read".try_into().unwrap()))
        );
        // read_at is set in the event payload, so consumers never observe a
        // read event whose receipt still looks undelivered.
        let ScVal::Map(Some(map)) = &body.data else {
            std::panic!("event data must be a single map value");
        };
        let read_at = map
            .iter()
            .find(|entry| entry.key == ScVal::Symbol(ScSymbol("read_at".try_into().unwrap())))
            .expect("read_at key present");
        assert_ne!(read_at.val, ScVal::Void);
    }

    #[test]
    fn failed_calls_emit_no_events() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(ReceiptsContract, ());
        let client = ReceiptsContractClient::new(&env, &contract_id);
        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let message_id = hash(&env, 7);

        // Guard not configured: delivered fails and publishes nothing.
        assert!(client
            .try_delivered(&message_id, &hash(&env, 8), &1, &sender, &recipient)
            .is_err());
        assert_eq!(
            env.events()
                .all()
                .filter_by_contract(&contract_id)
                .events()
                .len(),
            0
        );

        // Unknown message: read fails and publishes nothing.
        assert!(client.try_read(&hash(&env, 9)).is_err());
        assert_eq!(
            env.events()
                .all()
                .filter_by_contract(&contract_id)
                .events()
                .len(),
            0
        );
    }
}

#[cfg(test)]
mod proptests {
    use super::*;
    use proptest::prelude::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        Env,
    };
    use stealth_lifecycle::{LifecycleContract, LifecycleContractClient};
    use stealth_policies::{MailboxPolicy, PoliciesContract, PoliciesContractClient};

    fn hash(env: &Env, byte: u8) -> BytesN<32> {
        BytesN::from_array(env, &[byte; 32])
    }

    #[allow(clippy::too_many_arguments)]
    fn configure_lifecycle(
        env: &Env,
        receipts: &Address,
        message_id: &BytesN<32>,
        sender: &Address,
        recipient: &Address,
        allow_unknown: bool,
        require_receipt: bool,
        amount: i128,
    ) {
        let policies = env.register(PoliciesContract, ());
        let policies_client = PoliciesContractClient::new(env, &policies);
        policies_client.set_policy(
            &recipient.clone(),
            &MailboxPolicy {
                allow_unknown,
                require_verified: false,
                require_receipt,
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
            &amount,
            &false,
            &true,
        );
    }

    proptest! {
        #[test]
        fn property_receipt_delivery_and_read_invariants(
            message_byte in 0u8..255u8,
            payload_byte in 0u8..255u8,
            protocol_version in 0u32..1000u32,
            delivered_timestamp in 0u64..1_000_000_000u64,
            read_delay in 0u64..1_000_000_000u64,
            amount in 0i128..1_000_000_000i128,
        ) {
            let env = Env::default();
            env.mock_all_auths();

            let contract_id = env.register(ReceiptsContract, ());
            let client = ReceiptsContractClient::new(&env, &contract_id);
            let sender = Address::generate(&env);
            let recipient = Address::generate(&env);

            let message_id = hash(&env, message_byte);
            let payload_hash = hash(&env, payload_byte);

            configure_lifecycle(
                &env,
                &contract_id,
                &message_id,
                &sender,
                &recipient,
                true, // allow_unknown = true
                true, // require_receipt = true
                amount,
            );

            env.ledger().set_timestamp(delivered_timestamp);

            let delivered = client.delivered(&message_id, &payload_hash, &protocol_version, &sender, &recipient);
            prop_assert_eq!(&delivered.message_id, &message_id);
            prop_assert_eq!(&delivered.payload_hash, &payload_hash);
            prop_assert_eq!(delivered.protocol_version, protocol_version);
            prop_assert_eq!(&delivered.sender, &sender);
            prop_assert_eq!(&delivered.recipient, &recipient);
            prop_assert_eq!(delivered.delivered_at, delivered_timestamp);
            prop_assert_eq!(delivered.read_at, None);

            let fetched = client.get(&message_id);
            prop_assert_eq!(fetched, delivered.clone());

            // Read path
            let read_timestamp = delivered_timestamp + read_delay;
            env.ledger().set_timestamp(read_timestamp);

            let read = client.read(&message_id);
            prop_assert_eq!(&read.message_id, &message_id);
            prop_assert_eq!(&read.payload_hash, &payload_hash);
            prop_assert_eq!(read.protocol_version, protocol_version);
            prop_assert_eq!(&read.sender, &sender);
            prop_assert_eq!(&read.recipient, &recipient);
            prop_assert_eq!(read.delivered_at, delivered_timestamp);
            prop_assert_eq!(read.read_at, Some(read_timestamp));
            prop_assert!(read.read_at.unwrap() >= read.delivered_at);

            let fetched_after_read = client.get(&message_id);
            prop_assert_eq!(fetched_after_read, read.clone());

            // Verify already read fails
            let try_read_again = client.try_read(&message_id);
            prop_assert_eq!(
                try_read_again.unwrap_err().unwrap(),
                Error::AlreadyRead
            );
        }

        #[test]
        fn property_lifecycle_rejection_invariants(
            message_byte in 0u8..255u8,
            payload_byte in 0u8..255u8,
            protocol_version in 0u32..1000u32,
        ) {
            let env = Env::default();
            env.mock_all_auths();

            let contract_id = env.register(ReceiptsContract, ());
            let client = ReceiptsContractClient::new(&env, &contract_id);
            let sender = Address::generate(&env);
            let recipient = Address::generate(&env);

            let message_id = hash(&env, message_byte);
            let payload_hash = hash(&env, payload_byte);

            // Set up a lifecycle and configure it on Receipts, but DO NOT bind the message_id
            let policies = env.register(PoliciesContract, ());
            let postage = Address::generate(&env);
            let lifecycle = env.register(LifecycleContract, ());
            let lifecycle_client = LifecycleContractClient::new(&env, &lifecycle);
            lifecycle_client.initialize(&policies, &postage, &contract_id);
            client.configure_guard(&lifecycle);

            // delivered must fail with LifecycleRejected
            let try_delivered = client.try_delivered(&message_id, &payload_hash, &protocol_version, &sender, &recipient);
            prop_assert_eq!(
                try_delivered.unwrap_err().unwrap(),
                Error::LifecycleRejected
            );

            // get must still fail with ReceiptNotFound
            let try_get = client.try_get(&message_id);
            prop_assert_eq!(
                try_get.unwrap_err().unwrap(),
                Error::ReceiptNotFound
            );
        }

        #[test]
        fn property_delivery_immutability_invariants(
            message_byte in 0u8..255u8,
            payload_byte in 0u8..255u8,
            protocol_version in 0u32..1000u32,
            alt_payload_byte in 0u8..255u8,
            alt_protocol_version in 0u32..1000u32,
        ) {
            let env = Env::default();
            env.mock_all_auths();

            let contract_id = env.register(ReceiptsContract, ());
            let client = ReceiptsContractClient::new(&env, &contract_id);
            let sender = Address::generate(&env);
            let recipient = Address::generate(&env);
            let alt_sender = Address::generate(&env);
            let alt_recipient = Address::generate(&env);

            let message_id = hash(&env, message_byte);
            let payload_hash = hash(&env, payload_byte);

            configure_lifecycle(
                &env,
                &contract_id,
                &message_id,
                &sender,
                &recipient,
                true,
                false,
                0,
            );

            client.delivered(&message_id, &payload_hash, &protocol_version, &sender, &recipient);

            // Subsequent delivered with same fields must fail with DuplicateReceipt
            let try_duplicate = client.try_delivered(&message_id, &payload_hash, &protocol_version, &sender, &recipient);
            prop_assert_eq!(
                try_duplicate.unwrap_err().unwrap(),
                Error::DuplicateReceipt
            );

            // Subsequent delivered with different payload_hash must fail with CommitmentMismatch
            if payload_byte != alt_payload_byte {
                let alt_payload_hash = hash(&env, alt_payload_byte);
                let try_mismatch = client.try_delivered(&message_id, &alt_payload_hash, &protocol_version, &sender, &recipient);
                prop_assert_eq!(
                    try_mismatch.unwrap_err().unwrap(),
                    Error::CommitmentMismatch
                );
            }

            // Subsequent delivered with different protocol_version must fail with CommitmentMismatch
            if protocol_version != alt_protocol_version {
                let try_mismatch = client.try_delivered(&message_id, &payload_hash, &alt_protocol_version, &sender, &recipient);
                prop_assert_eq!(
                    try_mismatch.unwrap_err().unwrap(),
                    Error::CommitmentMismatch
                );
            }

            // Subsequent delivered with different sender must fail with CommitmentMismatch
            let try_mismatch_sender = client.try_delivered(&message_id, &payload_hash, &protocol_version, &alt_sender, &recipient);
            prop_assert_eq!(
                try_mismatch_sender.unwrap_err().unwrap(),
                Error::CommitmentMismatch
            );

            // Subsequent delivered with different recipient must fail with CommitmentMismatch
            let try_mismatch_recipient = client.try_delivered(&message_id, &payload_hash, &protocol_version, &sender, &alt_recipient);
            prop_assert_eq!(
                try_mismatch_recipient.unwrap_err().unwrap(),
                Error::CommitmentMismatch
            );
        }

        #[test]
        fn property_guard_configuration_invariants(
            _guard_addr1_seed in 0u64..1000u64,
            _guard_addr2_seed in 0u64..1000u64,
        ) {
            let env = Env::default();
            let contract_id = env.register(ReceiptsContract, ());
            let client = ReceiptsContractClient::new(&env, &contract_id);

            let guard1 = Address::generate(&env);
            let guard2 = Address::generate(&env);

            client.configure_guard(&guard1);

            let try_reconfigure = client.try_configure_guard(&guard2);
            prop_assert_eq!(
                try_reconfigure.unwrap_err().unwrap(),
                Error::GuardAlreadyConfigured
            );

            prop_assert_eq!(client.guard(), guard1);
        }
    }
}
