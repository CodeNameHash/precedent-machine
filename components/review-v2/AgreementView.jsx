// Review V2 ("Mergertrace") — full merger agreement rendered verbatim in
// the prototype's editorial typography. Reuses the existing marker parser
// (lib/parser-v2/format-renderer) so the DB's marker-laden full_text renders
// structurally; plain unmarked text still gets ARTICLE / Section heuristics.

import { useMemo } from 'react';
import { parseFormattedDocument } from '../../lib/parser-v2/format-renderer';

function renderInline(tokens, keyPrefix) {
  if (!Array.isArray(tokens)) return null;
  return tokens.map((t, i) => {
    const key = `${keyPrefix}-${i}`;
    if (t.type === 'ref') return <span key={key} className="mtx-doc-ref">{t.text}</span>;
    if (t.type === 'defined') return <span key={key} className="mtx-doc-defined">{t.text}</span>;
    return <span key={key}>{t.text}</span>;
  });
}

function inlinePlainText(tokens) {
  if (!Array.isArray(tokens)) return '';
  return tokens.map((t) => t.text || '').join('');
}

const ARTICLE_LINE_RE = /^ARTICLE\s+[IVXLC0-9]+/i;
const SECTION_LINE_RE = /^((?:Section|§)\s*\d+\.\d+[.\s]*)([\s\S]*)$/i;

function isAllCapsHeading(text) {
  const t = text.trim();
  if (!t || t.length > 80) return false;
  if (!/[A-Z]/.test(t)) return false;
  return t === t.toUpperCase();
}

function ArticleHeading({ number, title }) {
  return (
    <h2 className="mtx-serif text-lg font-bold text-[#1F1F1F] pb-2 border-b-2 border-black mt-10 mb-4">
      {number}
      {title ? <span className="font-normal"> — {title}</span> : null}
    </h2>
  );
}

function CenterHeading({ text }) {
  return (
    <p className="mtx-serif text-center font-bold text-[#1F1F1F] my-4 whitespace-pre-wrap">{text}</p>
  );
}

function SectionHeading({ number, title, inline, blockKey }) {
  return (
    <div className="mt-6">
      <p className="mtx-doc-body">
        <span className="mtx-mono text-[12px] text-[#6B6B6B] mr-2">{number}</span>
        {title ? <strong className="font-bold">{title}.</strong> : null}
        {inline && inline.length ? <> {renderInline(inline, blockKey)}</> : null}
      </p>
    </div>
  );
}

function TocBlock({ children }) {
  return (
    <div className="my-8 border border-[#E0E0E0]">
      <div className="px-4 py-2 bg-[#F6F6F6] border-b border-[#E0E0E0]">
        <span className="mtx-meta-label text-[9px] tracking-[0.14em]">Table of contents</span>
      </div>
      <div className="px-4 py-3">
        {(children || []).map((c, i) => {
          const key = `toc-${i}`;
          if (c.type === 'toc_heading') return null; // chrome label above already says it
          if (c.type === 'toc_article') {
            return (
              <p key={key} className="mtx-serif text-[13.5px] font-bold text-[#1F1F1F] mt-3 mb-1">
                {c.number}{c.title ? ` — ${c.title}` : ''}
              </p>
            );
          }
          if (c.type === 'toc_entry') {
            return (
              <p key={key} className="text-[12px] leading-6 text-[#1F1F1F] flex gap-2 items-baseline">
                <span className="mtx-mono text-[11px] text-[#6B6B6B] shrink-0">{c.number}</span>
                <span className="min-w-0">{c.title}</span>
                {c.page ? <span className="mtx-mono text-[11px] text-[#6B6B6B] ml-auto shrink-0">{c.page}</span> : null}
              </p>
            );
          }
          return (
            <p key={key} className="mtx-doc-body text-[12.5px]">{renderInline(c.inline, key)}</p>
          );
        })}
      </div>
    </div>
  );
}

