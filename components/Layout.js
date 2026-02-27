import Link from 'next/link';
import { useRouter } from 'next/router';
import { useUser } from '../lib/useUser';

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/deals', label: 'Deals' },
  { href: '/provisions', label: 'Provisions' },
  { href: '/compare', label: 'Compare' },
  { href: '/admin', label: 'Admin' },
];

export default function Layout({ children }) {
  const { user, logout } = useUser();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-bg">
      {/* Top Nav */}
      <header className="sticky top-0 z-50 bg-white border-b border-border px-6 py-3 flex items-center justify-between">
        <Link href="/" className="font-display text-lg font-bold tracking-widest text-ink">
          PRECEDENT MACHINE
        </Link>
        <div className="flex items-center gap-4">
          {user && (
            <>
              <span className="text-sm text-inkLight font-ui">{user.name}</span>
              <button
                onClick={logout}
                className="text-xs text-inkFaint hover:text-ink font-ui transition-colors"
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 border-r border-border bg-white min-h-[calc(100vh-57px)] py-6 px-4">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = item.href === '/'
                ? router.pathname === '/'
                : router.pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block px-3 py-2 rounded text-sm font-ui transition-colors ${
                    active
                      ? 'bg-bg text-ink font-medium'
                      : 'text-inkLight hover:text-ink hover:bg-bg'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
