#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, symbol_short, Address,
    BytesN, Env,
};

#[contract]
pub struct ReceiptsContract;

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
}

#[contractimpl]
impl ReceiptsContract {
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

        receipt.read_at = Some(env.ledger().timestamp());
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
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, AuthorizedFunction, AuthorizedInvocation, Ledger},
        IntoVal,
    };

    fn hash(env: &Env, byte: u8) -> BytesN<32> {
        BytesN::from_array(env, &[byte; 32])
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
