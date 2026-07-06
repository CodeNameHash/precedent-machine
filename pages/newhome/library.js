import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';

LibraryPage.noLayout = true;

function slug(kind) {
  return String(kind || '').toLowerCase().replace(/_/g, '-');
}

export default function LibraryPage() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/saved-queries')
      .then((res) => res.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setRows(json.saved_queries || []);
      })
      .catch((err) => setError(err.message));
  }, []);

  return (
    <>
      <Head><title>Query Library · Corpus</title></Head>
      <main className="lib">
        <header>
          <Link href="/newhome" className="brand"><span />Corpus</Link>
          <h1>User library</h1>
        </header>
        <section>
          {error ? <p className="err">{error}</p> : rows === null ? <p>Loading saved queries...</p> : rows.length === 0 ? (
            <p>No saved queries yet.</p>
          ) : (
            <table>
              <thead><tr><th>Title</th><th>Kind</th><th>Last run</th><th>Runs</th><th>Share</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td><Link href={`/newhome/query/${slug(row.query_kind)}/${row.id}`}>{row.title}</Link></td>
                    <td>{row.query_kind.replace(/_/g, ' ')}</td>
                    <td>{row.last_run_at ? new Date(row.last_run_at).toLocaleString() : '-'}</td>
                    <td>{row.run_count || 0}</td>
                    <td>{row.is_public ? 'Public' : 'Private'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
      <style jsx>{`
        .lib { min-height: 100vh; background: var(--paper); color: var(--ink); padding: 30px; }
        header { max-width: 920px; margin: 0 auto 22px; display: flex; align-items: baseline; justify-content: space-between; }
        .brand { color: var(--ink); text-decoration: none; font-size: 22px; font-weight: 650; display: inline-flex; align-items: center; gap: 9px; }
        .brand span { width: 9px; height: 9px; border-radius: 2px; background: var(--accent); display: inline-block; }
        h1 { margin: 0; font-size: 24px; }
        section { max-width: 920px; margin: 0 auto; border: 1px solid var(--line); border-radius: 8px; background: #fff; padding: 24px; }
        p { color: var(--ink-light); margin: 0; }
        .err { color: var(--seller); }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { border-bottom: 1px solid var(--line-soft); padding: 10px; text-align: left; }
        th { color: var(--ink-faint); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; }
        td a { color: var(--accent-deep); font-weight: 650; text-decoration: none; }
      `}</style>
    </>
  );
}
