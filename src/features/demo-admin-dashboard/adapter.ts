import type { Email } from "@/components/mail/data";

export interface DemoDataset {
  id: string;
  name: string;
  version: number;
  updatedAt: string;
  emails: Email[];
}

export interface PublishResult {
  success: boolean;
  datasetId: string;
  version: number;
  message?: string;
  error?: string;
}

export type MockFailureType = "none" | "network" | "auth" | "validation";

export interface DemoPublishingAdapter {
  listDatasets(): Promise<DemoDataset[]>;
  getDataset(id: string): Promise<DemoDataset | null>;
  publishDataset(dataset: DemoDataset): Promise<PublishResult>;
  deleteDataset(id: string): Promise<boolean>;
  setMockFailure(type: MockFailureType): void;
}

const STORAGE_KEY = "stealth-demo-datasets";
const LATENCY_MS = 300;

export class InMemoryPublishingAdapter implements DemoPublishingAdapter {
  private mockFailure: MockFailureType = "none";

  private async simulateLatencyAndCheckFailure(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));

    if (this.mockFailure === "network") {
      throw new TypeError("Failed to fetch");
    }
    if (this.mockFailure === "auth") {
      throw new Error("Unauthorized: Invalid API key or expired session");
    }
  }

  setMockFailure(type: MockFailureType): void {
    this.mockFailure = type;
  }

  private loadFromStorage(): DemoDataset[] {
    if (typeof localStorage === "undefined") return [];
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveToStorage(datasets: DemoDataset[]): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(datasets));
  }

  async listDatasets(): Promise<DemoDataset[]> {
    await this.simulateLatencyAndCheckFailure();
    return this.loadFromStorage();
  }

  async getDataset(id: string): Promise<DemoDataset | null> {
    await this.simulateLatencyAndCheckFailure();
    const datasets = this.loadFromStorage();
    return datasets.find((d) => d.id === id) ?? null;
  }

  async publishDataset(dataset: DemoDataset): Promise<PublishResult> {
    await this.simulateLatencyAndCheckFailure();

    if (this.mockFailure === "validation") {
      return {
        success: false,
        datasetId: dataset.id,
        version: dataset.version,
        error: "Validation failed: Dataset contains invalid email addresses",
      };
    }

    const datasets = this.loadFromStorage();
    const existingIndex = datasets.findIndex((d) => d.id === dataset.id);
    const updatedDataset = {
      ...dataset,
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      datasets[existingIndex] = updatedDataset;
    } else {
      datasets.push(updatedDataset);
    }

    this.saveToStorage(datasets);

    return {
      success: true,
      datasetId: dataset.id,
      version: dataset.version,
      message: `Successfully published dataset "${dataset.name}"`,
    };
  }

  async deleteDataset(id: string): Promise<boolean> {
    await this.simulateLatencyAndCheckFailure();
    const datasets = this.loadFromStorage();
    const newDatasets = datasets.filter((d) => d.id !== id);
    if (newDatasets.length === datasets.length) {
      return false;
    }
    this.saveToStorage(newDatasets);
    return true;
  }
}
