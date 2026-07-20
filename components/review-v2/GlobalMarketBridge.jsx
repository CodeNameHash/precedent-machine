import { Component, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/router';
import MarketDrilldownSidebar from './MarketDrilldownSidebar';
import { formatNumericMarketSummary } from './marketNumericFormat';
import { whatsMarketPayload } from '../../lib/query/whats-market';

function encodePayload(payload) {
  return btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function plainText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((item) => plainText(item)).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    return plainText(value.label ?? value.text ?? value.code ?? value.value, fallback);
  }
  return fallback;
}

function sanitizeDeal(deal) {
  if (!deal || typeof deal !== 'object') return null;
  return {
    dealId: plainText(deal.dealId ?? deal.deal_id ?? deal.id),
    dealName: plainText(deal.dealName ?? deal.name ?? [deal.acquirer, deal.target].filter(Boolean).join(' / '), 'Unnamed deal'),
    cardId: plainText(deal.cardId ?? deal.card_id),
  };
}

function sanitizeSummary(summary) {
  if (!summary || typeof summary !== 'object') return null;
  const safe = {
    ...summary,
    attribute: plainText(summary.attribute),
    label: plainText(summary.label),
    kind: summary.kind === 'numeric' ? 'numeric' : 'categorical',
  };
  if (safe.kind !== 'numeric') {
    safe.values = (Array.isArray(summary.values) ? summary.values : []).map((value) => ({
      value: plainText(value && value.value),
      label: plainText(value && (value.label ?? value.value), 'Not captured'),
      count: Number.isFinite(Number(value && value.count)) ? Number(value.count) : null,
      denominator: Number.isFinite(Number(value && value.denominator)) ? Number(value.denominator) : null,
      deals: (Array.isArray(value && value.deals) ? value.deals : []).map(sanitizeDeal).filter(Boolean),
    }));
  }
  return safe;
}

function sanitizeContext(context, labelOverride = null) {
  if (!context || typeof context !== 'object') return null;
  const treatments = (Array.isArray(context.treatments) ? context.treatments : []).map(sanitizeSummary).filter(Boolean);
  const exceptions = (Array.isArray(context.exceptions) ? context.exceptions : []).map(sanitizeSummary).filter(Boolean);
  const metrics = (Array.isArray(context.metrics) ? context.metrics : []).map(sanitizeSummary).filter(Boolean);
  const primarySummary = sanitizeSummary(context.primarySummary) || treatments[0] || metrics[0] || exceptions[0] || null;
  if (!primarySummary) return null;
  return {
    marketKey: plainText(context.marketKey),
    label: plainText(labelOverride || context.label, 'Selected term'),
    peerSetSize: Number.isFinite(Number(context.peerSetSize)) ? Number(context.peerSetSize) : null,
    termDealCount: Number.isFinite(Number(context.termDealCount)) ? Number(context.termDealCount) : null,
    scope: plainText(context.scope),
    scopeNote: plainText(context.scopeNote),
    treatments,
    exceptions,
    metrics,
    primarySummary,
    deals: (Array.isArray(context.deals) ? context.deals : []).map(sanitizeDeal).filter(Boolean),
    truncated: Boolean(context.truncated),
  };
}

function registryContexts() {
  if (typeof window === 'undefined') return [];
  return Object.values(window.__MTX_ROW_MARKET_CONTEXTS__ || {}).map((context) => sanitizeContext(context)).filter(Boolean);
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

class MarketSidebarBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    // eslint-disable-next-line no-console
    console.error('[MarketDrilldownSidebar] render failed', error);
  }

  componentDidUpdate(prevProps) {
    if (this.state.failed && prevProps.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  render() {
    if (this.state.failed) {
      return (
        <aside className="hidden lg:block w-[340px] border-l border-border bg-white p-5 text-[11px] text-inkLight">
          Market detail could not be displayed for this row. Select another row or refresh the page.
        </aside>
      );
    }
    return this.props.children;
  }
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
          try {
            const text = cell.textContent || '';
            const match = registryContexts().find((context) => contextMatchesCell(context, text));
            if (!match) return;
            const row = td.closest('tr');
            const labelCell = row && row.querySelector('td:first-child');
            const label = labelCell ? plainText(labelCell.textContent && labelCell.textContent.trim()) : null;
            setMarketContext(sanitizeContext(match, label));
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('[GlobalMarketBridge] row click failed', error);
            setMarketContext(null);
          }
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
    const payload = { ...whatsMarketPayload(question), deal_ids: collectDealIds() };
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
          <input className="mtx-input" value={question} placeholder="e.g. ordinary-course exceptions, matching rights…" onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') runWhatsMarket(); }} aria-label="What’s market question" />
          <button type="button" className="mtx-btn mtx-btn-primary" onClick={runWhatsMarket}>What’s market? →</button>
        </div>,
        launcherHost,
      ) : null}
      {marketMode ? createPortal(
        <div style={{ position: 'fixed', right: 0, top: 'var(--mtx-head-h,72px)', zIndex: 40 }}>
          <MarketSidebarBoundary resetKey={marketContext && marketContext.marketKey}>
            <MarketDrilldownSidebar context={marketContext} onClose={() => setMarketContext(null)} />
          </MarketSidebarBoundary>
        </div>,
        document.body,
      ) : null}
    </>
  );
}

export { plainText, sanitizeContext, sanitizeDeal, sanitizeSummary };
