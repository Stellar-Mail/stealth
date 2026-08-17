/**
 * Relay worker boundary (Issue #1935 BETA-028).
 *
 * The relay service owns the queue; a worker owns delivery. Keeping the worker
 * behind an interface lets the Docker entry run an in-process polling worker
 * while the Cloudflare deployment leaves delivery to a scheduled (cron) worker.
 */
export type RelayWorkerStatus = "idle" | "running" | "stopped";

export interface RelayWorker {
  /** Begin draining the relay queue. Idempotent. */
  start(): Promise<void>;

  /** Stop draining the relay queue. Idempotent. */
  stop(): Promise<void>;

  /** Current lifecycle status of the worker. */
  getStatus(): RelayWorkerStatus;
}
