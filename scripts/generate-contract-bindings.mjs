#!/usr/bin/env node
/**
 * scripts/generate-contract-bindings.mjs
 *
 * Reads spec.json artifacts from each Soroban contract directory and emits
 * typed TypeScript client files to src/services/stellar/contracts/.
 *
 * Spec JSON format (contracts/soroban/{name}/spec.json):
 *   structs[]  – name + fields[]  (name, type)
 *   enums[]    – name + cases[]   (name, value)
 *   errors[]   – name + value
 *   functions[]– name + inputs[]  (name, type) + output type string
 *
 * Type string grammar:
 *   "void" | "bool" | "u32" | "i32" | "u64" | "i64" | "i128" | "u128"
 *   "address" | "bytes32"
 *   "option:<inner>"
 *   "result:<ok>:<err_udt_name>"   (ok may be "void" or a type string)
 *   "udt:<Name>"
 *
 * Run:  node scripts/generate-contract-bindings.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ---------------------------------------------------------------------------
// XDR helpers (using @stellar/stellar-sdk)
// ---------------------------------------------------------------------------
// We import via CJS require because the SDK ships CJS.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { xdr } = require("@stellar/stellar-sdk");
const T = xdr.ScSpecType;

/** Parse a type string into an XDR ScSpecTypeDef. */
function buildType(typeStr) {
  if (typeStr === "void") return xdr.ScSpecTypeDef.scSpecTypeVoid();
  if (typeStr === "bool") return xdr.ScSpecTypeDef.scSpecTypeBool();
  if (typeStr === "u32") return xdr.ScSpecTypeDef.scSpecTypeU32();
  if (typeStr === "i32") return xdr.ScSpecTypeDef.scSpecTypeI32();
  if (typeStr === "u64") return xdr.ScSpecTypeDef.scSpecTypeU64();
  if (typeStr === "i64") return xdr.ScSpecTypeDef.scSpecTypeI64();
  if (typeStr === "u128") return xdr.ScSpecTypeDef.scSpecTypeU128();
  if (typeStr === "i128") return xdr.ScSpecTypeDef.scSpecTypeI128();
  if (typeStr === "address") return xdr.ScSpecTypeDef.scSpecTypeAddress();
  if (typeStr === "string") return xdr.ScSpecTypeDef.scSpecTypeString();
  if (typeStr === "bytes32")
    return xdr.ScSpecTypeDef.scSpecTypeBytesN(new xdr.ScSpecTypeBytesN({ n: 32 }));

  if (typeStr.startsWith("option:")) {
    const inner = buildType(typeStr.slice(7));
    return xdr.ScSpecTypeDef.scSpecTypeOption(new xdr.ScSpecTypeOption({ valueType: inner }));
  }

  if (typeStr.startsWith("result:")) {
    // result:<ok>:<error_udt>
    const rest = typeStr.slice(7);
    const errSep = rest.lastIndexOf(":");
    const okStr = rest.slice(0, errSep);
    const errName = rest.slice(errSep + 1);
    return xdr.ScSpecTypeDef.scSpecTypeResult(
      new xdr.ScSpecTypeResult({
        okType: buildType(okStr),
        errorType: xdr.ScSpecTypeDef.scSpecTypeUdt(new xdr.ScSpecTypeUdt({ name: errName })),
      }),
    );
  }

  if (typeStr.startsWith("udt:")) {
    return xdr.ScSpecTypeDef.scSpecTypeUdt(new xdr.ScSpecTypeUdt({ name: typeStr.slice(4) }));
  }

  throw new Error(`Unknown type: ${typeStr}`);
}

/** Build an array of base64 XDR strings from a spec JSON object. */
function buildXdrEntries(spec) {
  const entries = [];

  for (const s of spec.structs ?? []) {
    entries.push(
      xdr.ScSpecEntry.scSpecEntryUdtStructV0(
        new xdr.ScSpecUdtStructV0({
          doc: "",
          lib: "",
          name: s.name,
          fields: s.fields.map(
            (f) =>
              new xdr.ScSpecUdtStructFieldV0({
                doc: "",
                name: f.name,
                type: buildType(f.type),
              }),
          ),
        }),
      ).toXDR("base64"),
    );
  }

  for (const e of spec.enums ?? []) {
    entries.push(
      xdr.ScSpecEntry.scSpecEntryUdtEnumV0(
        new xdr.ScSpecUdtEnumV0({
          doc: "",
          lib: "",
          name: e.name,
          cases: e.cases.map(
            (c) =>
              new xdr.ScSpecUdtEnumCaseV0({
                doc: "",
                name: c.name,
                value: c.value,
              }),
          ),
        }),
      ).toXDR("base64"),
    );
  }

  if (spec.errors?.length) {
    entries.push(
      xdr.ScSpecEntry.scSpecEntryUdtErrorEnumV0(
        new xdr.ScSpecUdtErrorEnumV0({
          doc: "",
          lib: "",
          name: "Error",
          cases: spec.errors.map(
            (e) =>
              new xdr.ScSpecUdtErrorEnumCaseV0({
                doc: "",
                name: e.name,
                value: e.value,
              }),
          ),
        }),
      ).toXDR("base64"),
    );
  }

  for (const fn of spec.functions ?? []) {
    const outputStr = fn.output ?? "void";
    const outputs = outputStr === "void" ? [] : [buildType(outputStr)];
    entries.push(
      xdr.ScSpecEntry.scSpecEntryFunctionV0(
        new xdr.ScSpecFunctionV0({
          doc: "",
          name: fn.name,
          inputs: fn.inputs.map(
            (i) =>
              new xdr.ScSpecFunctionInputV0({
                doc: "",
                name: i.name,
                type: buildType(i.type),
              }),
          ),
          outputs,
        }),
      ).toXDR("base64"),
    );
  }

  return entries;
}

