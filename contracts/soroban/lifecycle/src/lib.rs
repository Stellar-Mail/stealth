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

#[cfg(test)]
mod spec_check {
    // Contract spec regeneration check.
    //
    // spec.json feeds scripts/generate-contract-bindings.mjs, which emits the
    // typed TypeScript clients used against the ledger. If the contract
    // interface changes without regenerating spec.json, the bindings silently
    // drift from on-chain reality. This module decodes the XDR spec entries
    // that the soroban-sdk macros embed in the crate — the same entries a wasm
    // build publishes in its contractspecv0 section — renders the canonical
    // spec.json from them, and fails if the committed file differs.
    //
    // To regenerate after an interface change:
    //   UPDATE_SPEC=1 cargo test -p stealth-lifecycle spec_json
    extern crate std;

    use std::format;
    use std::string::{String, ToString};
    use std::vec::Vec;

    use soroban_sdk::xdr::{Limits, ReadXdr, ScSpecEntry, ScSpecTypeDef, ScSpecUdtUnionCaseV0};
    use stealth_policies::PolicyReason;

    use super::{
        Error, LifecycleConfig, LifecycleContract, LifecycleRecord, LifecycleTerminal, Postage,
        PostageStatus, ReceiptState,
    };

    const SPEC_JSON: &str = include_str!("../spec.json");
    const LIB_RS: &str = include_str!("lib.rs");

    /// Every spec entry the contract exports, in canonical spec.json order.
    /// Adding a public contract function requires adding its entry here; the
    /// `spec_covers_every_public_contract_function` test enforces that.
    fn entries() -> Vec<ScSpecEntry> {
        let xdrs: Vec<Vec<u8>> = std::vec![
            LifecycleConfig::spec_xdr().to_vec(),
            Postage::spec_xdr().to_vec(),
            ReceiptState::spec_xdr().to_vec(),
            LifecycleRecord::spec_xdr().to_vec(),
            PostageStatus::spec_xdr().to_vec(),
            LifecycleTerminal::spec_xdr().to_vec(),
            PolicyReason::spec_xdr().to_vec(),
            Error::spec_xdr().to_vec(),
            LifecycleContract::spec_xdr_initialize().to_vec(),
            LifecycleContract::spec_xdr_config().to_vec(),
            LifecycleContract::spec_xdr_bind().to_vec(),
            LifecycleContract::spec_xdr_verify_settle().to_vec(),
            LifecycleContract::spec_xdr_verify_refund().to_vec(),
            LifecycleContract::spec_xdr_verify_dispute().to_vec(),
            LifecycleContract::spec_xdr_verify_expire().to_vec(),
            LifecycleContract::spec_xdr_verify_reclaim().to_vec(),
            LifecycleContract::spec_xdr_verify_delivered().to_vec(),
            LifecycleContract::spec_xdr_verify_read().to_vec(),
            LifecycleContract::spec_xdr_get().to_vec(),
        ];
        xdrs.iter()
            .map(|xdr| {
                ScSpecEntry::from_xdr(xdr.as_slice(), Limits::none())
                    .expect("embedded contract spec entry must decode")
            })
            .collect()
    }

    /// Render a type using the grammar consumed by
    /// scripts/generate-contract-bindings.mjs.
    fn render_type(def: &ScSpecTypeDef) -> String {
        match def {
            ScSpecTypeDef::Void => "void".to_string(),
            ScSpecTypeDef::Bool => "bool".to_string(),
            ScSpecTypeDef::U32 => "u32".to_string(),
            ScSpecTypeDef::I32 => "i32".to_string(),
            ScSpecTypeDef::U64 => "u64".to_string(),
            ScSpecTypeDef::I64 => "i64".to_string(),
            ScSpecTypeDef::U128 => "u128".to_string(),
            ScSpecTypeDef::I128 => "i128".to_string(),
            ScSpecTypeDef::Address => "address".to_string(),
            ScSpecTypeDef::BytesN(b) if b.n == 32 => "bytes32".to_string(),
            ScSpecTypeDef::Option(o) => format!("option:{}", render_type(&o.value_type)),
            ScSpecTypeDef::Udt(u) => format!("udt:{}", u.name.to_utf8_string_lossy()),
            ScSpecTypeDef::Result(r) => {
                // Contract errors appear as the built-in error type in XDR;
                // this crate has exactly one #[contracterror] enum, `Error`.
                let err = match &*r.error_type {
                    ScSpecTypeDef::Error => "Error".to_string(),
                    ScSpecTypeDef::Udt(u) => u.name.to_utf8_string_lossy(),
                    other => std::panic!("unsupported error type in spec: {other:?}"),
                };
                format!("result:{}:{}", render_type(&r.ok_type), err)
            }
            other => std::panic!("type not covered by the spec.json grammar: {other:?}"),
        }
    }

