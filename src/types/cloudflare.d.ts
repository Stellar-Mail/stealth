interface KVNamespace {
  get(key: string, type: "text"): Promise<string | null>;
  get<T>(key: string, type: "json"): Promise<T | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

interface DurableObjectId {
  toString(): string;
}

interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): any;
}

interface DurableObjectState {
  id: DurableObjectId;
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put(key: string, value: any): Promise<void>;
    delete(key: string): Promise<boolean>;
    list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
      keys: Array<{ name: string }>;
      list_complete: boolean;
      cursor?: string;
    }>;
  };
}

interface R2HttpMetadata {
  contentType?: string;
  contentLanguage?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  cacheControl?: string;
  cacheExpiry?: Date;
}

interface R2ObjectMetadata {
  key: string;
  size: number;
  uploaded: Date;
  etag: string;
  httpMetadata: R2HttpMetadata;
  customMetadata: Record<string, string>;
}

interface R2Object extends R2ObjectMetadata {
  checksums: Record<string, string>;
}

interface R2ObjectBody extends R2Object {
  body: ReadableStream;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json<T>(): Promise<T>;
}

interface R2ListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
  delimiter?: string;
  include?: string[];
}

interface R2Objects {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
  delimitedPrefixes: string[];
}

interface R2PutOptions {
  httpMetadata?: R2HttpMetadata;
  customMetadata?: Record<string, string>;
  sha256?: string;
  onlyIf?: { etagMatches?: string; etagDoesNotMatch?: string };
}

interface R2Bucket {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream | string | null,
    options?: R2PutOptions,
  ): Promise<R2Object>;
  get(
    key: string,
    options?: { range?: { offset: number; length: number } },
  ): Promise<R2ObjectBody | null>;
  head(key: string): Promise<R2Object | null>;
  delete(key: string): Promise<void>;
  list(options?: R2ListOptions): Promise<R2Objects>;
}

declare module "cloudflare:workers" {
  export const env: {
    STEALTH_KV?: KVNamespace;
    STEALTH_COORDINATOR?: DurableObjectNamespace;
    STEALTH_OBJECT_STORE?: R2Bucket;
  };
  export class DurableObject {
    ctx: DurableObjectState;
    env: any;
    constructor(ctx: DurableObjectState, env: any);
  }
}

declare module "cloudflare:sockets" {
  export interface Socket {
    write(data: string): void;
    close(): void;
    startTls(): Socket;
    addEventListener(type: string, listener: (event: unknown) => void): void;
  }
  export function connect(options: {
    hostname: string;
    port: number;
    secureTransport: "on" | "off" | "starttls";
  }): Socket;
}
