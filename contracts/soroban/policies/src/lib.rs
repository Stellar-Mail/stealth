#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env,
};

#[contract]
pub struct PoliciesContract;

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SenderRule {
    Default,
    Allow,
    Block,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct MailboxPolicy {
    pub allow_unknown: bool,
    pub require_verified: bool,
    pub require_receipt: bool,
    pub minimum_postage: i128,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct VersionedMailboxPolicy {
    pub policy: MailboxPolicy,
    pub version: u32,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct DelegateScope {
    pub can_set_policy: bool,
    pub can_set_senders: bool,
}

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
pub struct PolicyDecision {
    pub allowed: bool,
    pub reason: PolicyReason,
    pub required_postage: i128,
    pub rule: SenderRule,
    pub version: u32,
}

/// Storage Key Migration Notes:
///
/// The `DataKey` enum defines the keys for persistent storage in the Soroban environment.
/// - When introducing new variants, **ALWAYS append them to the end** of this enum to preserve
///   backward compatibility with Soroban's underlying XDR serialization.
/// - **NEVER reorder or remove existing variants**. Doing so will corrupt the contract's ability
///   to read previously written data from the ledger, leading to catastrophic failure.
/// - If a variant's inner types must be changed or a key structure is deprecated, leave the old
///   variant intact and append a new one (e.g., `PolicyV2(Address)`).
#[contracttype]
#[derive(Clone)]
enum DataKey {
    Policy(Address),
    PolicyVersion(Address),
    Rule(Address, Address),
    Tier(Address, Address),
    Delegate(Address, Address),
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    InvalidPostage = 1,
    UnauthorizedDelegate = 2,
}

#[contractimpl]
impl PoliciesContract {
    pub fn set_policy(env: Env, owner: Address, policy: MailboxPolicy) -> Result<(), Error> {
        Self::set_policy_as(env, owner.clone(), owner, policy)
    }

    pub fn set_policy_as(
        env: Env,
        owner: Address,
        actor: Address,
        policy: MailboxPolicy,
    ) -> Result<(), Error> {
        Self::authorize_policy_mutation(&env, &owner, &actor)?;
        Self::validate_policy(policy)?;
        let version = Self::bump_version(&env, &owner);
        env.storage()
            .persistent()
            .set(&DataKey::Policy(owner.clone()), &policy);
        env.events().publish(
            (symbol_short!("policy"), owner),
            VersionedMailboxPolicy { policy, version },
        );
        Ok(())
    }

    pub fn get_policy(env: Env, owner: Address) -> MailboxPolicy {
        Self::get_versioned_policy(env, owner).policy
    }

    pub fn get_versioned_policy(env: Env, owner: Address) -> VersionedMailboxPolicy {
        let version = Self::policy_version(env.clone(), owner.clone());
        env.storage()
            .persistent()
            .get(&DataKey::Policy(owner))
            .map(|policy| VersionedMailboxPolicy { policy, version })
            .unwrap_or(VersionedMailboxPolicy {
                policy: Self::default_policy(),
                version,
            })
    }

    pub fn policy_version(env: Env, owner: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::PolicyVersion(owner))
            .unwrap_or(0)
    }

    pub fn set_delegate(
        env: Env,
        owner: Address,
        delegate: Address,
        scope: DelegateScope,
    ) -> Result<(), Error> {
        owner.require_auth();
        let key = DataKey::Delegate(owner.clone(), delegate.clone());
        if scope.can_set_policy || scope.can_set_senders {
            env.storage().persistent().set(&key, &scope);
        } else {
            env.storage().persistent().remove(&key);
        }
        env.events()
            .publish((symbol_short!("delegate"), owner, delegate), scope);
        Ok(())
    }

    pub fn delegate_scope(env: Env, owner: Address, delegate: Address) -> DelegateScope {
        env.storage()
            .persistent()
            .get(&DataKey::Delegate(owner, delegate))
            .unwrap_or(DelegateScope {
                can_set_policy: false,
                can_set_senders: false,
            })
    }

    pub fn set_sender_rule(
        env: Env,
        owner: Address,
        sender: Address,
        rule: SenderRule,
    ) -> Result<(), Error> {
        Self::set_sender_rule_as(env, owner.clone(), owner, sender, rule)
    }

    pub fn set_sender_rule_as(
        env: Env,
        owner: Address,
        actor: Address,
        sender: Address,
        rule: SenderRule,
    ) -> Result<(), Error> {
        Self::authorize_sender_mutation(&env, &owner, &actor)?;
        let key = DataKey::Rule(owner.clone(), sender.clone());
        let tier_key = DataKey::Tier(owner.clone(), sender.clone());

        if rule == SenderRule::Default {
            env.storage().persistent().remove(&key);
        } else {
            env.storage().persistent().set(&key, &rule);
        }
        env.storage().persistent().remove(&tier_key);
        let version = Self::bump_version(&env, &owner);
        env.events()
            .publish((symbol_short!("sender"), owner, sender), (rule, version));
        Ok(())
    }

    pub fn set_sender_tier(
        env: Env,
        owner: Address,
        sender: Address,
        minimum_postage: i128,
    ) -> Result<(), Error> {
        Self::set_sender_tier_as(env, owner.clone(), owner, sender, minimum_postage)
    }

    pub fn set_sender_tier_as(
        env: Env,
        owner: Address,
        actor: Address,
        sender: Address,
        minimum_postage: i128,
    ) -> Result<(), Error> {
        Self::authorize_sender_mutation(&env, &owner, &actor)?;
        if minimum_postage < 0 {
            return Err(Error::InvalidPostage);
        }
        env.storage().persistent().set(
            &DataKey::Tier(owner.clone(), sender.clone()),
            &minimum_postage,
        );
        env.storage().persistent().set(
            &DataKey::Rule(owner.clone(), sender.clone()),
            &SenderRule::Default,
        );
        let version = Self::bump_version(&env, &owner);
        env.events().publish(
            (symbol_short!("tier"), owner, sender),
            (minimum_postage, version),
        );
        Ok(())
    }

    pub fn sender_rule(env: Env, owner: Address, sender: Address) -> SenderRule {
        env.storage()
            .persistent()
            .get(&DataKey::Rule(owner, sender))
            .unwrap_or(SenderRule::Default)
    }

    pub fn sender_tier(env: Env, owner: Address, sender: Address) -> Option<i128> {
        env.storage()
            .persistent()
            .get(&DataKey::Tier(owner, sender))
    }

    pub fn can_mail(
        env: Env,
        owner: Address,
        sender: Address,
        verified: bool,
        postage: i128,
        receipt: bool,
    ) -> bool {
        Self::evaluate(env, owner, sender, verified, postage, receipt).allowed
    }

    pub fn evaluate(
        env: Env,
        owner: Address,
        sender: Address,
        verified: bool,
        postage: i128,
        receipt: bool,
    ) -> PolicyDecision {
        let versioned = Self::get_versioned_policy(env.clone(), owner.clone());
        let rule = Self::sender_rule(env.clone(), owner.clone(), sender.clone());
        let tier = Self::sender_tier(env, owner, sender);

        if rule == SenderRule::Block {
            return PolicyDecision {
                allowed: false,
                reason: PolicyReason::SenderBlocked,
                required_postage: versioned.policy.minimum_postage,
                rule,
                version: versioned.version,
            };
        }
        if rule == SenderRule::Allow {
            return PolicyDecision {
                allowed: true,
                reason: PolicyReason::SenderAllowed,
                required_postage: 0,
                rule,
                version: versioned.version,
            };
        }

        let required_postage = tier.unwrap_or(versioned.policy.minimum_postage);
        if versioned.policy.require_verified && !verified {
            return PolicyDecision {
                allowed: false,
                reason: PolicyReason::VerificationRequired,
                required_postage,
                rule,
                version: versioned.version,
            };
        }
        if versioned.policy.require_receipt && !receipt {
            return PolicyDecision {
                allowed: false,
                reason: PolicyReason::ReceiptRequired,
                required_postage,
                rule,
                version: versioned.version,
            };
        }
        if let Some(required_postage) = tier {
            return PolicyDecision {
                allowed: postage >= required_postage,
                reason: if postage >= required_postage {
                    PolicyReason::TierSatisfied
                } else {
                    PolicyReason::InsufficientPostage
                },
                required_postage,
                rule,
                version: versioned.version,
            };
        }
        if !versioned.policy.allow_unknown {
            return PolicyDecision {
                allowed: false,
                reason: PolicyReason::UnknownSendersDisabled,
                required_postage,
                rule,
                version: versioned.version,
            };
        }
        PolicyDecision {
            allowed: postage >= required_postage,
            reason: if postage >= required_postage {
                PolicyReason::PolicySatisfied
            } else {
                PolicyReason::InsufficientPostage
            },
            required_postage,
            rule,
            version: versioned.version,
        }
    }

    fn default_policy() -> MailboxPolicy {
        MailboxPolicy {
            allow_unknown: false,
            require_verified: true,
            require_receipt: false,
            minimum_postage: 0,
        }
    }

    fn validate_policy(policy: MailboxPolicy) -> Result<(), Error> {
        if policy.minimum_postage < 0 {
            return Err(Error::InvalidPostage);
        }
        Ok(())
    }

    fn authorize_policy_mutation(env: &Env, owner: &Address, actor: &Address) -> Result<(), Error> {
        if actor == owner {
            owner.require_auth();
            return Ok(());
        }
        actor.require_auth();
        if Self::delegate_scope(env.clone(), owner.clone(), actor.clone()).can_set_policy {
            Ok(())
        } else {
            Err(Error::UnauthorizedDelegate)
        }
    }

    fn authorize_sender_mutation(env: &Env, owner: &Address, actor: &Address) -> Result<(), Error> {
        if actor == owner {
            owner.require_auth();
            return Ok(());
        }
        actor.require_auth();
        if Self::delegate_scope(env.clone(), owner.clone(), actor.clone()).can_set_senders {
            Ok(())
        } else {
            Err(Error::UnauthorizedDelegate)
        }
    }

    fn bump_version(env: &Env, owner: &Address) -> u32 {
        let version = Self::policy_version(env.clone(), owner.clone()) + 1;
        env.storage()
            .persistent()
            .set(&DataKey::PolicyVersion(owner.clone()), &version);
        version
    }
}

// ---------------------------------------------------------------------------
// Canonical interoperability vector tests
//
// Reads the language-neutral fixture at protocol/vectors/vectors.json and
// drives every primitive-validation case and every policy-decision case
// through the live Rust helpers and contract functions.  This ensures that
// CI catches any divergence between the fixture and this implementation.
//
// Space/time: O(n) — each vector case is exercised exactly once.
// ---------------------------------------------------------------------------
#[cfg(test)]
mod vectors {
    extern crate std;

    use serde_json::Value;
    use soroban_sdk::testutils::Address as _;

    use super::*;

    const VECTORS_JSON: &str = include_str!("../../../../protocol/vectors/vectors.json");

    // -----------------------------------------------------------------------
    // Primitive-validation helpers (mirror the TypeScript Zod schemas)
    // -----------------------------------------------------------------------

    fn is_valid_stellar_address(s: &str) -> bool {
        let s = s.trim();
        s.len() == 56
            && s.starts_with('G')
            && s[1..].chars().all(|c| matches!(c, 'A'..='Z' | '2'..='7'))
    }

    fn validate_hash32(s: &str) -> Result<std::string::String, ()> {
        let normalised = s.trim().to_lowercase();
        if normalised.len() == 64
            && normalised
                .chars()
                .all(|c| matches!(c, '0'..='9' | 'a'..='f'))
        {
            Ok(normalised)
        } else {
            Err(())
        }
    }

    fn validate_stroop_amount(s: &str) -> Result<i128, ()> {
        let s = s.trim();
        if s.is_empty() || (!s.chars().all(|c| c.is_ascii_digit())) {
            return Err(());
        }
        if s != "0" && s.starts_with('0') {
            return Err(());
        }
        let val: u128 = s.parse().map_err(|_| ())?;
        if val > i128::MAX as u128 {
            return Err(());
        }
        Ok(val as i128)
    }

    // -----------------------------------------------------------------------
    // primitives/address
    // -----------------------------------------------------------------------

    #[test]
    fn primitives_address() {
        let root: Value = serde_json::from_str(VECTORS_JSON).unwrap();
        let cases = root["categories"]["primitives"]["address"]["cases"]
            .as_array()
            .unwrap();
        for c in cases {
            let id = c["id"].as_str().unwrap();
            let input = c["input"].as_str().unwrap_or("");
            let expected = c["expected"]["valid"].as_bool().unwrap();
            assert_eq!(is_valid_stellar_address(input), expected, "vectors: {}", id);
        }
    }

    // -----------------------------------------------------------------------
    // primitives/hash
    // -----------------------------------------------------------------------

    #[test]
    fn primitives_hash() {
        let root: Value = serde_json::from_str(VECTORS_JSON).unwrap();
        let cases = root["categories"]["primitives"]["hash"]["cases"]
            .as_array()
            .unwrap();
        for c in cases {
            let id = c["id"].as_str().unwrap();
            let input = c["input"].as_str().unwrap_or("");
            let expected = c["expected"]["valid"].as_bool().unwrap();
            let got = validate_hash32(input);
            assert_eq!(got.is_ok(), expected, "vectors: {}", id);
            if got.is_ok() {
                if let Some(exp_norm) = c["expected"]["normalized"].as_str() {
                    assert_eq!(got.unwrap(), exp_norm, "vectors: {} normalised", id);
                }
            }
        }
    }

    // -----------------------------------------------------------------------
    // primitives/amount
    // -----------------------------------------------------------------------

    #[test]
    fn primitives_amount() {
        let root: Value = serde_json::from_str(VECTORS_JSON).unwrap();
        let cases = root["categories"]["primitives"]["amount"]["cases"]
            .as_array()
            .unwrap();
        for c in cases {
            let id = c["id"].as_str().unwrap();
            let input = c["input"].as_str().unwrap_or("");
            let expected = c["expected"]["valid"].as_bool().unwrap();
            assert_eq!(
                validate_stroop_amount(input).is_ok(),
                expected,
                "vectors: {}",
                id
            );
        }
    }

    // -----------------------------------------------------------------------
    // policy_decisions — exercises the live can_mail contract function
    // -----------------------------------------------------------------------

    #[test]
    fn policy_decisions() {
        let root: Value = serde_json::from_str(VECTORS_JSON).unwrap();
        let cases = root["categories"]["policy_decisions"]["cases"]
            .as_array()
            .unwrap();

        for c in cases {
            let id = c["id"].as_str().unwrap();
            let env = Env::default();
            env.mock_all_auths();
            let contract_id = env.register(PoliciesContract, ());
            let client = PoliciesContractClient::new(&env, &contract_id);
            let owner = soroban_sdk::Address::generate(&env);
            let sender = soroban_sdk::Address::generate(&env);

            // Apply sender rule from fixture
            match c["setup"]["senderRule"].as_str().unwrap_or("default") {
                "allow" => client.set_sender_rule(&owner, &sender, &SenderRule::Allow),
                "block" => client.set_sender_rule(&owner, &sender, &SenderRule::Block),
                _ => {}
            }

            // Apply mailbox policy from fixture (if present)
            if let Some(policy_obj) = c["setup"]["policy"].as_object() {
                let min: i128 = policy_obj["minimumPostage"]
                    .as_str()
                    .unwrap_or("0")
                    .parse()
                    .unwrap();
                client.set_policy(
                    &owner,
                    &MailboxPolicy {
                        allow_unknown: policy_obj["allowUnknown"].as_bool().unwrap(),
                        require_verified: policy_obj["requireVerified"].as_bool().unwrap(),
                        require_receipt: false,
                        minimum_postage: min,
                    },
                );
            }

            let postage: i128 = c["input"]["postage"].as_str().unwrap().parse().unwrap();
            let verified = c["input"]["verified"].as_bool().unwrap();
            let expected = c["expected"]["allowed"].as_bool().unwrap();

            assert_eq!(
                client.can_mail(&owner, &sender, &verified, &postage, &false),
                expected,
                "vectors: {}",
                id
            );
        }
    }

    // -----------------------------------------------------------------------
    // tampered — all cases must be rejected by the relevant validator
    // -----------------------------------------------------------------------

    #[test]
    fn tampered() {
        let root: Value = serde_json::from_str(VECTORS_JSON).unwrap();
        let cases = root["categories"]["tampered"]["cases"].as_array().unwrap();
        for c in cases {
            let id = c["id"].as_str().unwrap();
            let schema = c["schema"].as_str().unwrap();
            let input = c["input"].as_str().unwrap_or("");
            let valid = match schema {
                "stellarAddress" => is_valid_stellar_address(input),
                "hash32" => validate_hash32(input).is_ok(),
                "stroopAmount" => validate_stroop_amount(input).is_ok(),
                _ => panic!("unknown schema: {schema}"),
            };
            assert!(!valid, "vectors: {id} should be invalid");
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn owner_controls_who_can_mail() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(PoliciesContract, ());
        let client = PoliciesContractClient::new(&env, &contract_id);
        let owner = Address::generate(&env);
        let trusted = Address::generate(&env);
        let blocked = Address::generate(&env);
        let unknown = Address::generate(&env);

        client.set_policy(
            &owner,
            &MailboxPolicy {
                allow_unknown: true,
                require_verified: true,
                require_receipt: false,
                minimum_postage: 100,
            },
        );
        client.set_sender_rule(&owner, &trusted, &SenderRule::Allow);
        client.set_sender_rule(&owner, &blocked, &SenderRule::Block);

        assert!(client.can_mail(&owner, &trusted, &false, &0, &false));
        assert!(!client.can_mail(&owner, &blocked, &true, &1000, &false));
        assert!(!client.can_mail(&owner, &unknown, &false, &100, &false));
        assert!(client.can_mail(&owner, &unknown, &true, &100, &false));
    }

    #[test]
    fn policy_version_is_queryable_and_increments_on_transitions() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(PoliciesContract, ());
        let client = PoliciesContractClient::new(&env, &contract_id);
        let owner = Address::generate(&env);
        let sender = Address::generate(&env);

        assert_eq!(client.policy_version(&owner), 0);
        client.set_policy(
            &owner,
            &MailboxPolicy {
                allow_unknown: true,
                require_verified: true,
                require_receipt: true,
                minimum_postage: 10,
            },
        );
        assert_eq!(client.policy_version(&owner), 1);
        assert_eq!(client.get_versioned_policy(&owner).version, 1);
        client.set_sender_tier(&owner, &sender, &25);
        assert_eq!(client.policy_version(&owner), 2);
    }

    #[test]
    fn block_always_overrides_pricing() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(PoliciesContract, ());
        let client = PoliciesContractClient::new(&env, &contract_id);
        let owner = Address::generate(&env);
        let sender = Address::generate(&env);

        client.set_policy(
            &owner,
            &MailboxPolicy {
                allow_unknown: true,
                require_verified: false,
                require_receipt: false,
                minimum_postage: 100,
            },
        );
        client.set_sender_tier(&owner, &sender, &1);
        assert_eq!(
            client.evaluate(&owner, &sender, &true, &0, &false).reason,
            PolicyReason::InsufficientPostage
        );
        assert_eq!(
            client.evaluate(&owner, &sender, &true, &1, &false).reason,
            PolicyReason::TierSatisfied
        );

        client.set_sender_rule(&owner, &sender, &SenderRule::Block);
        let decision = client.evaluate(&owner, &sender, &true, &1_000, &true);
        assert!(!decision.allowed);
        assert_eq!(decision.reason, PolicyReason::SenderBlocked);
    }

    #[test]
    fn transition_branches_are_deterministic() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(PoliciesContract, ());
        let client = PoliciesContractClient::new(&env, &contract_id);
        let owner = Address::generate(&env);
        let sender = Address::generate(&env);

        assert_eq!(
            client.evaluate(&owner, &sender, &true, &0, &false).reason,
            PolicyReason::UnknownSendersDisabled
        );

        client.set_policy(
            &owner,
            &MailboxPolicy {
                allow_unknown: true,
                require_verified: true,
                require_receipt: true,
                minimum_postage: 50,
            },
        );
        assert_eq!(
            client.evaluate(&owner, &sender, &false, &50, &true).reason,
            PolicyReason::VerificationRequired
        );
        assert_eq!(
            client.evaluate(&owner, &sender, &true, &50, &false).reason,
            PolicyReason::ReceiptRequired
        );
        assert_eq!(
            client.evaluate(&owner, &sender, &true, &49, &true).reason,
            PolicyReason::InsufficientPostage
        );
        assert_eq!(
            client.evaluate(&owner, &sender, &true, &50, &true).reason,
            PolicyReason::PolicySatisfied
        );

        client.set_sender_rule(&owner, &sender, &SenderRule::Allow);
        assert_eq!(
            client.evaluate(&owner, &sender, &false, &0, &false).reason,
            PolicyReason::SenderAllowed
        );
    }

    #[test]
    fn scoped_delegate_authorization_is_enforced() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(PoliciesContract, ());
        let client = PoliciesContractClient::new(&env, &contract_id);
        let owner = Address::generate(&env);
        let delegate = Address::generate(&env);
        let unscoped = Address::generate(&env);
        let sender = Address::generate(&env);

        client.set_delegate(
            &owner,
            &delegate,
            &DelegateScope {
                can_set_policy: false,
                can_set_senders: true,
            },
        );
        assert!(client
            .try_set_sender_rule_as(&owner, &delegate, &sender, &SenderRule::Allow)
            .is_ok());
        assert!(client
            .try_set_sender_rule_as(&owner, &unscoped, &sender, &SenderRule::Block)
            .is_err());
        assert!(client
            .try_set_policy_as(
                &owner,
                &delegate,
                &MailboxPolicy {
                    allow_unknown: true,
                    require_verified: false,
                    require_receipt: false,
                    minimum_postage: 0,
                },
            )
            .is_err());

        client.set_delegate(
            &owner,
            &delegate,
            &DelegateScope {
                can_set_policy: true,
                can_set_senders: false,
            },
        );
        assert!(client
            .try_set_policy_as(
                &owner,
                &delegate,
                &MailboxPolicy {
                    allow_unknown: true,
                    require_verified: false,
                    require_receipt: false,
                    minimum_postage: 0,
                },
            )
            .is_ok());
    }

    #[test]
    fn negative_path_coverage() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(PoliciesContract, ());
        let client = PoliciesContractClient::new(&env, &contract_id);
        let owner = Address::generate(&env);
        let sender = Address::generate(&env);
        let rando = Address::generate(&env);

        // Negative path: unauthorized actor tries to set policy
        assert_eq!(
            client.try_set_policy_as(
                &owner,
                &rando,
                &MailboxPolicy {
                    allow_unknown: true,
                    require_verified: false,
                    require_receipt: false,
                    minimum_postage: 0,
                },
            ),
            Err(Ok(Error::UnauthorizedDelegate))
        );

        // Negative path: unauthorized actor tries to set sender rule
        assert_eq!(
            client.try_set_sender_rule_as(&owner, &rando, &sender, &SenderRule::Allow),
            Err(Ok(Error::UnauthorizedDelegate))
        );

        // Negative path: unauthorized actor tries to set sender tier
        assert_eq!(
            client.try_set_sender_tier_as(&owner, &rando, &sender, &10),
            Err(Ok(Error::UnauthorizedDelegate))
        );

        // Negative path: invalid postage (< 0) when setting policy
        assert_eq!(
            client.try_set_policy(
                &owner,
                &MailboxPolicy {
                    allow_unknown: true,
                    require_verified: false,
                    require_receipt: false,
                    minimum_postage: -1,
                }
            ),
            Err(Ok(Error::InvalidPostage))
        );

        // Negative path: invalid postage (< 0) when setting sender tier
        assert_eq!(
            client.try_set_sender_tier(&owner, &sender, &-1),
            Err(Ok(Error::InvalidPostage))
        );
    }
}

