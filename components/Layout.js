import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useUser } from '../lib/useUser';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '◈' },
  { href: '/ingest', label: 'Ingest', icon: '⊕' },
  { href: '/deals', label: 'Deals', icon: '◆' },
  { href: '/provisions', label: 'Provisions', icon: '§' },
  { href: '/compare', label: 'Compare', icon: '⇔' },
  { href: '/frankenstein', label: 'Frankenstein', icon: '⚡' },
  { href: '/admin', label: 'Admin', icon: '⚙' },
];

export default function Layout({ children }) {
  const { user, logout } = useUser();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { setSidebarOpen(false); }, [router.pathname]);

  useEffect(() => {
    const handler = () => setSidebarOpen(false);
    document.addEventListener('pm:escape', handler);
    return () => document.removeEventListener('pm:escape', handler);
  }, []);

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-50 bg-white border-b border-border px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-1 text-inkLight hover:text-ink"
            aria-label="Toggle menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              {sidebarOpen
                ? <path d="M5 5l10 10M15 5L5 15" />
                : <path d="M3 5h14M3 10h14M3 15h14" />}
            </svg>
          </button>
          <Link href="/" className="font-display text-lg font-bold tracking-widest text-ink">
            PRECEDENT MACHINE
          </Link>
        </div>
        <div className="flex items-center gap-4">
          {user && (
            <>
              <span className="text-sm text-inkLight font-ui hidden sm:inline">{user.name}</span>
              <button onClick={logout} className="text-xs text-inkFaint hover:text-ink font-ui transition-colors">
                Sign out
              </button>
            </>
          )}
        </div>
      </header>

      <div className="flex">
        {sidebarOpen && (
          <div className="fixed inset-0 bg-ink/20 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        <aside className={`
          fixed md:sticky top-[57px] z-40 md:z-auto
          w-56 shrink-0 border-r border-border bg-white
          min-h-[calc(100vh-57px)] py-6 px-4
          transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = item.href === '/' ? router.pathname === '/' : router.pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} className={`flex items-center gap-2.5 px-3 py-2 rounded text-sm font-ui transition-colors ${
                  active ? 'bg-bg text-ink font-medium' : 'text-inkLight hover:text-ink hover:bg-bg'
                }`}>
                  <span className="text-xs opacity-60 w-4 text-center">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-8 min-w-0">{children}</main>
      </div>
    </div>
  );
}
