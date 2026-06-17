import { useState, useCallback } from 'react';
import { useNavigate, useLocation } from '@tanstack/react-router';

export function useMobileNavigation() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  const handleBack = useCallback(() => {
    // Preserve draft state
    if (location.pathname.includes('/compose')) {
      // Save draft logic here (existing Compose store)
      navigate({ to: '/mail/inbox' });
    } else if (location.pathname.includes('/message/') || location.search.messageId) {
      navigate({ to: '/mail/inbox', search: { folder: location.search.folder } });
    } else {
      window.history.back();
    }
  }, [navigate, location]);

  return {
    isDrawerOpen,
    openDrawer,
    closeDrawer,
    handleBack,
    isMobile: typeof window !== 'undefined' && window.innerWidth < 768,
  };
}