    fn render_name_type_list(items: &[(String, String)], indent: &str) -> String {
        let rendered: Vec<String> = items
            .iter()
            .map(|(name, ty)| format!("{{ \"name\": \"{name}\", \"type\": \"{ty}\" }}"))
            .collect();
        render_array(&rendered, indent)
    }

    fn render_case_list(items: &[(String, u32)], indent: &str) -> String {
        let rendered: Vec<String> = items
            .iter()
            .map(|(name, value)| format!("{{ \"name\": \"{name}\", \"value\": {value} }}"))
            .collect();
        render_array(&rendered, indent)
    }

    /// Arrays with zero or one element stay inline; longer arrays go one
    /// element per line, matching the committed spec.json style.
    fn render_array(rendered: &[String], indent: &str) -> String {
        match rendered {
            [] => "[]".to_string(),
            [only] if !only.contains('\n') => format!("[{only}]"),
            many => {
                let inner = many
                    .iter()
                    .map(|item| format!("{indent}  {item}"))
                    .collect::<Vec<_>>()
                    .join(",\n");
                format!("[\n{inner}\n{indent}]")
            }
        }
    }

    /// Render the canonical spec.json for the current contract interface.
    fn render_spec_json() -> String {
        let mut structs: Vec<String> = Vec::new();
        let mut enums: Vec<String> = Vec::new();
        let mut errors: Vec<(String, u32)> = Vec::new();
        let mut functions: Vec<String> = Vec::new();

        for entry in entries() {
            match entry {
                ScSpecEntry::UdtStructV0(s) => {
                    let fields: Vec<(String, String)> = s
                        .fields
                        .iter()
                        .map(|f| (f.name.to_utf8_string_lossy(), render_type(&f.type_)))
                        .collect();
                    structs.push(format!(
                        "{{\n      \"name\": \"{}\",\n      \"fields\": {}\n    }}",
                        s.name.to_utf8_string_lossy(),
                        render_name_type_list(&fields, "      "),
                    ));
                }
                ScSpecEntry::UdtUnionV0(u) => {
                    let cases: Vec<(String, u32)> = u
                        .cases
                        .iter()
                        .enumerate()
                        .map(|(index, case)| match case {
                            ScSpecUdtUnionCaseV0::VoidV0(v) => {
                                (v.name.to_utf8_string_lossy(), index as u32)
                            }
                            ScSpecUdtUnionCaseV0::TupleV0(t) => std::panic!(
                                "tuple union case {} is not covered by the spec.json grammar",
                                t.name.to_utf8_string_lossy()
                            ),
                        })
                        .collect();
                    enums.push(format!(
                        "{{\n      \"name\": \"{}\",\n      \"cases\": {}\n    }}",
                        u.name.to_utf8_string_lossy(),
                        render_case_list(&cases, "      "),
                    ));
                }
                ScSpecEntry::UdtErrorEnumV0(e) => {
                    for case in e.cases.iter() {
                        errors.push((case.name.to_utf8_string_lossy(), case.value));
                    }
                }
                ScSpecEntry::FunctionV0(f) => {
                    let inputs: Vec<(String, String)> = f
                        .inputs
                        .iter()
                        .map(|i| (i.name.to_utf8_string_lossy(), render_type(&i.type_)))
                        .collect();
                    let output = match f.outputs.iter().next() {
                        Some(def) => render_type(def),
                        None => "void".to_string(),
                    };
                    functions.push(format!(
                        "{{\n      \"name\": \"{}\",\n      \"inputs\": {},\n      \"output\": \"{}\"\n    }}",
                        f.name.0.to_utf8_string_lossy(),
                        render_name_type_list(&inputs, "      "),
                        output,
                    ));
                }
                other => std::panic!("unexpected spec entry: {other:?}"),
            }
        }

        format!(
            "{{\n  \"structs\": {},\n  \"enums\": {},\n  \"errors\": {},\n  \"functions\": {}\n}}\n",
            render_array(&structs, "  "),
            render_array(&enums, "  "),
            render_case_list(&errors, "  "),
            render_array(&functions, "  "),
        )
    }

