import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useUser } from '../lib/useUser';
import { useDeals } from '../lib/useSupabaseData';

IngestPage.noLayout = true;

export default function IngestPage() {
  const router = useRouter();
  const { user } = useUser({ redirectTo: '/login' });
  const { deals: allDeals, loading: dealsLoading } = useDeals();

  const [url, setUrl] = useState('');
  const [dealId, setDealId] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null); // { kind, msg, extras }

  const canSubmit = !busy && (url.trim() || dealId);

  const onIngest = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setStatus({ kind: 'info', msg: url ? 'Fetching, extracting metadata, parsing…' : 'Re-parsing stored text…' });
    try {
      const resp = await fetch('/api/ingest/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim() || undefined,
          deal_id: dealId || undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Ingest failed');
      }
      setStatus({
        kind: 'ok',
        msg: data.created
          ? `Created deal · ${data.provisions_inserted} provisions · ${data.advisors_found} advisors`
          : `Re-ingested · ${data.provisions_inserted} provisions (${data.provisions_deleted} previous removed) · ${data.advisors_found} advisors`,
        extras: { deal_id: data.deal_id, metadata: data.metadata },
      });
      // Auto-jump to the review page after a short pause so the user sees the toast.
      setTimeout(() => router.push(`/review/${data.deal_id}`), 1200);
    } catch (e) {
      setStatus({ kind: 'err', msg: e.message });
    }
    setBusy(false);
  };

  return (
    <>
      <Head>
        <title>Ingest · Precedent Machine</title>
      </Head>

      <div
        style={{
          minHeight: '100vh',
          background: 'var(--paper)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <TopBar user={user} />

        <main
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            padding: '48px 22px 80px',
          }}
        >
          <div style={{ width: '100%', maxWidth: 640 }}>
            <div style={{ marginBottom: 24 }}>
              <div className="rec-deal-eyebrow">Ingest</div>
              <h1 className="rec-deal-title" style={{ margin: '4px 0 6px' }}>
                Pull a deal from a URL
              </h1>
              <p style={{ fontSize: 13.5, color: 'var(--ink-light)', lineHeight: 1.55, margin: 0 }}>
                Paste a SEC EDGAR filing URL. We fetch it, pull the parties and date from the
                preamble, and run the parser. If you pick an existing deal, we re-ingest using the
                same text.
              </p>
            </div>

            <section
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 12,
                padding: 22,
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
              }}
            >
              <Field
                label="Agreement URL"
                hint="Direct EDGAR exhibit (e.g. Form DEFM14A Exhibit A) or any plain-text/HTML page"
              >
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.sec.gov/Archives/edgar/…"
                  disabled={busy}
                  style={inputStyle()}
                />
              </Field>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '.14em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-faint)',
                }}
              >
                <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                <span>and / or</span>
                <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
              </div>

              <Field
                label="Re-ingest existing deal"
                hint="Pick to wipe & re-run the parser. Leave URL blank to use the stored text."
              >
                <select
                  value={dealId}
                  onChange={(e) => setDealId(e.target.value)}
                  disabled={busy || dealsLoading}
                  style={inputStyle()}
                >
                  <option value="">— New deal (use URL) —</option>
                  {(allDeals || []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.acquirer} / {d.target}
                      {d.announce_date ? ` · ${d.announce_date}` : ''}
                    </option>
                  ))}
                </select>
              </Field>

              <button onClick={onIngest} disabled={!canSubmit} style={btnStyle(canSubmit)}>
                {busy ? 'Working…' : dealId && !url ? 'Re-parse stored text' : 'Ingest'}
              </button>

              {status && <StatusBlock status={status} />}
            </section>

            <p
              style={{
                marginTop: 18,
                fontSize: 11.5,
                color: 'var(--ink-faint)',
                lineHeight: 1.5,
              }}
            >
              First ingest creates the deal record. Re-ingest wipes existing provisions and runs
              the latest parser pipeline (taxonomy, sub-codes, advisors). You'll be redirected to
              the review page on success.
            </p>

            <div style={{ marginTop: 20 }}>
              <Link
                href="/"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-light)',
                  textDecoration: 'none',
                }}
              >
                ← Back to deals
              </Link>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

function StatusBlock({ status }) {
  const palette =
    status.kind === 'ok'
      ? { bg: 'var(--accent-soft)', fg: 'var(--accent-deep)', border: 'var(--accent)' }
      : status.kind === 'err'
        ? { bg: 'color-mix(in srgb, var(--seller) 12%, transparent)', fg: 'var(--seller)', border: 'var(--seller)' }
        : { bg: 'var(--paper)', fg: 'var(--ink-mid)', border: 'var(--line)' };
  return (
    <div
      style={{
        background: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
        borderRadius: 8,
        padding: '10px 12px',
        fontSize: 12.5,
        lineHeight: 1.5,
      }}
    >
      <div style={{ fontWeight: 600 }}>{status.msg}</div>
      {status.extras?.metadata && (
        <div
          style={{
            marginTop: 6,
            fontFamily: 'var(--font-mono)',
            fontSize: 10.5,
            opacity: 0.85,
            display: 'flex',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          {status.extras.metadata.acquirer && (
            <span>Buyer: {status.extras.metadata.acquirer}</span>
          )}
          {status.extras.metadata.target && <span>Target: {status.extras.metadata.target}</span>}
          {status.extras.metadata.signing_date && (
            <span>Date: {status.extras.metadata.signing_date}</span>
          )}
          {status.extras.metadata.merger_form && (
            <span>Form: {status.extras.metadata.merger_form}</span>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          color: 'var(--ink-faint)',
        }}
      >
        {label}
      </span>
      {children}
      {hint && (
        <span style={{ fontSize: 11, color: 'var(--ink-faint)', lineHeight: 1.5 }}>{hint}</span>
      )}
    </label>
  );
}

function inputStyle() {
  return {
    width: '100%',
    padding: '9px 11px',
    border: '1px solid var(--line)',
    borderRadius: 7,
    background: 'var(--paper)',
    color: 'var(--ink)',
    fontFamily: 'inherit',
    fontSize: 13.5,
    outline: 'none',
  };
}

function btnStyle(enabled) {
  return {
    border: 'none',
    background: enabled ? 'var(--accent)' : 'var(--line)',
    color: enabled ? 'white' : 'var(--ink-faint)',
    padding: '10px 16px',
    borderRadius: 8,
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    fontWeight: 600,
    alignSelf: 'flex-start',
  };
}

function TopBar({ user }) {
  return (
    <header
      style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--line)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 56,
        padding: '0 22px',
        flexShrink: 0,
      }}
    >
      <Link href="/" className="rec-wordmark">
        <span className="mark" />
        Recital
        <span className="tag">Precedent</span>
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {user && (
          <>
            <span style={{ fontSize: 12.5, color: 'var(--ink-light)' }}>{user.name}</span>
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: 'var(--accent-soft)',
                color: 'var(--accent-deep)',
                display: 'grid',
                placeItems: 'center',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {(user.name || 'U')
                .split(/\s+/)
                .map((s) => s[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </span>
          </>
        )}
      </div>
    </header>
  );
}
