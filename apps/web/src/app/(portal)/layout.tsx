import Link from 'next/link';
import type { ReactNode } from 'react';
import { NotificationBell } from '@/lib/notifications/components/notification-bell';

const navItems = [
  { href: '/assignments', label: 'My Assignments' },
];

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-56 border-e bg-card flex flex-col shrink-0">
        <div className="p-5 border-b">
          <Link href="/assignments" className="text-base font-semibold tracking-tight">
            EdMgtWorkflows
          </Link>
          <p className="text-xs text-muted-foreground mt-0.5">Staff Portal</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t space-y-1">
          <Link
            href="/admin"
            className="flex items-center rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-accent"
          >
            Admin Console →
          </Link>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-12 border-b bg-card flex items-center justify-end px-4 gap-2 shrink-0">
          <NotificationBell />
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