function Paragraph({ block, blockKey }) {
  const plain = inlinePlainText(block.inline).trim();
  // Plain-text structural heuristics for unmarked documents.
  if (ARTICLE_LINE_RE.test(plain) && plain.length <= 80) {
    return <ArticleHeading number={plain} title="" />;
  }
  if (isAllCapsHeading(plain)) {
    return <CenterHeading text={plain} />;
  }
  const sec = plain.match(SECTION_LINE_RE);
  if (sec && block.inline.length === 1) {
    return (
      <p className="mtx-doc-body mt-6">
        <span className="mtx-mono text-[12px] text-[#6B6B6B] mr-2">{sec[1].trim()}</span>
        <strong className="font-bold">{sec[2]}</strong>
      </p>
    );
  }
  return <p className="mtx-doc-body">{renderInline(block.inline, blockKey)}</p>;
}

export default function AgreementView({ agreementSource, loading = false }) {
  const fullText = agreementSource?.full_text || '';
  const blocks = useMemo(() => parseFormattedDocument(fullText), [fullText]);

  const meta = agreementSource?.metadata && typeof agreementSource.metadata === 'object'
    ? agreementSource.metadata
    : {};
  const metaBits = [];
  const charCount = meta.char_count || fullText.length;
  if (charCount) metaBits.push(`${Number(charCount).toLocaleString('en-US')} characters`);
  if (meta.ingested_at) {
    const d = new Date(meta.ingested_at);
    if (!Number.isNaN(d.getTime())) {
      metaBits.push(`ingested ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`);
    }
  }

  if (!fullText) {
    // Q4 (perf quick-wins): source text is fetched lazily — before it
    // arrives (or while a cold on-demand fetch is in flight) show a loading
    // state rather than the "unavailable" message, which is only accurate
    // once the fetch has actually resolved.
    return (
      <main className="flex-1 min-w-0 px-5 lg:px-9 pt-6 pb-7">
        <p className="mtx-meta-label text-[10px] tracking-[0.14em]" data-testid={loading ? 'agreement-view-loading' : undefined}>
          {loading ? 'Loading source document…' : 'No source text available for this deal.'}
        </p>
      </main>
    );
  }

  return (
    <main className="flex-1 min-w-0 px-5 lg:px-9 pt-6 pb-7">
      <div className="max-w-3xl mx-auto">
        <p className="mtx-meta-label text-[10px] tracking-[0.16em]">Source document · Verbatim text</p>

        <div className="mt-3 pb-3 border-b-2 border-black">
          <h1 className="mtx-serif text-2xl font-bold tracking-tight text-[#1F1F1F]">
            {agreementSource?.title || 'Merger Agreement'}
          </h1>
          {metaBits.length ? (
            <p className="text-[10px] text-[#6B6B6B] mt-1 uppercase tracking-wider">{metaBits.join(' · ')}</p>
          ) : null}
        </div>

        <article className="mt-6">
          {blocks.map((block, i) => {
            const key = `blk-${i}`;
            if (block.type === 'article') return <ArticleHeading key={key} number={block.number} title={block.title} />;
            if (block.type === 'article_title') return <CenterHeading key={key} text={block.text} />;
            if (block.type === 'center') return <CenterHeading key={key} text={block.text} />;
            if (block.type === 'section') {
              return <SectionHeading key={key} number={block.number} title={block.title} inline={block.inline} blockKey={key} />;
            }
            if (block.type === 'toc') return <TocBlock key={key}>{block.children}</TocBlock>;
            return <Paragraph key={key} block={block} blockKey={key} />;
          })}
        </article>

        <footer className="mt-12 pt-4 border-t border-[#E0E0E0] flex items-center justify-between">
          <p className="mtx-meta-label text-[9px] tracking-wider">Corpus · For internal review · Privileged &amp; confidential</p>
          <p className="text-[9px] text-[#6B6B6B]">
            Updated {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </footer>
      </div>
    </main>
  );
}
