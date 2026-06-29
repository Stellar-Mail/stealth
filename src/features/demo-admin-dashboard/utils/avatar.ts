// Utilities for deterministic avatar colors and initials for demo personas.
// Keep deterministic, public-safe, and dependency-free.

function hashString(str: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function hslToHex(h: number, s: number, l: number) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function getAvatarSeed(name?: string, email?: string) {
  // Prefer email as a stable seed, fall back to name, finally a fixed string
  if (email && email.trim().length) return email.trim().toLowerCase();
  if (name && name.trim().length) return name.trim().toLowerCase();
  return "demo-persona";
}

export function getAvatarColor(seed: string) {
  // Map a hashed seed to an HSL color then convert to hex.
  const h = hashString(seed) % 360;
  // Use pleasant saturation/lightness for avatars
  const s = 60 + ((hashString(seed + "-s") % 20) - 10); // ~50-70
  const l = 45 + ((hashString(seed + "-l") % 10) - 5); // ~40-50
  return hslToHex(h, s, l);
}

export function getInitials(fullName: string | undefined | null, max = 2) {
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "";
  if (parts.length === 1) {
    // Single word: take up to `max` characters
    return parts[0].slice(0, max).toUpperCase();
  }

  // Multi-word: first letter of first and last
  const initials = [parts[0][0], parts[parts.length - 1][0]]
    .filter(Boolean)
    .join("")
    .slice(0, max)
    .toUpperCase();
  return initials;
}

export default {
  getAvatarSeed,
  getAvatarColor,
  getInitials,
};
