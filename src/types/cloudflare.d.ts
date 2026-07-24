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
  };
}

declare module "cloudflare:workers" {
  export const env: {
    STEALTH_KV?: KVNamespace;
    STEALTH_COORDINATOR?: DurableObjectNamespace;
  };
  export class DurableObject {
    ctx: DurableObjectState;
    env: any;
    constructor(ctx: DurableObjectState, env: any);
  }
}
