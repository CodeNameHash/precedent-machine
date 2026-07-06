export const SEC_MEETING_FIELDS = [
  'proxyFilingDeadline',
  'mailingDeadline',
  'meetingDeadline',
  'adjournmentRights',
  'meetingControlNotes',
];

export const SEC_MEETING_COLLAPSED_TEXT = 'SEC Filing / Meeting Requirements — no data extracted';

const SEC_CODES = new Set(['COV-PROXY', 'COV-MEETING']);

const UNIT_LABELS = {
  BUSINESS_DAYS: 'business days',
  CALENDAR_DAYS: 'calendar days',
};

const TRIGGER_LABELS = {
  SIGNING: 'signing',
  AGREEMENT_DATE: 'agreement date',
  SEC_CLEARANCE: 'SEC clearance',
  NO_SEC_COMMENT_PERIOD_END: 'end of SEC no-comment period',
  EFFECTIVENESS: 'effectiveness',
  FILING: 'filing',
  MAILING: 'mailing',
  CLEARANCE: 'clearance',
};

export function unwrapFeatureValue(raw) {
  if (
    raw &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    Object.prototype.hasOwnProperty.call(raw, 'value') &&
    !Object.prototype.hasOwnProperty.call(raw, 'code')
  ) {
    return raw.value;
  }
  return raw;
}

export function featureBag(provision) {
  const meta = provision && provision.ai_metadata;
  if (!meta) return {};
  if (typeof meta === 'string') {
    try {
      const parsed = JSON.parse(meta);
      return parsed && parsed.features && typeof parsed.features === 'object' && !Array.isArray(parsed.features)
        ? parsed.features
        : {};
    } catch {
      return {};
    }
  }
  return meta.features && typeof meta.features === 'object' && !Array.isArray(meta.features)
    ? meta.features
    : {};
}

export function provisionCode(provision) {
  const meta = provision && provision.ai_metadata;
  if (meta && typeof meta === 'object' && meta.code) return meta.code;
  if (typeof meta === 'string') {
    try {
      const parsed = JSON.parse(meta);
      if (parsed && parsed.code) return parsed.code;
    } catch {
      return provision && provision.code;
    }
  }
  return provision && provision.code;
}

