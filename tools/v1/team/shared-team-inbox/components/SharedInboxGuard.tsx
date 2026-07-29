import React, { ReactNode } from 'react';
import { validateSharedMessage } from '../utils/validation';
import { sanitizeMessageBody } from '../utils/sanitization';

interface SharedInboxGuardProps {
  rawMessage: unknown;
  children: (safeProps: { sender: string; subject: string; body: string; timestamp: number }) => ReactNode;
  fallback?: ReactNode;
}

export const SharedInboxGuard: React.FC<SharedInboxGuardProps> = ({ rawMessage, children, fallback }) => {
  const validation = validateSharedMessage(rawMessage);

  if (!validation.isValid || !validation.data) {
    return (
      <>{fallback || <div style={{ color: 'red', padding: '8px' }}>[Unsafe or Malformed Message Ignored]</div>}</>
    );
  }

  const safeBody = sanitizeMessageBody(validation.data.body);

  return (
    <>
      {children({
        sender: validation.data.sender,
        subject: validation.data.subject,
        body: safeBody,
        timestamp: validation.data.timestamp,
      })}
    </>
  );
};
