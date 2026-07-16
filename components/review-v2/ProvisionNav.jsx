// Review V2 ("Mergertrace") scrollspy sidebar — ported from the design-lab
// ProvisionNav prototype. Renders the non-empty sections with their palette
// dot; the active row is highlighted paper-2. Hidden below md.

export default function ProvisionNav({ sections, activeId, onJump }) {
  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-[#E0E0E0] h-[calc(100vh-108px)] sticky top-[108px] overflow-y-auto mtx-scrollbar-thin bg-white">
      <div className="px-4 pt-6 pb-3 border-b border-[#E0E0E0] bg-white">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#1F1F1F]">Provisions</span>
      </div>
      <nav className="py-1">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onJump(s.id)}
            className={`w-full text-left flex items-center gap-2 px-4 py-2 transition hover:bg-[#F6F6F6] ${activeId === s.id ? 'bg-[#F6F6F6]' : ''}`}
          >
            <span
              className="w-2 h-2 shrink-0"
              style={{ background: s.dot, borderRadius: '9999px' }}
            />
            <span className={`text-[11px] leading-tight ${activeId === s.id ? 'font-bold text-[#1F1F1F]' : 'text-[#6B6B6B]'}`}>
              {s.title}
            </span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
