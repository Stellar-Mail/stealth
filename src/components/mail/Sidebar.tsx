import React from 'react';
import { useMobile } from '../../hooks/use-mobile';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { prefersReducedMotion } = useMobile();
  const isHidden = !isOpen;

  return (
    <aside
      id="mail-sidebar"
      aria-label="Mail folder navigation"
      aria-hidden={isHidden}
      className={`fixed inset-y-0 left-0 w-64 bg-slate-900 text-white z-40 transform 
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
        ${prefersReducedMotion ? 'transition-none' : 'transition-transform duration-200 ease-in-out'}
        ${isHidden ? 'pointer-events-none invisible' : 'pointer-events-auto visible'}
      `}
    >
      <div className="p-4 flex justify-between items-center border-b border-slate-800">
        <span className="font-semibold tracking-wide">Stealth Mail</span>
        <button
          onClick={onClose}
          tabIndex={isHidden ? -1 : 0}
          aria-label="Close navigation sidebar"
          className="p-2 rounded focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          ✕
        </button>
      </div>
      <nav className="p-4 space-y-2">
        <a href="#inbox" tabIndex={isHidden ? -1 : 0} className="block p-2 rounded hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500">Inbox</a>
        <a href="#sent" tabIndex={isHidden ? -1 : 0} className="block p-2 rounded hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500">Secure Sent</a>
        <a href="#trash" tabIndex={isHidden ? -1 : 0} className="block p-2 rounded hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500">Trash</a>
      </nav>
    </aside>
  );
};
