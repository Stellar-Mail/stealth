/**
 * In-process relay worker (Issue #1935 BETA-028).
 *
 * Polls the persistence queue on an interval and hands each message to an
 * injectable delivery callback. Used by the Docker entry so messages accepted
 * over HTTP are drained in the same process.
 */
import type { RelayEnvelope, RelayPersistence } from "./persistence";
import type { RelayWorker, RelayWorkerStatus } from "./worker";

export interface InProcessRelayWorkerOptions {
  pollIntervalMs?: number;
  onMessage?: (envelope: RelayEnvelope) => Promise<void>;
}

export class InProcessRelayWorker implements RelayWorker {
  private readonly pollIntervalMs: number;
  private readonly onMessage: (envelope: RelayEnvelope) => Promise<void>;
  private status: RelayWorkerStatus = "stopped";
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly persistence: RelayPersistence,
    options: InProcessRelayWorkerOptions = {},
  ) {
    this.pollIntervalMs = options.pollIntervalMs ?? 1_000;
    this.onMessage = options.onMessage ?? (async () => {});
  }

  async start(): Promise<void> {
    if (this.status === "running") return;
    this.status = "running";
    this.schedule();
  }

  async stop(): Promise<void> {
    this.status = "stopped";
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  getStatus(): RelayWorkerStatus {
    return this.status;
  }

  private schedule(): void {
    if (this.status !== "running") return;
    this.timer = setTimeout(() => {
      this.drain().finally(() => this.schedule());
    }, this.pollIntervalMs);
  }

  private async drain(): Promise<void> {
    const envelope = await this.persistence.dequeue();
    if (!envelope) return;
    try {
      await this.onMessage(envelope);
    } catch {
      await this.persistence.recordRetry();
    }
  }
}
