// Renders the top panel of /admin/processing-flow: the source doc's mermaid
// diagram + prose, exactly like /admin/taxonomy renders the Taxonomy file's
// top panel (see pages/admin/taxonomy.js MarkdownPanel).
export function markdownBlocks(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const blocks = [];
  let code = null;
  let paragraph = [];
  function flushParagraph() {
    if (paragraph.length) blocks.push({ type: 'p', text: paragraph.join(' ') });
    paragraph = [];
  }
  for (const line of lines) {
    if (line.startsWith('```')) {
      if (code) {
        blocks.push({ type: 'code', lang: code.lang, text: code.lines.join('\n') });
        code = null;
      } else {
        flushParagraph();
        code = { lang: line.replace(/^```/, '').trim(), lines: [] };
      }
      continue;
    }
    if (code) {
      code.lines.push(line);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      blocks.push({ type: `h${heading[1].length}`, text: heading[2] });
      continue;
    }
    if (line.startsWith('|')) {
      flushParagraph();
      blocks.push({ type: 'table-line', text: line });
      continue;
    }
    if (line.startsWith('- ')) {
      flushParagraph();
      blocks.push({ type: 'li', text: line.slice(2) });
      continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph();
  return blocks;
}

export default function StageDiagram({ markdown }) {
  return (
    <div className="space-y-3 rounded border border-border bg-white p-5" data-testid="processing-flow-doc-panel">
      {markdownBlocks(markdown).map((block, index) => {
        if (block.type === 'h1') return <h1 key={index} className="font-display text-2xl text-ink">{block.text.replace(/\*\*/g, '')}</h1>;
        if (block.type === 'h2') return <h2 key={index} className="pt-3 font-display text-lg text-ink">{block.text.replace(/\*\*/g, '')}</h2>;
        if (block.type === 'h3') return <h3 key={index} className="pt-2 font-ui text-sm font-semibold text-ink">{block.text.replace(/\*\*/g, '')}</h3>;
        if (block.type === 'li') return <p key={index} className="pl-4 text-sm leading-6 text-inkLight">- {block.text.replace(/\*\*/g, '')}</p>;
        if (block.type === 'table-line') return <pre key={index} className="overflow-auto rounded bg-bg px-3 py-2 text-xs text-inkLight">{block.text}</pre>;
        if (block.type === 'code') return <pre key={index} className="overflow-auto rounded border border-border bg-bg p-4 text-xs text-inkLight" data-lang={block.lang}>{block.text}</pre>;
        return <p key={index} className="text-sm leading-6 text-inkLight">{block.text.replace(/\*\*/g, '')}</p>;
      })}
    </div>
  );
}
