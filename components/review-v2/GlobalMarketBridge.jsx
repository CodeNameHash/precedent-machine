import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/router';
import MarketDrilldownSidebar from './MarketDrilldownSidebar';
import { formatNumericMarketSummary } from './marketNumericFormat';
import { whatsMarketPayload } from '../../lib/query/whats-market';

function encodePayload(payload) {
  return btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function registryContexts() {
  if (typeof window === 'undefined') return [];
  return Object.values(window.__MTX_ROW_MARKET_CONTEXTS__ || {});
}

function contextMatchesCell(context, text) {
  const summary = context && context.primarySummary;
  if (!summary) return false;
  const haystack = String(text || '').toLowerCase();
  if (summary.kind === 'numeric') {
    const formatted = formatNumericMarketSummary(summary);
    return Boolean(formatted && formatted.headline && haystack.includes(String(formatted.headline).toLowerCase()));
  }
  const top = Array.isArray(summary.values) ? summary.values[0] : null;
  return Boolean(top && haystack.includes(String(top.label || top.value || '').toLowerCase()));
}

function collectDealIds() {
  if (typeof document === 'undefined') return [];
  const ids = new Set();
  document.querySelectorAll('a[href^="/review/"]').forEach((link) => {
    const match = String(link.getAttribute('href') || '').match(/\/review\/([0-9a-f-]{36})/i);
    if (match) ids.add(match[1]);
  });
  return [...ids];
}

export default function GlobalMarketBridge() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [marketContext, setMarketContext] = useState(null);
  const [launcherHost, setLauncherHost] = useState(null);
  const [question, setQuestion] = useState('');

  const marketMode = useMemo(
    () => router.pathname === '/review/[id]' && ['1', 'true'].includes(String(router.query.market || '')),
    [router.pathname, router.query.market],
  );

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || router.pathname !== '/') {
      setLauncherHost(null);
      return undefined;
    }
    let host = document.querySelector('[data-global-market-launcher]');
    if (!host) {
      const box = document.querySelector('.qlb');
      const tabs = box && box.querySelector('.qlbTabsRow');
      if (!box || !tabs) return undefined;
      host = document.createElement('div');
      host.setAttribute('data-global-market-launcher', 'true');
      box.insertBefore(host, tabs);
    }
    setLauncherHost(host);
    return () => {
      if (host && host.parentNode) host.parentNode.removeChild(host);
      setLauncherHost(null);
    };
  }, [mounted, router.pathname]);

  useEffect(() => {
    if (!mounted || !marketMode) return undefined;
    const handlers = new Map();
    const hiddenAsides = new Map();

    const enhance = () => {
      document.querySelectorAll('aside').forEach((aside) => {
        if (aside.getAttribute('data-testid') === 'market-drilldown-sidebar') return;
        if (!hiddenAsides.has(aside)) hiddenAsides.set(aside, aside.style.display);
        aside.style.display = 'none';
      });

      document.querySelectorAll('[data-testid="market-cell"]').forEach((cell) => {
        const td = cell.closest('td');
        if (!td || handlers.has(td)) return;
        td.style.cursor = 'pointer';
        td.setAttribute('data-market-drilldown-cell', 'true');
        if (!td.querySelector('[data-market-drilldown-cta]')) {
          const cta = document.createElement('div');
          cta.setAttribute('data-market-drilldown-cta', 'true');
          cta.textContent = 'See all treatments & deals →';
          cta.style.marginTop = '4px';
          cta.style.fontSize = '9px';
          cta.style.fontWeight = '600';
          cta.style.textTransform = 'uppercase';
          cta.style.letterSpacing = '.08em';
          cta.style.color = '#2F6DB5';
          td.appendChild(cta);
        }
        const handler = () => {
          const text = cell.textContent || '';
          const match = registryContexts().find((context) => contextMatchesCell(context, text));
          if (!match) return;
          const row = td.closest('tr');
          const label = row && row.querySelector('td:first-child') ? row.querySelector('td:first-child').textContent.trim() : null;
          setMarketContext({ ...match, label: label || match.label });
        };
        td.addEventListener('click', handler);
        handlers.set(td, handler);
      });
    };

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      handlers.forEach((handler, td) => td.removeEventListener('click', handler));
      hiddenAsides.forEach((display, aside) => { aside.style.display = display; });
      document.querySelectorAll('[data-market-drilldown-cta]').forEach((node) => node.remove());
    };
  }, [mounted, marketMode]);

  const runWhatsMarket = () => {
    const payload = {
      ...whatsMarketPayload(question),
      deal_ids: collectDealIds(),
    };
    router.push(`/query/whats-market/adhoc?payload=${encodePayload(payload)}`);
  };

  if (!mounted) return null;

  return (
    <>
      {launcherHost ? createPortal(
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1fr) minmax(220px,1.4fr) auto', gap: 10, alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #EEEEEE', background: '#fff' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <strong style={{ fontSize: 12 }}>What’s market?</strong>
            <span style={{ fontSize: 10, color: '#6B6B6B' }}>Ask about a term, or leave blank for the full M&amp;A overview.</span>
          </div>
          <input
            className="mtx-input"
            value={question}
            placeholder="e.g. ordinary-course exceptions, matching rights…"
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') runWhatsMarket(); }}
            aria-label="What’s market question"
          />
          <button type="button" className="mtx-btn mtx-btn-primary" onClick={runWhatsMarket}>What’s market? →</button>
        </div>,
        launcherHost,
      ) : null}
      {marketMode ? createPortal(
        <div style={{ position: 'fixed', right: 0, top: 'var(--mtx-head-h,72px)', zIndex: 40 }}>
          <MarketDrilldownSidebar context={marketContext} onClose={() => setMarketContext(null)} />
        </div>,
        document.body,
      ) : null}
    </>
  );
}
