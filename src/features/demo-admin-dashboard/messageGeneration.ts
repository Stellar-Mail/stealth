import type { Persona, PresetMail } from "./types";
import type { MessageTemplate } from "./templates/types";
import {
  mockDiagnosticId,
  mockMessageHash,
  mockPaymentHash,
  mockSignature,
} from "./mockHashHelpers";

/**
 * Options for generating demo messages.
 */
export interface MessageGenerationOptions {
  /** The number of messages to generate. */
  count: number;
  /** An array of sender personas to use. */
  personas: Persona[];
  /** An array of message templates for content. */
  templates: MessageTemplate[];
  /** A string seed to ensure deterministic output. */
  seed: string;
}

/**
 * A simple, deterministic pseudo-random number generator based on a seed string.
 * This ensures that the same seed will always produce the same sequence of "random" choices.
 */
const createSeededRandom = (seed: string) => {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
};

/**
 * Generates a list of realistic, deterministic demo messages.
 *
 * This utility combines sender personas and message templates to create a varied
 * set of `PresetMail` objects suitable for populating the demo UI. All data is
 * fake and generated based on a seed for repeatable results.
 *
 * This is issue 41 of 70 for the Demo Admin Dashboard initiative.
 */
export const generateDemoMessages = (options: MessageGenerationOptions): PresetMail[] => {
  const { count, personas, templates, seed } = options;
  const messages: PresetMail[] = [];
  const random = createSeededRandom(seed);

  if (personas.length === 0 || templates.length === 0) {
    return [];
  }

  for (let i = 0; i < count; i++) {
    const persona = personas[random() % personas.length];
    const template = templates[random() % templates.length];
    const messageId = `msg-gen-${seed}-${i}`;

    // Interpolate persona name into the body if a placeholder exists
    const body = template.body.replace(/{{name}}/g, persona.name.split(" ")[0]);

    messages.push({
      subject: template.subject,
      status: "Delivered",
      folder: "inbox",
      from: persona.name,
      email: persona.email,
      body,
      time: `${(random() % 12) + 1}:${String(random() % 60).padStart(2, "0")} PM`,
      unread: random() % 2 === 0,
      starred: random() % 5 === 0,
      labels: [template.category, ...(persona.id.includes("001") ? ["VIP"] : [])],
      avatarColor: "#" + random().toString(16).slice(0, 6).padStart(6, "0"),
      verifiedSender: true,
      receiptState: "sent",
      proofMetadata: {
        messageHash: mockMessageHash(messageId),
        paymentHash: mockPaymentHash(messageId),
        diagnosticId: mockDiagnosticId(messageId),
        contractAddress: `CGEN...${messageId.slice(-4).toUpperCase()}`,
        latency: `${random() % 100}ms`,
        signature: mockSignature(messageId),
        postageStatus: "settled",
      },
    });
  }

  return messages;
};