    fn strip_whitespace(text: &str) -> String {
        text.chars().filter(|c| !c.is_whitespace()).collect()
    }

    #[test]
    fn spec_json_matches_contract_interface() {
        let expected = render_spec_json();
        if std::env::var("UPDATE_SPEC").is_ok() {
            let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("spec.json");
            std::fs::write(&path, &expected).expect("failed to write spec.json");
            // SPEC_JSON was captured at compile time; skip the comparison on
            // the regeneration run and let the next plain run verify it.
            return;
        }
        // Whitespace-insensitive: no value in this document contains spaces,
        // so formatting cannot mask real drift and cannot cause false alarms.
        assert_eq!(
            strip_whitespace(SPEC_JSON),
            strip_whitespace(&expected),
            "spec.json is out of date with the contract interface.\n\
             Regenerate it with: UPDATE_SPEC=1 cargo test -p stealth-lifecycle spec_json\n\
             Expected content:\n{expected}"
        );
    }

    #[test]
    fn spec_covers_every_public_contract_function() {
        // Every `pub fn` in this file lives in the #[contractimpl] block, so
        // scanning the source catches a new contract function that was not
        // added to the entries() list above (and therefore not to spec.json).
        let mut source_fns: Vec<&str> = LIB_RS
            .lines()
            .filter_map(|line| {
                let trimmed = line.trim_start();
                let rest = trimmed.strip_prefix("pub fn ")?;
                Some(rest.split('(').next().unwrap_or(rest).trim())
            })
            .collect();
        source_fns.sort_unstable();
        source_fns.dedup();

        let mut spec_fns: Vec<String> = entries()
            .iter()
            .filter_map(|entry| match entry {
                ScSpecEntry::FunctionV0(f) => Some(f.name.0.to_utf8_string_lossy()),
                _ => None,
            })
            .collect();
        spec_fns.sort_unstable();

        assert_eq!(
            source_fns,
            spec_fns.iter().map(String::as_str).collect::<Vec<_>>(),
            "public contract functions and spec entries differ.\n\
             Add the missing spec_xdr_* entry to spec_check::entries() and \
             regenerate spec.json with: UPDATE_SPEC=1 cargo test -p stealth-lifecycle spec_json"
        );
    }
}

#[cfg(test)]
mod test {
    extern crate std;

    use soroban_sdk::testutils::{Address as _, Ledger};
    use stealth_policies::{MailboxPolicy, PoliciesContract, PoliciesContractClient};

    use super::*;

    fn hash(env: &Env, byte: u8) -> BytesN<32> {
        BytesN::from_array(env, &[byte; 32])
    }

    fn setup(env: &Env) -> (Address, Address, Address, Address) {
        let policies = env.register(PoliciesContract, ());
        let policies_client = PoliciesContractClient::new(env, &policies);
        let recipient = Address::generate(env);
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
        let receipts = Address::generate(env);
        let lifecycle = env.register(LifecycleContract, ());
        LifecycleContractClient::new(env, &lifecycle).initialize(&policies, &postage, &receipts);
        (lifecycle, recipient, postage, receipts)
    }

    fn bind(
        env: &Env,
        lifecycle: &Address,
        message_id: &BytesN<32>,
        sender: &Address,
        recipient: &Address,
    ) -> LifecycleRecord {
        LifecycleContractClient::new(env, lifecycle).bind(
            message_id,
            &recipient.clone(),
            &sender.clone(),
            &recipient.clone(),
            &0_i128,
            &false,
            &false,
        )
    }

    fn postage(sender: &Address, recipient: &Address, amount: i128, status: PostageStatus) -> Postage {
        Postage {
            sender: sender.clone(),
            recipient: recipient.clone(),
            amount,
            fee: 0,
            created_at: 0,
            expires_at: 0,
            dispute_until: 0,
            status,
        }
    }

    fn receipt(
        env: &Env,
        message_id: &BytesN<32>,
        sender: &Address,
        recipient: &Address,
        payload_byte: u8,
    ) -> ReceiptState {
        ReceiptState {
            message_id: message_id.clone(),
            payload_hash: hash(env, payload_byte),
            protocol_version: 1,
            sender: sender.clone(),
            recipient: recipient.clone(),
            delivered_at: 2_000,
            read_at: None,
        }
    }

