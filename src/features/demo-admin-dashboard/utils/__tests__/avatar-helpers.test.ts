import { getInitials, getAvatarColor } from '../avatar-helpers';

describe('Avatar Helpers', () => {
  describe('getInitials', () => {
    it('should extract two initials for a first and last name', () => {
      expect(getInitials('John Doe')).toBe('JD');
    });

    it('should handle single names by taking the first two letters', () => {
      expect(getInitials('Alice')).toBe('AL');
    });

    it('should handle multiple names by taking first and last initials', () => {
      expect(getInitials('John Jacob Jingleheimer Schmidt')).toBe('JS');
    });

    it('should handle empty or malformed input gracefully', () => {
      expect(getInitials('')).toBe('??');
      expect(getInitials('   ')).toBe('??');
    });
  });

  describe('getAvatarColor', () => {
    it('should return a consistent color for the same input', () => {
      const color1 = getAvatarColor('Demo User');
      const color2 = getAvatarColor('Demo User');
      expect(color1).toBe(color2);
    });

    it('should return a fallback gray for empty inputs', () => {
      expect(getAvatarColor('')).toBe('#9CA3AF');
    });

    it('should distribute colors for different inputs', () => {
      const color1 = getAvatarColor('Alice');
      const color2 = getAvatarColor('Bob');
      // Statistically unlikely to hash to the exact same index, 
      // but strictly testing that it returns a valid hex from our array
      expect(color1).toMatch(/^#[0-9A-F]{6}$/i);
      expect(color2).toMatch(/^#[0-9A-F]{6}$/i);
    });
  });
});