// ---------------------------------------------------------------------------
// TypeScript code emitter
// ---------------------------------------------------------------------------

/**
 * Map spec type strings to TypeScript type annotations.
 * Returns { tsType, isOptional } where isOptional strips the outer option<>.
 */
function tsType(typeStr) {
  if (typeStr === "void") return "void";
  if (typeStr === "bool") return "boolean";
  if (typeStr === "u32" || typeStr === "i32") return "number";
  if (typeStr === "u64" || typeStr === "i64" || typeStr === "u128" || typeStr === "i128")
    return "bigint";
  if (typeStr === "address") return "string";
  if (typeStr === "bytes32") return "Buffer";
  if (typeStr === "string") return "string";

  if (typeStr.startsWith("option:")) {
    const inner = tsType(typeStr.slice(7));
    return `${inner} | null`;
  }

  if (typeStr.startsWith("result:")) {
    // result:<ok>:<error_udt>
    const rest = typeStr.slice(7);
    const errSep = rest.lastIndexOf(":");
    const okStr = rest.slice(0, errSep);
    const ok = tsType(okStr);
    return ok === "void" ? "void" : ok;
  }

  if (typeStr.startsWith("udt:")) return typeStr.slice(4);

  return "unknown";
}

/** Whether a function output type wraps a Result (so errors are enumerated). */
function isResult(outputStr) {
  return outputStr?.startsWith("result:");
}

/** Extract error UDT name from result type string. */
function resultErrorType(outputStr) {
  const rest = outputStr.slice(7);
  return rest.slice(rest.lastIndexOf(":") + 1);
}

function emitStructType(s) {
  const fields = s.fields
    .map((f) => {
      const optional = f.type.startsWith("option:");
      const sep = optional ? "?" : "";
      const inner = optional ? f.type.slice(7) : f.type;
      return `  ${f.name}${sep}: ${tsType(inner)};`;
    })
    .join("\n");
  return `export interface ${s.name} {\n${fields}\n}`;
}

function emitEnumType(e) {
  const cases = e.cases.map((c) => `  ${c.name} = ${c.value},`).join("\n");
  return `export enum ${e.name} {\n${cases}\n}`;
}

function emitErrorType(errors, contractName) {
  const cases = errors.map((e) => `  ${e.name} = ${e.value},`).join("\n");
  return `export enum ${contractName}Error {\n${cases}\n}`;
}

