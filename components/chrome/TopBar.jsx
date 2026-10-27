import Link from 'next/link';
import { useRouter } from 'next/router';
import { useUser } from '../../lib/useUser';
import { ViewModeToggle } from '../ViewModeContext';

// Site-wide top banner, PW redesign. The Index page and the comparison
// surface render their own mastheads; this is the shared banner for the
// review workflow and the remaining Layout pages. It keeps the same links
// and account controls as before, in the Paul, Weiss type and rule system.
export default function TopBar() {
  const { user, logout } = useUser();
  const router = useRouter();
  const path = router?.pathname || '';
  const active = (href) => (href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`));
  const links = [
    ['/', 'Index'],
    ['/review', 'Review'],
    ['/query/provisions', 'Query'],
    ['/library', 'Library'],
  ];
  return (
    <header className="pw-topbar sticky top-0 z-50 flex items-center gap-4 border-b border-[#DCE3E1] bg-white px-4 md:gap-7 md:px-10" style={{ height: 76, fontFamily: "'Inter Tight', Arial, sans-serif" }}>
      <Link href="/" className="flex shrink-0 items-center gap-3 no-underline" aria-label="Corpus. Paul, Weiss.">
        <span className="flex h-[40px] w-[40px] shrink-0 flex-col justify-center gap-[1px] bg-[#03203D] pl-[7px] text-[12.5px] font-extrabold leading-[.88] tracking-[-.03em] text-white" aria-hidden="true">
          <span>Paul,</span><span>Weiss</span>
        </span>
        <span className="flex flex-col leading-none">
          <span className="text-[20px] font-semibold tracking-[-.03em] text-[#03203D]">Corpus</span>
          <span className="mt-[4px] text-[8.5px] font-semibold uppercase tracking-[.14em] text-[#6B7785]">Precedent intelligence</span>
        </span>
      </Link>
      <nav className="hidden items-center gap-6 md:flex" aria-label="Sections">
        {links.map(([href, label]) => (
          <Link key={href} href={href} className={`border-b py-2 text-[14.5px] no-underline transition-colors ${active(href) ? 'border-[#03203D] font-semibold text-[#03203D]' : 'border-transparent text-[#33475E] hover:text-[#0B3D71]'}`} style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>
            {label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-4">
        <div className="hidden sm:block"><ViewModeToggle /></div>
        {user && (
          <>
            <span className="hidden text-sm text-[#6B7785] sm:inline">{user.name}</span>
            <span className="grid h-[26px] w-[26px] place-items-center rounded-full bg-[#F1F4F8] text-[11px] font-bold tracking-[.02em] text-[#0B3D71]">
              {(user.name || 'U').split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase()}
            </span>
            <button onClick={logout} className="whitespace-nowrap text-xs text-[#6B7785] transition-colors hover:text-[#03203D]">Sign out</button>
          </>
        )}
      </div>
    </header>
  );
}