    #[test]
    fn initialize_stores_config_and_rejects_reinitialization() {
        let env = Env::default();
        let policies = env.register(PoliciesContract, ());
        let postage = Address::generate(&env);
        let receipts = Address::generate(&env);
        let lifecycle = env.register(LifecycleContract, ());
        let client = LifecycleContractClient::new(&env, &lifecycle);

        assert_eq!(client.try_config(), Err(Ok(Error::NotInitialized)));
        client.initialize(&policies, &postage, &receipts);

        let config = client.config();
        assert_eq!(config.policies, policies);
        assert_eq!(config.postage, postage);
        assert_eq!(config.receipts, receipts);

        assert_eq!(
            client.try_initialize(&policies, &postage, &receipts),
            Err(Ok(Error::AlreadyInitialized))
        );
    }

    #[test]
    fn bind_records_lifecycle_and_reads_back() {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().set_timestamp(1_000);
        let (lifecycle, recipient, _, _) = setup(&env);
        let sender = Address::generate(&env);
        let message_id = hash(&env, 1);

        let record = bind(&env, &lifecycle, &message_id, &sender, &recipient);
        assert_eq!(record.message_id, message_id);
        assert_eq!(record.owner, recipient);
        assert_eq!(record.sender, sender);
        assert_eq!(record.recipient, recipient);
        assert_eq!(record.amount, 0);
        assert!(!record.verified);
        assert!(!record.receipt_required);
        assert_eq!(record.terminal, LifecycleTerminal::Open);
        assert_eq!(record.bound_at, 1_000);
        assert!(record.payload_hash.is_none());
        assert!(record.delivered_at.is_none());

        assert_eq!(
            LifecycleContractClient::new(&env, &lifecycle).get(&message_id),
            record
        );
    }

    #[test]
    fn bind_rejects_duplicate_commitment() {
        let env = Env::default();
        env.mock_all_auths();
        let (lifecycle, recipient, _, _) = setup(&env);
        let sender = Address::generate(&env);
        let message_id = hash(&env, 1);
        bind(&env, &lifecycle, &message_id, &sender, &recipient);

        let client = LifecycleContractClient::new(&env, &lifecycle);
        assert_eq!(
            client.try_bind(
                &message_id,
                &recipient.clone(),
                &sender.clone(),
                &recipient.clone(),
                &0_i128,
                &false,
                &false,
            ),
            Err(Ok(Error::DuplicateLifecycle))
        );
    }

    #[test]
    fn bind_rejects_owner_recipient_mismatch() {
        let env = Env::default();
        env.mock_all_auths();
        let (lifecycle, recipient, _, _) = setup(&env);
        let sender = Address::generate(&env);
        let other_owner = Address::generate(&env);
        let message_id = hash(&env, 1);

        let client = LifecycleContractClient::new(&env, &lifecycle);
        assert_eq!(
            client.try_bind(
                &message_id,
                &other_owner,
                &sender.clone(),
                &recipient.clone(),
                &0_i128,
                &false,
                &false,
            ),
            Err(Ok(Error::PostageMismatch))
        );
    }

    #[test]
    fn bind_rejects_unknown_senders_when_disabled() {
        let env = Env::default();
        env.mock_all_auths();
        let policies = env.register(PoliciesContract, ());
        let policies_client = PoliciesContractClient::new(&env, &policies);
        let recipient = Address::generate(&env);
        policies_client.set_policy(
            &recipient.clone(),
            &MailboxPolicy {
                allow_unknown: false,
                require_verified: false,
                require_receipt: false,
                minimum_postage: 0,
            },
        );
        let postage = Address::generate(&env);
        let receipts = Address::generate(&env);
        let lifecycle = env.register(LifecycleContract, ());
        let client = LifecycleContractClient::new(&env, &lifecycle);
        client.initialize(&policies, &postage, &receipts);

        let sender = Address::generate(&env);
        let message_id = hash(&env, 1);
        assert_eq!(
            client.try_bind(
                &message_id,
                &recipient.clone(),
                &sender.clone(),
                &recipient.clone(),
                &0_i128,
                &false,
                &false,
            ),
            Err(Ok(Error::PolicyRejected))
        );
    }