function nonEmptyText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isDeadlinePopulated(raw) {
  const value = unwrapFeatureValue(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return (
    nonEmptyText(value.text) ||
    typeof value.days === 'number' ||
    nonEmptyText(value.unit) ||
    nonEmptyText(value.trigger)
  );
}

function normaliseDeadline(raw) {
  const value = unwrapFeatureValue(raw);
  if (!isDeadlinePopulated(value)) return null;
  return {
    term: nonEmptyText(value.term) ? value.term.trim() : null,
    flag: nonEmptyText(value.flag) ? value.flag.trim() : null,
    text: nonEmptyText(value.text) ? value.text.trim() : null,
    days: typeof value.days === 'number' ? value.days : null,
    unit: nonEmptyText(value.unit) ? value.unit.trim() : null,
    trigger: nonEmptyText(value.trigger) ? value.trigger.trim() : null,
  };
}

function normaliseAdjournment(raw) {
  const value = unwrapFeatureValue(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const reasons = Array.isArray(value.reasons)
    ? value.reasons.filter((r) => r && typeof r === 'object' && (r.code || r.label || r.text))
    : [];
  const out = {
    party: nonEmptyText(value.party) ? value.party.trim() : null,
    reasons,
    maxAdjournments: typeof value.maxAdjournments === 'number' ? value.maxAdjournments : null,
    maxDaysPerAdjournment: typeof value.maxDaysPerAdjournment === 'number' ? value.maxDaysPerAdjournment : null,
    maxDaysTotal: typeof value.maxDaysTotal === 'number' ? value.maxDaysTotal : null,
    text: nonEmptyText(value.text) ? value.text.trim() : null,
  };
  const hasLimit = out.maxAdjournments !== null || out.maxDaysPerAdjournment !== null || out.maxDaysTotal !== null;
  if (!out.party && reasons.length === 0 && !hasLimit && !out.text) return null;
  return out;
}

export function isSecMeetingProvision(provision) {
  const code = provisionCode(provision);
  if (SEC_CODES.has(code)) return true;
  const f = featureBag(provision);
  return SEC_MEETING_FIELDS.some((key) => {
    const value = f[key];
    if (key === 'adjournmentRights') return Array.isArray(value) && value.length > 0;
    if (key === 'meetingControlNotes') return nonEmptyText(value);
    return isDeadlinePopulated(value);
  });
}

export function deriveSecMeetingSummary(provisions) {
  const summary = {
    proxyFilingDeadline: null,
    mailingDeadline: null,
    meetingDeadline: null,
    adjournmentRights: [],
    meetingControlNotes: null,
    hasData: false,
  };
  const seenAdjournments = new Set();

  for (const provision of Array.isArray(provisions) ? provisions : []) {
    if (!isSecMeetingProvision(provision)) continue;
    const f = featureBag(provision);

    for (const key of ['proxyFilingDeadline', 'mailingDeadline', 'meetingDeadline']) {
      if (!summary[key]) summary[key] = normaliseDeadline(f[key]);
    }

    if (!summary.meetingControlNotes && nonEmptyText(f.meetingControlNotes)) {
      summary.meetingControlNotes = f.meetingControlNotes.trim();
    }

    if (Array.isArray(f.adjournmentRights)) {
      for (const item of f.adjournmentRights) {
        const normalised = normaliseAdjournment(item);
        if (!normalised) continue;
        const sig = JSON.stringify(normalised);
        if (seenAdjournments.has(sig)) continue;
        seenAdjournments.add(sig);
        summary.adjournmentRights.push(normalised);
      }
    }
  }

  summary.hasData = Boolean(
    summary.proxyFilingDeadline ||
    summary.mailingDeadline ||
    summary.meetingDeadline ||
    summary.meetingControlNotes ||
    summary.adjournmentRights.length > 0,
  );
  return summary;
}

export function enumLabel(code) {
  return TRIGGER_LABELS[code] || UNIT_LABELS[code] || humanizeCode(code);
}

export function humanizeCode(code) {
  if (!code) return '';
  return String(code)
    .toLowerCase()
    .split('_')
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(' ');
}

export function formatDeadline(deadline) {
  if (!deadline) return null;
  if (typeof deadline.days === 'number') {
    const unit = UNIT_LABELS[deadline.unit] || (deadline.unit ? humanizeCode(deadline.unit).toLowerCase() : 'days');
    const base = `${deadline.days} ${unit}`;
    return deadline.trigger ? `${base} after ${enumLabel(deadline.trigger)}` : base;
  }
  return deadline.text || null;
}

export function formatAdjournmentLimits(right) {
  if (!right) return [];
  const out = [];
  if (typeof right.maxAdjournments === 'number') {
    out.push(`${right.maxAdjournments} adjournment${right.maxAdjournments === 1 ? '' : 's'}`);
  }
  if (typeof right.maxDaysPerAdjournment === 'number') {
    out.push(`${right.maxDaysPerAdjournment} days each`);
  }
  if (typeof right.maxDaysTotal === 'number') {
    out.push(`${right.maxDaysTotal} days total`);
  }
  return out;
}

export function secMeetingDisplayState(provisions) {
  const summary = deriveSecMeetingSummary(provisions);
  if (!summary.hasData) {
    return { summary, collapsed: true, collapsedText: SEC_MEETING_COLLAPSED_TEXT, rows: [] };
  }
  const rows = [
    { key: 'proxyFilingDeadline', label: summary.proxyFilingDeadline?.term || 'Filing deadline', kind: 'deadline', value: summary.proxyFilingDeadline },
    { key: 'mailingDeadline', label: summary.mailingDeadline?.term || 'Mailing', kind: 'deadline', value: summary.mailingDeadline },
    { key: 'meetingDeadline', label: summary.meetingDeadline?.term || 'Meeting', kind: 'deadline', value: summary.meetingDeadline },
    ...summary.adjournmentRights.map((right, idx) => ({
      key: `adjournmentRights-${idx}`,
      label: `Adjournment rights${right.party && !/^company$/i.test(enumLabel(right.party)) ? ` - ${enumLabel(right.party)}` : ''}`,
      kind: 'adjournment',
      value: right,
    })),
  ];
  if (summary.meetingControlNotes) {
    rows.push({ key: 'meetingControlNotes', label: 'Meeting control notes', kind: 'text', value: summary.meetingControlNotes });
  }
  for (const row of rows) {
    if (!row.label || !String(row.label).trim()) {
      row.label = 'Unlabeled value - flag for QA';
      row.qaFlag = true;
    }
  }
  return { summary, collapsed: false, collapsedText: null, rows };
}
