#![no_std]

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype,
    symbol_short, Address, BytesN, Env, Symbol,
};
use stealth_policies::{PoliciesContractClient, PolicyDecision, PolicyReason};

#[cfg(feature = "contract")]
#[contract]
pub struct LifecycleContract;

#[cfg(not(feature = "contract"))]
#[contractclient(name = "LifecycleContractClient")]
pub trait LifecycleContractInterface {
    fn initialize(policies: Address, postage: Address, receipts: Address) -> Result<(), Error>;
    fn config() -> Result<LifecycleConfig, Error>;
    fn bind(
        message_id: BytesN<32>,
        owner: Address,
        sender: Address,
        recipient: Address,
        amount: i128,
        verified: bool,
        receipt_required: bool,
    ) -> Result<LifecycleRecord, Error>;
    fn verify_settle(
        message_id: BytesN<32>,
        postage: Postage,
    ) -> Result<LifecycleRecord, Error>;
    fn verify_refund(
        message_id: BytesN<32>,
        postage: Postage,
    ) -> Result<LifecycleRecord, Error>;
    fn verify_dispute(
        message_id: BytesN<32>,
        postage: Postage,
    ) -> Result<LifecycleRecord, Error>;
    fn verify_expire(
        message_id: BytesN<32>,
        postage: Postage,
    ) -> Result<LifecycleRecord, Error>;
    fn verify_reclaim(
        message_id: BytesN<32>,
        postage: Postage,
    ) -> Result<LifecycleRecord, Error>;
    fn verify_delivered(
        message_id: BytesN<32>,
        receipt: ReceiptState,
    ) -> Result<LifecycleRecord, Error>;
    fn verify_read(
        message_id: BytesN<32>,
        receipt: ReceiptState,
    ) -> Result<LifecycleRecord, Error>;
    fn get(message_id: BytesN<32>) -> Result<LifecycleRecord, Error>;
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LifecycleConfig {
    pub policies: Address,
    pub postage: Address,
    pub receipts: Address,
}

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

#[contractevent(topics = ["lifecycle"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LifecycleEvent {
    #[topic]
    pub action: Symbol,
    #[topic]
    pub message_id: BytesN<32>,
    pub record: LifecycleRecord,
}

#[contracttype]
enum DataKey {
    Config,
    Record(BytesN<32>),
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
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

#[cfg(feature = "contract")]
#[contractimpl]
impl LifecycleContract {
    pub fn initialize(
        env: Env,
        policies: Address,
        postage: Address,
        receipts: Address,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Config) {
            return Err(Error::AlreadyInitialized);
        }

        env.storage().instance().set(
            &DataKey::Config,
            &LifecycleConfig {
                policies,
                postage,
                receipts,
            },
        );
        Ok(())
    }