#[cfg(test)]
mod proptests {
    use super::*;
    use proptest::prelude::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    proptest! {
        #[test]
        fn property_blocked_sender_is_never_allowed(
            postage in 0i128..10_000_000_000i128,
            verified in any::<bool>(),
            receipt in any::<bool>(),
            allow_unknown in any::<bool>(),
            require_verified in any::<bool>(),
            require_receipt in any::<bool>(),
            minimum_postage in 0i128..10_000i128,
            has_tier in any::<bool>(),
            tier_postage in 0i128..10_000i128,
        ) {
            let env = Env::default();
            env.mock_all_auths();
            let contract_id = env.register(PoliciesContract, ());
            let client = PoliciesContractClient::new(&env, &contract_id);
            let owner = Address::generate(&env);
            let sender = Address::generate(&env);

            client.set_policy(
                &owner,
                &MailboxPolicy {
                    allow_unknown,
                    require_verified,
                    require_receipt,
                    minimum_postage,
                },
            );

            if has_tier {
                client.set_sender_tier(&owner, &sender, &tier_postage);
            }
            client.set_sender_rule(&owner, &sender, &SenderRule::Block);

            let decision = client.evaluate(&owner, &sender, &verified, &postage, &receipt);
            prop_assert!(!decision.allowed);
            prop_assert_eq!(decision.reason, PolicyReason::SenderBlocked);
        }

        #[test]
        fn property_allowed_sender_is_always_allowed(
            postage in 0i128..10_000_000_000i128,
            verified in any::<bool>(),
            receipt in any::<bool>(),
            allow_unknown in any::<bool>(),
            require_verified in any::<bool>(),
            require_receipt in any::<bool>(),
            minimum_postage in 0i128..10_000i128,
            has_tier in any::<bool>(),
            tier_postage in 0i128..10_000i128,
        ) {
            let env = Env::default();
            env.mock_all_auths();
            let contract_id = env.register(PoliciesContract, ());
            let client = PoliciesContractClient::new(&env, &contract_id);
            let owner = Address::generate(&env);
            let sender = Address::generate(&env);

            client.set_policy(
                &owner,
                &MailboxPolicy {
                    allow_unknown,
                    require_verified,
                    require_receipt,
                    minimum_postage,
                },
            );

            if has_tier {
                client.set_sender_tier(&owner, &sender, &tier_postage);
            }
            client.set_sender_rule(&owner, &sender, &SenderRule::Allow);

            let decision = client.evaluate(&owner, &sender, &verified, &postage, &receipt);
            prop_assert!(decision.allowed);
            prop_assert_eq!(decision.reason, PolicyReason::SenderAllowed);
        }

        #[test]
        fn property_tier_satisfaction_trumps_default_policy(
            postage in 0i128..10_000_000_000i128,
            verified in any::<bool>(),
            receipt in any::<bool>(),
            allow_unknown in any::<bool>(),
            require_verified in any::<bool>(),
            require_receipt in any::<bool>(),
            minimum_postage in 0i128..10_000i128,
            tier_postage in 0i128..10_000_000_000i128,
        ) {
            let env = Env::default();
            env.mock_all_auths();
            let contract_id = env.register(PoliciesContract, ());
            let client = PoliciesContractClient::new(&env, &contract_id);
            let owner = Address::generate(&env);
            let sender = Address::generate(&env);

            client.set_policy(
                &owner,
                &MailboxPolicy {
                    allow_unknown,
                    require_verified,
                    require_receipt,
                    minimum_postage,
                },
            );

            // Using tier implies SenderRule::Default is active
            client.set_sender_tier(&owner, &sender, &tier_postage);

            // Tier evaluation happens after verification & receipt checks.
            let decision = client.evaluate(&owner, &sender, &verified, &postage, &receipt);

            if require_verified && !verified {
                prop_assert!(!decision.allowed);
                prop_assert_eq!(decision.reason, PolicyReason::VerificationRequired);
            } else if require_receipt && !receipt {
                prop_assert!(!decision.allowed);
                prop_assert_eq!(decision.reason, PolicyReason::ReceiptRequired);
            } else {
                if postage >= tier_postage {
                    prop_assert!(decision.allowed);
                    prop_assert_eq!(decision.reason, PolicyReason::TierSatisfied);
                } else {
                    prop_assert!(!decision.allowed);
                    prop_assert_eq!(decision.reason, PolicyReason::InsufficientPostage);
                }
            }
        }
    }
}

