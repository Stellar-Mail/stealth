# OTP Detector Fixtures

Use synthetic senders, fake codes, and reserved domains only.

## Six-Digit Login Code

Input:

```json
{
  "subject": "Your login verification code",
  "from": "security@example.test",
  "body": "Your verification code is 123456. It expires in 10 minutes."
}
```

Expected:

- Status: `otp`.
- Candidate is masked in display, for example `123***`.
- Signals include verification-code context and expiration window.

## Alphanumeric MFA Code

Input:

```json
{
  "subject": "MFA passcode",
  "from": "auth@example.test",
  "body": "Use passcode A7K9Q2 to finish signing in."
}
```

Expected:

- Status: `otp` or high-confidence `possible_otp`.
- Signals include MFA/passcode language and code shape.

## Invoice False Positive

Input:

```json
{
  "subject": "Invoice 123456 is ready",
  "from": "billing@example.test",
  "body": "Invoice 123456 for 89.00 is attached. No login action is required."
}
```

Expected:

- Status: `not_otp` or `unknown`.
- Warning mentions invoice or billing false-positive context.

## Tracking Number

Input:

```json
{
  "subject": "Package tracking update",
  "from": "shipments@example.test",
  "body": "Tracking number 9400110200881234567890 is in transit."
}
```

Expected:

- Status: `not_otp`.
- Long tracking number is not ranked as an OTP.

## Mixed Order And Code

Input:

```json
{
  "subject": "Complete sign in for order review",
  "from": "orders@example.test",
  "body": "Order 654321 is pending. Your sign-in code is 778899."
}
```

Expected:

- Status: `otp`.
- Candidate `778899` ranks above order number `654321`.

## Empty Content

Input:

```json
{
  "subject": "",
  "from": "unknown@example.test",
  "body": ""
}
```

Expected:

- Status: `unknown`.
- Warning: insufficient content.
