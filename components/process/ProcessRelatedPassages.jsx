import { sourceLabel } from './processResearchView';

export default function ProcessRelatedPassages({ passages = [], onOpen }) {
  if (!passages.length) return null;
  return <section className="rounded border border-border bg-white p-4" aria-labelledby="related-passages-heading"><h2 id="related-passages-heading" className="text-sm font-medium text-ink">Related drafting</h2><ul className="mt-3 space-y-3">{passages.map((passage) => <li key={passage.slot_identity || passage.id}><button type="button" onClick={() => onOpen?.(passage)} className="w-full text-left"><span className="block text-sm text-ink underline">{passage.preview?.content || passage.exact_content || passage.text}</span><span className="mt-1 block text-xs text-inkLight">{sourceLabel(passage)}</span></button></li>)}</ul></section>;
}
