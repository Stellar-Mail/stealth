/** Validate an exact Rust pin instead of a floating stable/nightly channel. */
export function assertRustPin({ pinned, channel }) {
  if (typeof pinned !== "string" || !/^\d+\.\d+\.\d+$/.test(pinned)) {
    return {
      ok: false,
      message: "Rust must use an exact compiler version, not a floating channel",
    };
  }
  if (channel !== pinned) {
    return {
      ok: false,
      message: `rust-toolchain.toml channel: expected ${pinned}, found ${channel ?? "missing"}`,
    };
  }
  return { ok: true, message: `rust-toolchain.toml == tool-versions.rust: ${pinned}` };
}