    pub fn config(env: Env) -> Result<LifecycleConfig, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(Error::NotInitialized)
    }

    pub fn bind(
        env: Env,
        message_id: BytesN<32>,
        owner: Address,
        sender: Address,
        recipient: Address,
        amount: i128,
        verified: bool,
        receipt_required: bool,
    ) -> Result<LifecycleRecord, Error> {
        if owner != recipient {
            return Err(Error::PostageMismatch);
        }
        sender.require_auth();

        let key = DataKey::Record(message_id.clone());
        if env.storage().persistent().has(&key) {
            return Err(Error::DuplicateLifecycle);
        }

        let decision = Self::evaluate_policy(
            &env,
            owner.clone(),
            sender.clone(),
            verified,
            amount,
            receipt_required,
        )?;

        let record = LifecycleRecord {
            message_id: message_id.clone(),
            owner,
            sender,
            recipient,
            amount,
            verified,
            receipt_required,
            policy_version: decision.version,
            decision_reason: decision.reason,
            payload_hash: None,
            protocol_version: None,
            delivered_at: None,
            read_at: None,
            terminal: LifecycleTerminal::Open,
            bound_at: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&key, &record);
        Self::publish_event(&env, symbol_short!("bind"), message_id, record.clone());
        Ok(record)
    }

    pub fn verify_settle(
        env: Env,
        message_id: BytesN<32>,
        postage: Postage,
    ) -> Result<LifecycleRecord, Error> {
        Self::verify_terminal(env, message_id, postage, LifecycleTerminal::Settled)
    }

    pub fn verify_refund(
        env: Env,
        message_id: BytesN<32>,
        postage: Postage,
    ) -> Result<LifecycleRecord, Error> {
        Self::verify_terminal(env, message_id, postage, LifecycleTerminal::Refunded)
    }

    pub fn verify_dispute(
        env: Env,
        message_id: BytesN<32>,
        postage: Postage,
    ) -> Result<LifecycleRecord, Error> {
        if !matches!(
            postage.status,
            PostageStatus::Pending | PostageStatus::Expired
        ) {
            return Err(Error::PostageMismatch);
        }
        Self::verify_terminal(env, message_id, postage, LifecycleTerminal::Disputed)
    }

    pub fn verify_expire(
        env: Env,
        message_id: BytesN<32>,
        postage: Postage,
    ) -> Result<LifecycleRecord, Error> {
        if postage.status != PostageStatus::Pending {
            return Err(Error::PostageMismatch);
        }
        Self::verify_terminal(env, message_id, postage, LifecycleTerminal::Expired)
    }

    pub fn verify_reclaim(
        env: Env,
        message_id: BytesN<32>,
        postage: Postage,
    ) -> Result<LifecycleRecord, Error> {
        if matches!(
            postage.status,
            PostageStatus::Settled | PostageStatus::Refunded | PostageStatus::Reclaimed
        ) {
            return Err(Error::PostageMismatch);
        }
        Self::verify_terminal(env, message_id, postage, LifecycleTerminal::Reclaimed)
    }

    pub fn verify_delivered(
        env: Env,
        message_id: BytesN<32>,
        receipt: ReceiptState,
    ) -> Result<LifecycleRecord, Error> {
        Self::require_receipts_contract(&env)?;
        let mut record = Self::read_record(&env, &message_id)?;
        Self::assert_core_match(&record, &message_id, &receipt.sender, &receipt.recipient)?;
        Self::assert_receipt_match(&record, &receipt)?;

        if record.delivered_at.is_some() {
            return Err(Error::AlreadyDelivered);
        }
        if record.terminal == LifecycleTerminal::Read {
            return Err(Error::AlreadyRead);
        }
        if !matches!(
            record.terminal,
            LifecycleTerminal::Open | LifecycleTerminal::Delivered
        ) {
            return Err(Error::TerminalStateMismatch);
        }

        record.delivered_at = Some(receipt.delivered_at);
        record.payload_hash = Some(receipt.payload_hash.clone());
        record.protocol_version = Some(receipt.protocol_version);
        record.terminal = LifecycleTerminal::Delivered;

        env.storage().persistent().set(&DataKey::Record(message_id.clone()), &record);
        Self::publish_event(&env, symbol_short!("delivered"), message_id, record.clone());
        Ok(record)
    }

    pub fn verify_read(
        env: Env,
        message_id: BytesN<32>,
        receipt: ReceiptState,
    ) -> Result<LifecycleRecord, Error> {
        Self::require_receipts_contract(&env)?;
        let mut record = Self::read_record(&env, &message_id)?;
        Self::assert_core_match(&record, &message_id, &receipt.sender, &receipt.recipient)?;
        Self::assert_receipt_match(&record, &receipt)?;

        if record.delivered_at.is_none() {
            return Err(Error::TerminalStateMismatch);
        }
        if record.read_at.is_some() {
            return Err(Error::AlreadyRead);
        }
        if !matches!(
            record.terminal,
            LifecycleTerminal::Open | LifecycleTerminal::Delivered | LifecycleTerminal::Read
        ) {
            return Err(Error::TerminalStateMismatch);
        }

        record.read_at = Some(env.ledger().timestamp());
        record.terminal = LifecycleTerminal::Read;

        env.storage().persistent().set(&DataKey::Record(message_id.clone()), &record);
        Self::publish_event(&env, symbol_short!("read"), message_id, record.clone());
        Ok(record)
    }

    pub fn get(env: Env, message_id: BytesN<32>) -> Result<LifecycleRecord, Error> {
        Self::read_record(&env, &message_id)
    }

    fn verify_terminal(
        env: Env,
        message_id: BytesN<32>,
        postage: Postage,
        terminal: LifecycleTerminal,
    ) -> Result<LifecycleRecord, Error> {
        Self::require_postage_contract(&env)?;
        let mut record = Self::read_record(&env, &message_id)?;
        Self::assert_core_match(&record, &message_id, &postage.sender, &postage.recipient)?;
        if record.amount != postage.amount {
            return Err(Error::PostageMismatch);
        }
        if !Self::can_transition(record.terminal, terminal) {
            return Err(Error::TerminalStateMismatch);
        }
        if record.receipt_required && record.delivered_at.is_none() {
            return Err(Error::TerminalStateMismatch);
        }

        record.terminal = terminal;
        env.storage().persistent().set(&DataKey::Record(message_id.clone()), &record);
        Self::publish_event(&env, Self::terminal_symbol(terminal), message_id, record.clone());
        Ok(record)
    }

    fn can_transition(current: LifecycleTerminal, next: LifecycleTerminal) -> bool {
        match next {
            LifecycleTerminal::Settled => matches!(
                current,
                LifecycleTerminal::Open | LifecycleTerminal::Delivered | LifecycleTerminal::Read
            ),
            LifecycleTerminal::Refunded => matches!(
                current,
                LifecycleTerminal::Open
                    | LifecycleTerminal::Delivered
                    | LifecycleTerminal::Read
                    | LifecycleTerminal::Disputed
            ),
            LifecycleTerminal::Disputed => matches!(
                current,
                LifecycleTerminal::Open
                    | LifecycleTerminal::Delivered
                    | LifecycleTerminal::Read
                    | LifecycleTerminal::Expired
            ),
            LifecycleTerminal::Expired => matches!(
                current,
                LifecycleTerminal::Open | LifecycleTerminal::Delivered | LifecycleTerminal::Read
            ),
            LifecycleTerminal::Reclaimed => matches!(
                current,
                LifecycleTerminal::Open
                    | LifecycleTerminal::Delivered
                    | LifecycleTerminal::Read
                    | LifecycleTerminal::Expired
                    | LifecycleTerminal::Disputed
            ),
            LifecycleTerminal::Open | LifecycleTerminal::Delivered | LifecycleTerminal::Read => false,
        }
    }

    fn evaluate_policy(
        env: &Env,
        owner: Address,
        sender: Address,
        verified: bool,
        postage: i128,
        receipt_required: bool,
    ) -> Result<PolicyDecision, Error> {
        let config = Self::read_config(env)?;
        let decision = PoliciesContractClient::new(env, &config.policies).evaluate(
            &owner,
            &sender,
            &verified,
            &postage,
            &receipt_required,
        );

        if !decision.allowed {
            return Err(Error::PolicyRejected);
        }
        if decision.required_postage > postage {
            return Err(Error::PolicyRejected);
        }
        Ok(decision)
    }

    fn read_config(env: &Env) -> Result<LifecycleConfig, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(Error::NotInitialized)
    }

    fn read_record(env: &Env, message_id: &BytesN<32>) -> Result<LifecycleRecord, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Record(message_id.clone()))
            .ok_or(Error::MissingLifecycle)
    }

    fn require_postage_contract(env: &Env) -> Result<(), Error> {
        let config = Self::read_config(env)?;
        config.postage.require_auth();
        Ok(())
    }

    fn require_receipts_contract(env: &Env) -> Result<(), Error> {
        let config = Self::read_config(env)?;
        config.receipts.require_auth();
        Ok(())
    }

    fn assert_core_match(
        record: &LifecycleRecord,
        message_id: &BytesN<32>,
        sender: &Address,
        recipient: &Address,
    ) -> Result<(), Error> {
        if record.message_id != *message_id
            || record.sender != *sender
            || record.recipient != *recipient
        {
            return Err(Error::PostageMismatch);
        }
        Ok(())
    }

    fn assert_receipt_match(record: &LifecycleRecord, receipt: &ReceiptState) -> Result<(), Error> {
        if record.message_id != receipt.message_id
            || record.sender != receipt.sender
            || record.recipient != receipt.recipient
        {
            return Err(Error::ReceiptMismatch);
        }
        if let Some(payload_hash) = &record.payload_hash {
            if payload_hash != &receipt.payload_hash {
                return Err(Error::ReceiptMismatch);
            }
        }
        if let Some(protocol_version) = record.protocol_version {
            if protocol_version != receipt.protocol_version {
                return Err(Error::ReceiptMismatch);
            }
        }
        Ok(())
    }

    fn publish_event(
        env: &Env,
        action: Symbol,
        message_id: BytesN<32>,
        record: LifecycleRecord,
    ) {
        LifecycleEvent {
            action,
            message_id,
            record,
        }
        .publish(env);
    }

    fn terminal_symbol(terminal: LifecycleTerminal) -> Symbol {
        match terminal {
            LifecycleTerminal::Open => symbol_short!("open"),
            LifecycleTerminal::Delivered => symbol_short!("delivered"),
            LifecycleTerminal::Read => symbol_short!("read"),
            LifecycleTerminal::Settled => symbol_short!("settle"),
            LifecycleTerminal::Refunded => symbol_short!("refund"),
            LifecycleTerminal::Disputed => symbol_short!("dispute"),
            LifecycleTerminal::Expired => symbol_short!("expire"),
            LifecycleTerminal::Reclaimed => symbol_short!("reclaim"),
        }
    }
}
