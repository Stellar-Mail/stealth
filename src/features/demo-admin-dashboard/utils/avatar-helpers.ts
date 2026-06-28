/**
 * Extracts up to two initials from a given name string.
 * Example: "John Doe" -> "JD", "Alice" -> "A", "  spaces  " -> "S"
 */
export function getInitials(name: string): string {
  if (!name || typeof name !== 'string') return '??';

  const cleanName = name.trim().replace(/\s+/g, ' ');
  if (!cleanName) return '??';

  const parts = cleanName.split(' ');
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_COLORS = [
  '#EF4444', // Red
  '#F97316', // Orange
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Violet
  '#EC4899', // Pink
];

/**
 * Deterministically generates a hex color based on a string input.
 * Ensures the same sender name always gets the same color in the demo UI.
 */
export function getAvatarColor(name: string): string {
  if (!name || typeof name !== 'string') return '#9CA3AF'; // Default gray for empty

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}
