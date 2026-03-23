'use client';

import { useState, useRef, useEffect } from 'react';
import { useUnreadCount } from '@/lib/api/hooks/use-notifications';
import { NotificationPanel } from './notification-panel';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data: count = 0 } = useUnreadCount();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ''}`}
      >
        {/* Bell SVG */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>

        {/* Badge */}
        {count > 0 && (
          <span className="absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute end-0 top-full mt-2 w-96 max-h-[480px] rounded-xl border bg-white shadow-xl z-50 flex flex-col overflow-hidden">
          <NotificationPanel onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
