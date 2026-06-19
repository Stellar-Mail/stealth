import { useMemo, useState } from 'react';
import { changelogEntries } from './data';

export function useChangelog() {
  const [isOpen, setIsOpen] = useState(false);
  const [readEntries, setReadEntries] = useState<Set<string>>(new Set());

  // Memoize sorted entries to eliminate O(N log N) sorting loops on every single render pass
  const groupedEntries = useMemo(() => {
    return [...changelogEntries].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, []);

  // Compute unread entries selector lazily only when read status scales
  const unreadCount = useMemo(() => {
    return groupedEntries.filter(entry => !readEntries.has(entry.id)).length;
  }, [groupedEntries, readEntries]);

  const markAsRead = (id: string) => {
    setReadEntries(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  return {
    isOpen,
    setIsOpen,
    groupedEntries,
    unreadCount,
    readEntries,
    markAsRead
  };
}
