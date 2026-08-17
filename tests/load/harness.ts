export type RequestConfig = {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
};

export type LoadTestResult = {
  latenciesMs: number[];
  statusCodes: Record<number, number>;
  totalRequests: number;
  successes: number;
  failures: number;
};

export async function runLoadTest(
  name: string,
  generateRequest: (index: number) => RequestConfig,
  concurrency: number,
  iterations: number,
): Promise<LoadTestResult> {
  console.log(
    `\n▶ Starting load test: ${name} [Concurrency: ${concurrency}, Iterations: ${iterations}]`,
  );

  const result: LoadTestResult = {
    latenciesMs: [],
    statusCodes: {},
    totalRequests: iterations,
    successes: 0,
    failures: 0,
  };

  let currentIndex = 0;

  async function worker() {
    while (true) {
      const index = currentIndex++;
      if (index >= iterations) break;

      const config = generateRequest(index);

      const start = performance.now();
      try {
        const response = await fetch(config.url, {
          method: config.method || "GET",
          headers: config.headers,
          body: config.body ? JSON.stringify(config.body) : undefined,
        });

        const latency = performance.now() - start;
        result.latenciesMs.push(latency);

        result.statusCodes[response.status] = (result.statusCodes[response.status] || 0) + 1;

        if (response.ok) {
          result.successes++;
        } else {
          result.failures++;
        }
      } catch (error) {
        result.failures++;
        result.statusCodes[0] = (result.statusCodes[0] || 0) + 1; // 0 represents a network/fetch error
      }
    }
  }

  const workers = Array.from({ length: concurrency }, worker);
  await Promise.all(workers);

  result.latenciesMs.sort((a, b) => a - b);

  const p50 = result.latenciesMs[Math.floor(result.latenciesMs.length * 0.5)] || 0;
  const p90 = result.latenciesMs[Math.floor(result.latenciesMs.length * 0.9)] || 0;
  const p99 = result.latenciesMs[Math.floor(result.latenciesMs.length * 0.99)] || 0;
  const min = result.latenciesMs[0] || 0;
  const max = result.latenciesMs[result.latenciesMs.length - 1] || 0;

  console.log(`Results for ${name}:`);
  console.log(
    `  Requests: ${result.totalRequests} (Success: ${result.successes}, Fail: ${result.failures})`,
  );
  console.log(
    `  Latency (ms): min=${min.toFixed(2)}, p50=${p50.toFixed(2)}, p90=${p90.toFixed(2)}, p99=${p99.toFixed(2)}, max=${max.toFixed(2)}`,
  );
  console.log(`  Status Codes:`, result.statusCodes);

  return result;
}

export function generateRandomAddress() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let result = "G";
  for (let i = 0; i < 55; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generateRandomHash() {
  const chars = "abcdef0123456789";
  let result = "";
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
