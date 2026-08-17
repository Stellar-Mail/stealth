/**
 * Verifies that the wallet signer identity matches the declared envelope sender.
 */

export class SenderBindingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SenderBindingError";
  }
}

export interface DelegateAuthorization {
  delegate: string;
  sender: string;
}

export function verifySenderBinding(
  signerAddress: string,
  declaredSender: string,
  authorization?: DelegateAuthorization,
): void {
  const normalizedSigner = signerAddress.trim().toLowerCase();
  const normalizedSender = declaredSender.trim().toLowerCase();

  if (normalizedSigner === normalizedSender) {
    return;
  }

  if (authorization) {
    const normalizedAuthDelegate = authorization.delegate.trim().toLowerCase();
    const normalizedAuthSender = authorization.sender.trim().toLowerCase();

    if (normalizedSigner === normalizedAuthDelegate && normalizedSender === normalizedAuthSender) {
      return;
    }
  }

  throw new SenderBindingError("Wallet signer identity does not match the envelope sender.");
}
