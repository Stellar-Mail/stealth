# Postage Pricing Model Specification

## Why this matters

Postage functions as a financial friction to deter high-volume mail abuse (spam) without penalizing legitimate user introductions or turning message rejection into an opportunistic revenue strategy for receiving relays.

---

## 1. Pricing Models

The protocol models five postage pricing models to accommodate various communication scenarios:

1. **Fixed Pricing**: A static base fee required to route a message to an unknown recipient.
2. **Refundable Pricing**: The postage fee is held in a ledger escrow contract and refunded to the sender if the recipient accepts/delivers the message.
3. **Refundable-on-Reply**: The postage fee is held in escrow and only refunded if the recipient replies to the message, ensuring a genuine interaction took place.
4. **Tiered Pricing**: Pricing based on the sender's reputation score or recent sending volume (e.g. first 5 cold messages are low-cost, pricing escalates for subsequent messages).
5. **Dynamic Pricing**: Pricing calculated dynamically based on target relay load, queue size, XLM market volatility, and recipient-configured premium rates.

### Fee Breakdown

$$Total\ Postage = Base\ Fee + Network\ Transaction\ Fee + Relay\ Routing\ Cost + Volatility\ Buffer$$

---

## 2. Unit Economics for Three Usage Profiles

All figures are modeled in Stellar Lumens (XLM). Assume base exchange rate of $1\text{ XLM} = \$0.10\text{ USD}$.

### Profile A: Individual/Personal Sender

- **Characteristics**: Sends cold introductions rarely (~2-5 per week).
- **Pricing Model**: Refundable-on-Reply.
- **Unit Economics**:
  - **Base Postage Fee**: 0.05 XLM ($0.005)
  - **Relay Fee**: 0.00001 XLM
  - **Escrow Deposit**: 0.05 XLM (Refunded on recipient reply)
  - **Net Cost**: ~0.00001 XLM (when reply occurs), otherwise 0.05001 XLM.
  - **Outcome**: Near-zero cost for genuine relationships, small friction for unreturned cold outreach.

### Profile B: Small Business / Newsletter Sender

- **Characteristics**: Broadcasts to an opted-in subscriber list (~5,000 recipients).
- **Pricing Model**: Refundable (on successful delivery acknowledgment).
- **Unit Economics**:
  - **Base Postage Fee**: 0.002 XLM ($0.0002) per recipient
  - **Bulk Discount (Tiered)**: -50% for batches > 1,000
  - **Total Escrow Escrowed**: 5.0 XLM ($0.50)
  - **Net Cost**: 0.05 XLM (non-refundable relay fee) + 0.01 XLM network fees (assuming 99% delivery/refund rate).
  - **Outcome**: Highly economic for clean lists; invalid/bouncing addresses incur postage burns, penalizing list hygiene failures.

### Profile C: High-Volume Corporate Transactional System

- **Characteristics**: Dispatches automated notifications, receipts, and alerts (~100,000 per day).
- **Pricing Model**: Fixed (Non-refundable).
- **Unit Economics**:
  - **Base Postage Fee**: 0.0001 XLM ($0.00001) per message
  - **Daily Cost**: 10.0 XLM ($1.00)
  - **Outcome**: Negligible operational overhead for legitimate businesses, but represents a $1,000/day block for bulk spammers attempting the same volume.

---

## 3. Recommended Default and Conversion Rules

- **Default Cold Message Rule**: If sender is unknown (not in contacts, allowed list, or verified org list), require **0.05 XLM** refundable-on-reply postage.
- **Expiry/Reclaim Interval**: Escrow holdings default to a **7-day expiration**. If the recipient neither replies nor explicitly rejects/blocks the message within 7 days, the sender can reclaim their deposit.
- **Rejection/Burn Rule**: If the recipient explicitly rejects/blocks the sender, **100% of the postage deposit is burned** (sent to a dead Stellar address) or diverted to a designated network fee pool. This prevents recipients from monetizing rejections.

---

## 4. Anti-Exploitation Guardrails

1. **Anti-Sybil Escrow Scaling**: If a sender address makes more than 50 cold introductions in a rolling 1-hour window, the base postage requirement scales exponentially ($Base \times 1.5^{n-50}$).
2. **Refund Rate Throttling**: A maximum refund rate of 95% per hour is enforced on any single sender key. Exceeding this rate locks the key from auto-refunds, requiring human verification.
3. **Volatility Buffer**: Smart contracts lock a 5% price buffer in XLM. If market volatility spikes, the contract resolves price conversions dynamically using standard Stellar oracles to prevent under-pricing spam during market dips.

---

## 5. Legal & Accounting Questions Identified

> [!WARNING]
> Before deploying this postage model, the following legal and accounting points must be resolved:
>
> 1. **Escrow Custody Regulation**: Do relays holding temporary postage deposits in Soroban contracts constitute "money transmitters" or custodians under US/EU regulations?
> 2. **Tax Treatment of Burned Fees**: Are burned postage fees deductible as business expenses for senders? How do receiving relays account for collected non-refundable postage?
> 3. **KYC/AML for Bulk Senders**: Does the collection of postage from high-volume senders trigger anti-money laundering (AML) profiling requirements?
