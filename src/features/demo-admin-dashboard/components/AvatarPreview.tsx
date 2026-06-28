import React from 'react';
import { getInitials, getAvatarColor } from '../utils/avatar-helpers';

export interface AvatarPreviewProps {
  name: string;
  size?: number;
}

/**
 * Visual preview component for demo dashboard maintainers to verify
 * the generated initials and colors for fake personas.
 */
export const AvatarPreview: React.FC<AvatarPreviewProps> = ({ name, size = 40 }) => {
  const initials = getInitials(name);
  const backgroundColor = getAvatarColor(name);

  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor,
        color: '#ffffff',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: size * 0.4,
        fontFamily: 'sans-serif',
        userSelect: 'none',
      }}
      title={name}
      aria-label={`Avatar for ${name}`}
    >
      {initials}
    </div>
  );
};