#[cfg(test)]
mod auth_boundaries {
    use super::*;
    use soroban_sdk::{
        testutils::{
            Address as _, AuthorizedFunction, AuthorizedInvocation, MockAuth, MockAuthInvoke,
        },
        IntoVal, Symbol,
    };

    fn permissive_policy() -> MailboxPolicy {
        MailboxPolicy {
            allow_unknown: true,
            require_verified: false,
            require_receipt: false,
            minimum_postage: 5,
        }
    }

    fn senders_scope() -> DelegateScope {
        DelegateScope {
            can_set_policy: false,
            can_set_senders: true,
        }
    }

    #[test]
    fn set_policy_fails_without_owner_authorization() {
        let env = Env::default();
        let contract_id = env.register(PoliciesContract, ());
        let client = PoliciesContractClient::new(&env, &contract_id);
        let owner = Address::generate(&env);

        env.set_auths(&[]);
        assert!(client.try_set_policy(&owner, &permissive_policy()).is_err());

        // Nothing was written: defaults still apply and the version is unbumped.
        assert_eq!(client.get_policy(&owner).allow_unknown, false);
        assert_eq!(client.policy_version(&owner), 0);
    }

    #[test]
    fn set_policy_fails_when_another_party_authorizes() {
        let env = Env::default();
        let contract_id = env.register(PoliciesContract, ());
        let client = PoliciesContractClient::new(&env, &contract_id);
        let owner = Address::generate(&env);
        let stranger = Address::generate(&env);
        let policy = permissive_policy();

        env.mock_auths(&[MockAuth {
            address: &stranger,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "set_policy",
                args: (owner.clone(), policy).into_val(&env),
                sub_invokes: &[],
            },
        }]);
        assert!(client.try_set_policy(&owner, &policy).is_err());
        assert_eq!(client.policy_version(&owner), 0);
    }

    #[test]
    fn owner_authorization_is_bound_to_exact_arguments() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(PoliciesContract, ());
        let client = PoliciesContractClient::new(&env, &contract_id);
        let owner = Address::generate(&env);
        let policy = permissive_policy();

        client.set_policy(&owner, &policy);
        assert_eq!(
            env.auths(),
            [(
                owner.clone(),
                AuthorizedInvocation {
                    function: AuthorizedFunction::Contract((
                        contract_id,
                        Symbol::new(&env, "set_policy"),
                        (owner.clone(), policy).into_val(&env),
                    )),
                    sub_invocations: [].into(),
                }
            )]
        );
    }

    #[test]
    fn set_delegate_requires_owner_not_delegate() {
        let env = Env::default();
        let contract_id = env.register(PoliciesContract, ());
        let client = PoliciesContractClient::new(&env, &contract_id);
        let owner = Address::generate(&env);
        let delegate = Address::generate(&env);
        let scope = senders_scope();

        // A delegate cannot grant themselves scope with only their own auth.
        env.mock_auths(&[MockAuth {
            address: &delegate,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "set_delegate",
                args: (owner.clone(), delegate.clone(), scope).into_val(&env),
                sub_invokes: &[],
            },
        }]);
        assert!(client.try_set_delegate(&owner, &delegate, &scope).is_err());

        env.set_auths(&[]);
        assert!(client.try_set_delegate(&owner, &delegate, &scope).is_err());

        env.mock_all_auths();
        let stored = client.delegate_scope(&owner, &delegate);
        assert!(!stored.can_set_policy && !stored.can_set_senders);
    }

    #[test]
    fn unscoped_actor_is_rejected_with_unauthorized_delegate() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(PoliciesContract, ());
        let client = PoliciesContractClient::new(&env, &contract_id);
        let owner = Address::generate(&env);
        let actor = Address::generate(&env);
        let sender = Address::generate(&env);

        // Even with the actor's own authorization present, no scope means the
        // typed contract error — not a silent write.
        assert_eq!(
            client
                .try_set_policy_as(&owner, &actor, &permissive_policy())
                .unwrap_err()
                .unwrap(),
            Error::UnauthorizedDelegate
        );
        assert_eq!(
            client
                .try_set_sender_rule_as(&owner, &actor, &sender, &SenderRule::Block)
                .unwrap_err()
                .unwrap(),
            Error::UnauthorizedDelegate
        );
        assert_eq!(
            client
                .try_set_sender_tier_as(&owner, &actor, &sender, &10)
                .unwrap_err()
                .unwrap(),
            Error::UnauthorizedDelegate
        );

        // Failed mutations must not bump the version or write any state.
        assert_eq!(client.policy_version(&owner), 0);
        assert_eq!(client.sender_rule(&owner, &sender), SenderRule::Default);
        assert_eq!(client.sender_tier(&owner, &sender), None);
    }

    #[test]
    fn delegate_scope_is_not_transitive_across_capabilities() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(PoliciesContract, ());
        let client = PoliciesContractClient::new(&env, &contract_id);
        let owner = Address::generate(&env);
        let sender_delegate = Address::generate(&env);
        let policy_delegate = Address::generate(&env);
        let sender = Address::generate(&env);

        client.set_delegate(&owner, &sender_delegate, &senders_scope());
        client.set_delegate(
            &owner,
            &policy_delegate,
            &DelegateScope {
                can_set_policy: true,
                can_set_senders: false,
            },
        );

        // Sender scope does not imply policy scope, and vice versa.
        assert_eq!(
            client
                .try_set_policy_as(&owner, &sender_delegate, &permissive_policy())
                .unwrap_err()
                .unwrap(),
            Error::UnauthorizedDelegate
        );
        assert_eq!(
            client
                .try_set_sender_tier_as(&owner, &policy_delegate, &sender, &10)
                .unwrap_err()
                .unwrap(),
            Error::UnauthorizedDelegate
        );
    }

    #[test]
    fn delegated_mutation_requires_only_the_actors_authorization() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(PoliciesContract, ());
        let client = PoliciesContractClient::new(&env, &contract_id);
        let owner = Address::generate(&env);
        let delegate = Address::generate(&env);
        let sender = Address::generate(&env);

        client.set_delegate(&owner, &delegate, &senders_scope());

        // The delegate acts with their own signature; the owner's is not needed.
        env.mock_auths(&[MockAuth {
            address: &delegate,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "set_sender_rule_as",
                args: (
                    owner.clone(),
                    delegate.clone(),
                    sender.clone(),
                    SenderRule::Allow,
                )
                    .into_val(&env),
                sub_invokes: &[],
            },
        }]);
        assert!(client
            .try_set_sender_rule_as(&owner, &delegate, &sender, &SenderRule::Allow)
            .is_ok());

        // Without any authorization the same delegated call fails.
        env.set_auths(&[]);
        assert!(client
            .try_set_sender_rule_as(&owner, &delegate, &sender, &SenderRule::Block)
            .is_err());

        env.mock_all_auths();
        assert_eq!(client.sender_rule(&owner, &sender), SenderRule::Allow);
    }

    #[test]
    fn revoked_delegate_loses_authority() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(PoliciesContract, ());
        let client = PoliciesContractClient::new(&env, &contract_id);
        let owner = Address::generate(&env);
        let delegate = Address::generate(&env);
        let sender = Address::generate(&env);

        client.set_delegate(&owner, &delegate, &senders_scope());
        assert!(client
            .try_set_sender_rule_as(&owner, &delegate, &sender, &SenderRule::Allow)
            .is_ok());

        client.set_delegate(
            &owner,
            &delegate,
            &DelegateScope {
                can_set_policy: false,
                can_set_senders: false,
            },
        );
        assert_eq!(
            client
                .try_set_sender_rule_as(&owner, &delegate, &sender, &SenderRule::Block)
                .unwrap_err()
                .unwrap(),
            Error::UnauthorizedDelegate
        );
        assert_eq!(client.sender_rule(&owner, &sender), SenderRule::Allow);
    }

    #[test]
    fn reads_and_evaluation_require_no_authorization() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(PoliciesContract, ());
        let client = PoliciesContractClient::new(&env, &contract_id);
        let owner = Address::generate(&env);
        let delegate = Address::generate(&env);
        let sender = Address::generate(&env);

        client.set_policy(&owner, &permissive_policy());
        client.set_delegate(&owner, &delegate, &senders_scope());
        client.set_sender_tier(&owner, &sender, &7);

        env.set_auths(&[]);
        assert_eq!(client.get_policy(&owner).minimum_postage, 5);
        assert_eq!(client.get_versioned_policy(&owner).version, 2);
        assert_eq!(client.policy_version(&owner), 2);
        assert!(client.delegate_scope(&owner, &delegate).can_set_senders);
        assert_eq!(client.sender_rule(&owner, &sender), SenderRule::Default);
        assert_eq!(client.sender_tier(&owner, &sender), Some(7));
        assert!(client.can_mail(&owner, &sender, &false, &7, &false));
        assert_eq!(
            client.evaluate(&owner, &sender, &false, &7, &false).reason,
            PolicyReason::TierSatisfied
        );
        assert_eq!(env.auths(), []);
    }
}
