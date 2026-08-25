/**
 * BETA-091: Scheduled drain for deferred verification-mail retries.
 *
 * Invoked from the Workers `scheduled` handler (and local cron) so backoff
 * retries actually run instead of remaining deferred until the isolate exits.
 */

import {
  defaultVerificationMailQueue,
  type DeliveryRecord,
  type VerificationMailQueue,
} from "./queue";

export interface VerificationMailWorkerOptions {
  queue?: VerificationMailQueue;
  batchSize?: number;
}

export async function processVerificationMailQueue(
  options: VerificationMailWorkerOptions = {},
): Promise<{ processed: number; records: DeliveryRecord[] }> {
  const queue = options.queue ?? defaultVerificationMailQueue;
  const batchSize = options.batchSize ?? 25;
  const records = await queue.processDue(batchSize);
  return { processed: records.length, records };
}
