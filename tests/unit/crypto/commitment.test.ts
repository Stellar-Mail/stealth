import { describe, expect, it } from "vitest";
import { createCommitment, verifyCommitment } from "../../../src/services/crypto/commitment";

describe("Versioned Content Commitments", () => {
  const testCiphertext = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

  it("creates a deterministically versioned commitment string", async () => {
    const commitment1 = await createCommitment(testCiphertext);
    const commitment2 = await createCommitment(testCiphertext);

    expect(commitment1).toBe(commitment2);
    expect(commitment1).toMatch(/^v1:sha256:hex:[0-9a-f]{64}$/);
  });

  it("verifies a valid commitment successfully", async () => {
    const commitment = await createCommitment(testCiphertext);
    await expect(verifyCommitment(commitment, testCiphertext)).resolves.not.toThrow();
  });

  it("fails verification on a tampered ciphertext", async () => {
    const commitment = await createCommitment(testCiphertext);
    const tamperedCiphertext = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 99]);

    await expect(verifyCommitment(commitment, tamperedCiphertext)).rejects.toThrow(
      "The content commitment did not match the payload",
    );
  });

  it("fails verification on a tampered commitment digest", async () => {
    const commitment = await createCommitment(testCiphertext);
    const parts = commitment.split(":");
    // Swap last character of the digest
    const lastChar = parts[3].slice(-1);
    const newLastChar = lastChar === "0" ? "1" : "0";
    parts[3] = parts[3].slice(0, -1) + newLastChar;
    const tamperedCommitment = parts.join(":");

    await expect(verifyCommitment(tamperedCommitment, testCiphertext)).rejects.toThrow(
      "The content commitment did not match the payload",
    );
  });

  it("fails verification on unsupported version, algorithm, or encoding", async () => {
    const commitment = await createCommitment(testCiphertext);

    // Unsupported version
    const wrongVersion = commitment.replace("v1:", "v2:");
    await expect(verifyCommitment(wrongVersion, testCiphertext)).rejects.toThrow(
      "The requested cryptographic algorithm is unsupported",
    );

    // Unsupported algorithm
    const wrongAlgo = commitment.replace(":sha256:", ":sha512:");
    await expect(verifyCommitment(wrongAlgo, testCiphertext)).rejects.toThrow(
      "The requested cryptographic algorithm is unsupported",
    );

    // Unsupported encoding
    const wrongEncoding = commitment.replace(":hex:", ":base64:");
    await expect(verifyCommitment(wrongEncoding, testCiphertext)).rejects.toThrow(
      "The requested cryptographic algorithm is unsupported",
    );
  });

  it("fails verification on malformed commitment strings", async () => {
    await expect(verifyCommitment("invalid-commitment-string", testCiphertext)).rejects.toThrow(
      "The encrypted envelope could not be parsed",
    );

    await expect(verifyCommitment(12345 as any, testCiphertext)).rejects.toThrow(
      "The envelope failed input validation",
    );
  });
});