    #[test]
    fn bind_rejects_postage_below_required_minimum() {
        let env = Env::default();
        env.mock_all_auths();
        let policies = env.register(PoliciesContract, ());
        let policies_client = PoliciesContractClient::new(&env, &policies);
        let recipient = Address::generate(&env);
        policies_client.set_policy(
            &recipient.clone(),
            &MailboxPolicy {
                allow_unknown: true,
                require_verified: false,
                require_receipt: false,
                minimum_postage: 100,
            },
        );
        let postage = Address::generate(&env);
        let receipts = Address::generate(&env);
        let lifecycle = env.register(LifecycleContract, ());
        let client = LifecycleContractClient::new(&env, &lifecycle);
        client.initialize(&policies, &postage, &receipts);

        let sender = Address::generate(&env);
        let message_id = hash(&env, 1);
        assert_eq!(
            client.try_bind(
                &message_id,
                &recipient.clone(),
                &sender.clone(),
                &recipient.clone(),
                &50_i128,
                &false,
                &false,
            ),
            Err(Ok(Error::PolicyRejected))
        );
    }

    #[test]
    fn verify_settle_transitions_open_to_settled() {
        let env = Env::default();
        env.mock_all_auths();
        let (lifecycle, recipient, _, _) = setup(&env);
        let sender = Address::generate(&env);
        let message_id = hash(&env, 1);
        bind(&env, &lifecycle, &message_id, &sender, &recipient);

        let client = LifecycleContractClient::new(&env, &lifecycle);
        let record = client.verify_settle(
            &message_id,
            &postage(&sender, &recipient, 0, PostageStatus::Settled),
        );
        assert_eq!(record.terminal, LifecycleTerminal::Settled);
        assert_eq!(
            client.get(&message_id).terminal,
            LifecycleTerminal::Settled
        );
    }

    #[test]
    fn verify_terminal_rejects_amount_mismatch() {
        let env = Env::default();
        env.mock_all_auths();
        let (lifecycle, recipient, _, _) = setup(&env);
        let sender = Address::generate(&env);
        let message_id = hash(&env, 1);
        bind(&env, &lifecycle, &message_id, &sender, &recipient);

        let client = LifecycleContractClient::new(&env, &lifecycle);
        assert_eq!(
            client.try_verify_settle(
                &message_id,
                &postage(&sender, &recipient, 50, PostageStatus::Settled),
            ),
            Err(Ok(Error::PostageMismatch))
        );
    }

    #[test]
    fn verify_terminal_rejects_core_party_mismatch() {
        let env = Env::default();
        env.mock_all_auths();
        let (lifecycle, recipient, _, _) = setup(&env);
        let sender = Address::generate(&env);
        let stranger = Address::generate(&env);
        let message_id = hash(&env, 1);
        bind(&env, &lifecycle, &message_id, &sender, &recipient);

        let client = LifecycleContractClient::new(&env, &lifecycle);
        assert_eq!(
            client.try_verify_settle(
                &message_id,
                &postage(&stranger, &recipient, 0, PostageStatus::Settled),
            ),
            Err(Ok(Error::PostageMismatch))
        );
    }

    #[test]
    fn verify_expire_requires_pending_status() {
        let env = Env::default();
        env.mock_all_auths();
        let (lifecycle, recipient, _, _) = setup(&env);
        let sender = Address::generate(&env);
        let message_id = hash(&env, 1);
        bind(&env, &lifecycle, &message_id, &sender, &recipient);

        let client = LifecycleContractClient::new(&env, &lifecycle);
        assert_eq!(
            client.try_verify_expire(
                &message_id,
                &postage(&sender, &recipient, 0, PostageStatus::Expired),
            ),
            Err(Ok(Error::PostageMismatch))
        );

        let record = client.verify_expire(
            &message_id,
            &postage(&sender, &recipient, 0, PostageStatus::Pending),
        );
        assert_eq!(record.terminal, LifecycleTerminal::Expired);
    }

    #[test]
    fn verify_dispute_requires_pending_or_expired_status() {
        let env = Env::default();
        env.mock_all_auths();
        let (lifecycle, recipient, _, _) = setup(&env);
        let sender = Address::generate(&env);
        let message_id = hash(&env, 1);
        bind(&env, &lifecycle, &message_id, &sender, &recipient);

        let client = LifecycleContractClient::new(&env, &lifecycle);
        assert_eq!(
            client.try_verify_dispute(
                &message_id,
                &postage(&sender, &recipient, 0, PostageStatus::Settled),
            ),
            Err(Ok(Error::PostageMismatch))
        );

        let record = client.verify_dispute(
            &message_id,
            &postage(&sender, &recipient, 0, PostageStatus::Pending),
        );
        assert_eq!(record.terminal, LifecycleTerminal::Disputed);
    }

