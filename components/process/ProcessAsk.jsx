import { useState } from 'react';

export default function ProcessAsk({ onAsk, disabled = false, initialQuestion = '' }) {
  const [question, setQuestion] = useState(initialQuestion);
  const submit = (event) => {
    event.preventDefault();
    const value = question.trim();
    if (value && onAsk && !disabled) onAsk(value);
  };
  return (
    <form onSubmit={submit} className="rounded border border-border bg-white p-4" aria-label="Ask Process research">
      <label htmlFor="process-research-question" className="block text-sm font-medium text-ink">Ask Process research</label>
      <div className="mt-2 flex gap-2">
        <input id="process-research-question" value={question} onChange={(event) => setQuestion(event.target.value)} disabled={disabled} className="min-w-0 flex-1 rounded border border-border px-3 py-2 text-sm text-ink" placeholder="Ask a checked process question" />
        <button type="submit" disabled={disabled || !question.trim()} className="rounded bg-ink px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Ask</button>
      </div>
    </form>
  );
}