function emitClient(spec, contractName, xdrBase64Entries) {
  const { Spec, Client } = require("@stellar/stellar-sdk").contract;

  const lines = [
    `// AUTO-GENERATED — do not edit by hand.`,
    `// Source: contracts/soroban/${contractName}/spec.json`,
    `// Regenerate: npm run generate:bindings`,
    ``,
    `import { contract } from "@stellar/stellar-sdk";`,
    ``,
  ];

  // Types
  for (const s of spec.structs ?? []) {
    lines.push(emitStructType(s));
    lines.push("");
  }
  for (const e of spec.enums ?? []) {
    lines.push(emitEnumType(e));
    lines.push("");
  }
  if (spec.errors?.length) {
    lines.push(emitErrorType(spec.errors, pascalCase(contractName)));
    lines.push("");
  }

  // XDR spec entries (embedded)
  lines.push(`// Embedded XDR spec entries derived from spec.json`);
  lines.push(`const SPEC_ENTRIES: string[] = ${JSON.stringify(xdrBase64Entries, null, 2)};`);
  lines.push(``);

  // Client options interface
  lines.push(`export interface ${pascalCase(contractName)}ClientOptions {`);
  lines.push(`  contractId: string;`);
  lines.push(`  networkPassphrase: string;`);
  lines.push(`  rpcUrl: string;`);
  lines.push(`  /** Public key of the transaction source account. */`);
  lines.push(`  publicKey?: string;`);
  lines.push(`}`);
  lines.push(``);

  // Error map helper
  if (spec.errors?.length) {
    const errName = `${pascalCase(contractName)}Error`;
    const fnName = `parse${pascalCase(contractName)}Error`;
    lines.push(`/** Map a contract error code to an actionable ${errName} variant. */`);
    lines.push(`export function ${fnName}(`);
    lines.push(`  code: number`);
    lines.push(`): ${errName} | undefined {`);
    lines.push(`  return Object.values(${errName}).includes(code as ${errName})`);
    lines.push(`    ? (code as ${errName})`);
    lines.push(`    : undefined;`);
    lines.push(`}`);
    lines.push(``);
  }

  // Factory function returning contract.Client subclass
  const className = `${pascalCase(contractName)}Client`;
  lines.push(`/** Typed Soroban contract client for the ${pascalCase(contractName)} contract. */`);
  lines.push(`export function create${className}(`);
  lines.push(`  opts: ${pascalCase(contractName)}ClientOptions`);
  lines.push(`): contract.Client {`);
  lines.push(`  return new contract.Client(`);
  lines.push(`    new contract.Spec(SPEC_ENTRIES),`);
  lines.push(`    {`);
  lines.push(`      contractId: opts.contractId,`);
  lines.push(`      networkPassphrase: opts.networkPassphrase,`);
  lines.push(`      rpcUrl: opts.rpcUrl,`);
  lines.push(`      ...(opts.publicKey ? { publicKey: opts.publicKey } : {}),`);
  lines.push(`    }`);
  lines.push(`  );`);
  lines.push(`}`);
  lines.push(``);

  // Typed method wrappers that provide call-site type safety
  lines.push(`// ---------------------------------------------------------------------------`);
  lines.push(`// Typed call helpers`);
  lines.push(`// These wrap contract.Client to provide typed args and return values.`);
  lines.push(`// For Result-returning methods, call .isOk() / .isErr() on the return value.`);
  lines.push(
    `// Use the contract Error enum to identify specific errors via .unwrapErr().message.`,
  );
  lines.push(`// ---------------------------------------------------------------------------`);
  lines.push(``);

  for (const fn of spec.functions ?? []) {
    const outputStr = fn.output ?? "void";
    const retType = tsType(outputStr);
    const hasResult = isResult(outputStr);

    const fullParamList = [
      `client: contract.Client`,
      ...fn.inputs.map((i) => {
        const optional = i.type.startsWith("option:");
        const inner = optional ? i.type.slice(7) : i.type;
        return `${i.name}${optional ? "?" : ""}: ${tsType(inner)}`;
      }),
    ].join(", ");

    const argsObj = fn.inputs.length ? `{ ${fn.inputs.map((i) => i.name).join(", ")} }` : "{}";

    // Result-returning functions: the SDK returns Ok<T> | Err<{message}>
    // We use the local Result alias to avoid the constraint battle.
    if (hasResult) {
      const ok = tsType(outputStr); // already unwrapped via tsType which handles result:
      lines.push(`export async function ${camelCase(fn.name)}(`);
      lines.push(`  ${fullParamList}`);
      lines.push(
        `): Promise<contract.Ok<${ok === "void" ? "void" : ok}> | contract.Err<{ message: string }>> {`,
      );
    } else {
      lines.push(`export async function ${camelCase(fn.name)}(`);
      lines.push(`  ${fullParamList}`);
      lines.push(`): Promise<${retType}> {`);
    }
    lines.push(`  const tx = await (client as any).${fn.name}(${argsObj});`);
    lines.push(`  return tx.result;`);
    lines.push(`}`);
    lines.push(``);
  }

  return lines.join("\n");
}

function pascalCase(str) {
  return str
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

function camelCase(str) {
  const p = pascalCase(str);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const CONTRACTS = ["policies", "postage", "receipts"];
const OUT_DIR = join(ROOT, "src", "services", "stellar", "contracts");
mkdirSync(OUT_DIR, { recursive: true });

for (const name of CONTRACTS) {
  const specPath = join(ROOT, "contracts", "soroban", name, "spec.json");
  const spec = JSON.parse(readFileSync(specPath, "utf8"));
  const xdrEntries = buildXdrEntries(spec);
  const code = emitClient(spec, name, xdrEntries);
  const outPath = join(OUT_DIR, `${name}.ts`);
  writeFileSync(outPath, code, "utf8");
  execFileSync("npx", ["prettier", "--write", outPath], { stdio: "inherit" });
  console.log(`Generated ${outPath}`);
}

// Write barrel index
const index = CONTRACTS.map((c) => `export * as ${camelCase(c)} from "./${c}";`).join("\n") + "\n";
const indexPath = join(OUT_DIR, "index.ts");
writeFileSync(indexPath, index, "utf8");
execFileSync("npx", ["prettier", "--write", indexPath], { stdio: "inherit" });
console.log(`Generated ${indexPath}`);
