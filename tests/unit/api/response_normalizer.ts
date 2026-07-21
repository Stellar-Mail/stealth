export interface ContractResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
}

export async function captureResponse(response: Response): Promise<ContractResponse> {
  const status = response.status;
  const headers: Record<string, string> = {};
  response.headers.forEach((val, key) => {
    headers[key.toLowerCase()] = val;
  });

  let body: any = null;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return { status, headers, body };
}

export function normalizeResponse(res: ContractResponse): ContractResponse {
  const cloned: ContractResponse = JSON.parse(JSON.stringify(res));

  // Normalize dynamic headers
  if (cloned.headers) {
    if (cloned.headers["x-request-id"]) {
      cloned.headers["x-request-id"] = "<REQUEST_ID>";
    }
    if (cloned.headers["date"]) {
      cloned.headers["date"] = "<DATE>";
    }
  }

  // Normalize dynamic body fields
  if (cloned.body && typeof cloned.body === "object") {
    normalizeObject(cloned.body);
  }

  return cloned;
}

function normalizeObject(obj: any) {
  if (!obj || typeof obj !== "object") return;

  if (Array.isArray(obj)) {
    obj.forEach(normalizeObject);
    return;
  }

  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (key === "requestId") {
      obj[key] = "<REQUEST_ID>";
    } else if (key === "timestamp" || key === "deliveredAt" || key === "readAt" || key === "createdAt") {
      if (val !== null) {
        obj[key] = "<TIMESTAMP>";
      }
    } else if (typeof val === "string") {
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(val)) {
        obj[key] = "<TIMESTAMP>";
      }
    } else if (typeof val === "object" && val !== null) {
      normalizeObject(val);
    }
  }
}
