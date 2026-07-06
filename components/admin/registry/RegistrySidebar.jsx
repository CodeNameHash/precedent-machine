import FlagBadge from './FlagBadge';

function countFor(filter, fields) {
  if (filter === 'ALL') return fields.length;
  if (filter === 'FLAGGED') return fields.filter((field) => field.review_flag === 'REQUIRES_REVIEWER_DECISION').length;
  if (filter === 'VOCAB') return 0;
  return fields.filter((field) => {
    const applies = String(field.applies_to || '').split(',').map((item) => item.trim());
    const codes = Array.isArray(field.also_matches_provision_codes) ? field.also_matches_provision_codes : [];
    return applies.includes(filter)
      || field.provision_type === filter
      || field.provision_code === filter
      || codes.some((code) => code === filter || String(code).startsWith(`${filter}-`));
  }).length;
}

export default function RegistrySidebar({ active, fields, provisionTypes, vocabCount = 0, onSelect }) {
  const items = [
    { key: 'ALL', label: 'All' },
    { key: 'FLAGGED', label: 'Flagged' },
    ...provisionTypes.map((type) => ({ key: type.key, label: type.key, title: type.label })),
    { key: 'VOCAB', label: 'Vocab' },
  ];

  return (
    <aside data-testid="registry-sidebar" className="space-y-2">
      {items.map((item) => {
        const count = item.key === 'VOCAB' ? vocabCount : countFor(item.key, fields);
        const selected = active === item.key;
        return (
          <button
            key={item.key}
            type="button"
            title={item.title || item.label}
            onClick={() => onSelect(item.key)}
            className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left text-xs font-ui transition-colors ${
              selected
                ? 'border-accent bg-accent text-white'
                : 'border-border bg-white text-inkLight hover:border-accent hover:text-ink'
            }`}
          >
            <span className="truncate">{item.label}</span>
            {item.key === 'FLAGGED' && count > 0 ? (
              <FlagBadge value="REQUIRES_REVIEWER_DECISION" />
            ) : (
              <span className={selected ? 'text-white/80' : 'text-inkFaint'}>{count}</span>
            )}
          </button>
        );
      })}
    </aside>
  );
}