    #[test]
    fn verify_reclaim_rejects_terminal_postage_statuses() {
        let env = Env::default();
        env.mock_all_auths();
        let (lifecycle, recipient, _, _) = setup(&env);
        let sender = Address::generate(&env);
        let message_id = hash(&env, 1);
        bind(&env, &lifecycle, &message_id, &sender, &recipient);

        let client = LifecycleContractClient::new(&env, &lifecycle);
        assert_eq!(
            client.try_verify_reclaim(
                &message_id,
                &postage(&sender, &recipient, 0, PostageStatus::Reclaimed),
            ),
            Err(Ok(Error::PostageMismatch))
        );

        let record = client.verify_reclaim(
            &message_id,
            &postage(&sender, &recipient, 0, PostageStatus::Pending),
        );
        assert_eq!(record.terminal, LifecycleTerminal::Reclaimed);
    }

    #[test]
    fn verify_delivered_records_commitment() {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().set_timestamp(1_000);
        let (lifecycle, recipient, _, _) = setup(&env);
        let sender = Address::generate(&env);
        let message_id = hash(&env, 1);
        bind(&env, &lifecycle, &message_id, &sender, &recipient);

        let client = LifecycleContractClient::new(&env, &lifecycle);
        let record = client.verify_delivered(
            &message_id,
            &receipt(&env, &message_id, &sender, &recipient, 9),
        );
        assert_eq!(record.terminal, LifecycleTerminal::Delivered);
        assert_eq!(record.payload_hash, Some(hash(&env, 9)));
        assert_eq!(record.protocol_version, Some(1));
        assert_eq!(record.delivered_at, Some(2_000));
        assert!(record.read_at.is_none());

        let stored = client.get(&message_id);
        assert_eq!(stored.payload_hash, Some(hash(&env, 9)));
    }

    #[test]
    fn verify_delivered_rejects_receipt_mismatch() {
        let env = Env::default();
        env.mock_all_auths();
        let (lifecycle, recipient, _, _) = setup(&env);
        let sender = Address::generate(&env);
        let message_id = hash(&env, 1);
        bind(&env, &lifecycle, &message_id, &sender, &recipient);

        let client = LifecycleContractClient::new(&env, &lifecycle);
        assert_eq!(
            client.try_verify_delivered(
                &message_id,
                &receipt(&env, &hash(&env, 2), &sender, &recipient, 9),
            ),
            Err(Ok(Error::ReceiptMismatch))
        );
    }

    #[test]
    fn verify_delivered_rejects_already_delivered() {
        let env = Env::default();
        env.mock_all_auths();
        let (lifecycle, recipient, _, _) = setup(&env);
        let sender = Address::generate(&env);
        let message_id = hash(&env, 1);
        bind(&env, &lifecycle, &message_id, &sender, &recipient);

        let client = LifecycleContractClient::new(&env, &lifecycle);
        let receipt = receipt(&env, &message_id, &sender, &recipient, 9);
        client.verify_delivered(&message_id, &receipt);
        assert_eq!(
            client.try_verify_delivered(&message_id, &receipt),
            Err(Ok(Error::AlreadyDelivered))
        );
    }

    #[test]
    fn verify_read_requires_prior_delivery() {
        let env = Env::default();
        env.mock_all_auths();
        let (lifecycle, recipient, _, _) = setup(&env);
        let sender = Address::generate(&env);
        let message_id = hash(&env, 1);
        bind(&env, &lifecycle, &message_id, &sender, &recipient);

        let client = LifecycleContractClient::new(&env, &lifecycle);
        assert_eq!(
            client.try_verify_read(
                &message_id,
                &receipt(&env, &message_id, &sender, &recipient, 9),
            ),
            Err(Ok(Error::TerminalStateMismatch))
        );
    }

