# Release Stage Gates

This document defines the mandatory go/no-go criteria for promoting Stealth protocol components (contracts, client, infrastructure) through different environments.

## Overview

A release reviewer must be able to make a defensible decision based on the evidence linked in this checklist. Promotion is blocked if any "Critical" gate is unmet.

---

## 1. Pre-Flight Checklist (All Environments)

| Gate              | Requirement                                                      | Owner | Evidence/Link | Status |
| :---------------- | :--------------------------------------------------------------- | :---- | :------------ | :----- |
| **Audit**         | Security audit of code changes completed and findings addressed. |       | [Link]        | ⬜     |
| **Threat Model**  | Threat model updated for new features/changes.                   |       | [Link]        | ⬜     |
| **Lint & Format** | CI passing for linting, formatting, and typechecking.            |       | [CI Job]      | ⬜     |
| **Tests**         | Unit and integration tests passing (100% success).               |       | [CI Job]      | ⬜     |
| **Wasm Size**     | Soroban contract Wasm sizes within limits.                       |       | [CI Job]      | ⬜     |

---

## 2. Testnet Promotion Criteria

Focus: Functional validation and integration testing in a live environment.

| Gate           | Requirement                                       | Owner | Evidence/Link               | Status |
| :------------- | :------------------------------------------------ | :---- | :-------------------------- | :----- |
| **Migration**  | Migration scripts tested and verified on Testnet. |       | [Logs]                      | ⬜     |
| **Rollback**   | Rollback procedure verified for this version.     |       | [Runbook]                   | ⬜     |
| **Monitoring** | Alerts and dashboards updated for new metrics.    |       | [Dashboard]                 | ⬜     |
| **Artifacts**  | SHA-256 hashes of build artifacts recorded.       |       | See [Artifacts](#artifacts) | ⬜     |

---

## 3. Mainnet Promotion Criteria (Critical)

Focus: Security, compliance, and operational readiness.

| Gate                  | Requirement                                                 | Owner | Evidence/Link | Status |
| :-------------------- | :---------------------------------------------------------- | :---- | :------------ | :----- |
| **Key Ceremony**      | Key management ceremony completed for new signers/upgrades. |       | [Protocol]    | ⬜     |
| **Legal Review**      | Compliance and legal sign-off for release scope.            |       | [Sign-off]    | ⬜     |
| **Incident Response** | IR team briefed and on-call schedule confirmed.             |       | [Schedule]    | ⬜     |
| **User Warnings**     | Public documentation and UI warnings updated.               |       | [Docs]        | ⬜     |
| **Support**           | Support team trained on new features/changes.               |       | [Training]    | ⬜     |
| **Reliability**       | Load testing/Stress testing completed.                      |       | [Report]      | ⬜     |

---

## 4. Artifacts and Identifiers

Every release must record the exact identifiers of the deployed components.

### Contract IDs (Soroban)

| Component  | Network | Contract ID | Artifact Hash (SHA-256) |
| :--------- | :------ | :---------- | :---------------------- |
| `policies` | Testnet |             |                         |
| `policies` | Mainnet |             |                         |
| `postage`  | Testnet |             |                         |
| `postage`  | Mainnet |             |                         |
| `receipts` | Testnet |             |                         |
| `receipts` | Mainnet |             |                         |

### Client Artifacts

| Component      | Version | Environment | Build Hash (SHA-256) |
| :------------- | :------ | :---------- | :------------------- |
| `stealth-mail` |         | Testnet     |                      |
| `stealth-mail` |         | Mainnet     |                      |

---

## 5. Promotion Sign-off

| Role                  | Name | Signature | Date |
| :-------------------- | :--- | :-------- | :--- |
| **Security Reviewer** |      |           |      |
| **Engineering Lead**  |      |           |      |
| **Product Owner**     |      |           |      |
| **Release Manager**   |      |           |      |
