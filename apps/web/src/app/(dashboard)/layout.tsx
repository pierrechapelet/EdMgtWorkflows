import Link from 'next/link';
import type { ReactNode } from 'react';

const navItems = [
  { href: '/dashboard/analytics', label: 'Analytics' },
  { href: '/dashboard/map', label: 'Geo Map' },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-e bg-card flex flex-col">
        <div className="p-6 border-b">
          <Link href="/portal" className="text-lg font-semibold tracking-tight">
            EdMgtWorkflows
          </Link>
          <p className="text-xs text-muted-foreground mt-1">Reports & Analytics</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
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

        <div className="p-4 border-t space-y-1">
          <Link
            href="/admin/campaigns"
            className="flex items-center rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
          >
            ← Campaigns
          </Link>
          <Link
            href="/portal"
            className="flex items-center rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
          >
            ← Portal
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