    #[test]
    fn verify_read_marks_read() {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().set_timestamp(1_000);
        let (lifecycle, recipient, _, _) = setup(&env);
        let sender = Address::generate(&env);
        let message_id = hash(&env, 1);
        bind(&env, &lifecycle, &message_id, &sender, &recipient);

        let client = LifecycleContractClient::new(&env, &lifecycle);
        let receipt = receipt(&env, &message_id, &sender, &recipient, 9);
        client.verify_delivered(&message_id, &receipt);

        env.ledger().set_timestamp(2_000);
        let record = client.verify_read(&message_id, &receipt);
        assert_eq!(record.terminal, LifecycleTerminal::Read);
        assert_eq!(record.read_at, Some(2_000));

        assert_eq!(
            client.try_verify_read(&message_id, &receipt),
            Err(Ok(Error::AlreadyRead))
        );
    }

    #[test]
    fn verify_terminal_fails_when_receipt_required_and_not_delivered() {
        let env = Env::default();
        env.mock_all_auths();
        let (lifecycle, recipient, _, _) = setup(&env);
        let sender = Address::generate(&env);
        let message_id = hash(&env, 1);
        LifecycleContractClient::new(&env, &lifecycle).bind(
            &message_id,
            &recipient.clone(),
            &sender.clone(),
            &recipient.clone(),
            &0_i128,
            &false,
            &true,
        );

        let client = LifecycleContractClient::new(&env, &lifecycle);
        assert_eq!(
            client.try_verify_settle(
                &message_id,
                &postage(&sender, &recipient, 0, PostageStatus::Settled),
            ),
            Err(Ok(Error::TerminalStateMismatch))
        );
    }

    #[test]
    fn get_missing_lifecycle_errors() {
        let env = Env::default();
        env.mock_all_auths();
        let (lifecycle, _, _, _) = setup(&env);
        let client = LifecycleContractClient::new(&env, &lifecycle);
        assert_eq!(
            client.try_get(&hash(&env, 99)),
            Err(Ok(Error::MissingLifecycle))
        );
    }

    #[test]
    fn verify_terminal_errors_on_missing_lifecycle() {
        let env = Env::default();
        env.mock_all_auths();
        let (lifecycle, recipient, _, _) = setup(&env);
        let sender = Address::generate(&env);
        let message_id = hash(&env, 1);

        let client = LifecycleContractClient::new(&env, &lifecycle);
        assert_eq!(
            client.try_verify_settle(
                &message_id,
                &postage(&sender, &recipient, 0, PostageStatus::Settled),
            ),
            Err(Ok(Error::MissingLifecycle))
        );
    }
}

#[cfg(test)]
mod auth_boundaries {
    extern crate std;

    use soroban_sdk::{
        testutils::{Address as _, MockAuth, MockAuthInvoke},
        IntoVal,
    };

    use super::*;

    fn hash(env: &Env, byte: u8) -> BytesN<32> {
        BytesN::from_array(env, &[byte; 32])
    }

    #[test]
    fn bind_requires_sender_auth() {
        let env = Env::default();
        let policies = Address::generate(&env);
        let postage = Address::generate(&env);
        let receipts = Address::generate(&env);
        let lifecycle = env.register(LifecycleContract, ());
        LifecycleContractClient::new(&env, &lifecycle).initialize(&policies, &postage, &receipts);

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let message_id = hash(&env, 1);
        let result = LifecycleContractClient::new(&env, &lifecycle).try_bind(
            &message_id,
            &recipient.clone(),
            &sender.clone(),
            &recipient.clone(),
            &0_i128,
            &false,
            &false,
        );
        assert!(matches!(result, Err(Err(_))));
    }

    #[test]
    #[should_panic(expected = "Error(Auth")]
    fn bind_fails_when_unauthorized_party_authorizes() {
        let env = Env::default();
        let policies = Address::generate(&env);
        let postage = Address::generate(&env);
        let receipts = Address::generate(&env);
        let lifecycle = env.register(LifecycleContract, ());
        let client = LifecycleContractClient::new(&env, &lifecycle);
        client.initialize(&policies, &postage, &receipts);

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let attacker = Address::generate(&env);
        let message_id = hash(&env, 1);

        env.mock_auths(&[MockAuth {
            address: &attacker,
            invoke: &MockAuthInvoke {
                contract: &lifecycle,
                fn_name: "bind",
                args: (
                    message_id.clone(),
                    recipient.clone(),
                    sender.clone(),
                    recipient.clone(),
                    0i128,
                    false,
                    false,
                )
                    .into_val(&env),
                sub_invokes: &[],
            },
        }]);

        client.bind(
            &message_id,
            &recipient.clone(),
            &sender.clone(),
            &recipient.clone(),
            &0_i128,
            &false,
            &false,
        );
    }
}
