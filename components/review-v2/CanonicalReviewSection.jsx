import {
  Component, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { MarketMetricCell } from './MarketColumn';
import { buildTypedRowMarketContext } from './rowMarketContext';
import triggerPresentation from '../../lib/canonical-v2/termination-fee-trigger-presentation';
import reviewPagination from '../../lib/canonical-v2/review-pagination';
import { SeeProvisionDisclosure } from '../review/primitives/ProvisionTablePrimitives';

const {
  conditionExpressionView,
  factLabel,
  pathwayLabel,
  paymentTimingLabel,
  terminatingPartyLabel,
  triggerLabel,
} = triggerPresentation;
const {
  appendReviewPage,
  assertReviewPageContinuation,
  sameReviewPageIdentity,
} = reviewPagination;

const ENABLED = ['1', 'true', 'on', 'yes'].includes(
  String(process.env.NEXT_PUBLIC_CANONICAL_V2_REVIEW_ENABLED || '').toLowerCase(),
);
export const CANONICAL_REVIEW_ENABLED = ENABLED;

async function fetchJson(url) {
  const response = await fetch(url);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || `HTTP ${response.status}`);
  return body;
}

function exactText(detail) {
  if (typeof detail?.excerpt?.exact_text === 'string') return detail.excerpt.exact_text;
  if (Array.isArray(detail?.exact_excerpts)) {
    return detail.exact_excerpts.map((excerpt) => excerpt.exact_text).filter(Boolean).join('\n\n');
  }
  return '';
}

function terminationFeeTriggerView(detail) {
  const schemaVersion = detail?.schema_version;
  const supportedSchema = schemaVersion === 'SERVING_EXACT_DETAIL_TERMINATION_FEE_TRIGGERS_RESPONSE/V1'
    || schemaVersion === 'SERVING_EXACT_DETAIL_TERMINATION_FEE_TRIGGERS_RESPONSE/V2';
  if (!supportedSchema || detail?.detail_kind !== 'TERMINATION_FEE_TRIGGER_EVIDENCE') return null;
  if (!Number.isInteger(detail.trigger_count)
    || detail.trigger_count < 1
    || detail.trigger_count > 16
    || !Array.isArray(detail.triggers)
    || detail.trigger_count !== detail.triggers.length
    || !Array.isArray(detail.excerpts)) {
    throw new Error('Certified trigger detail is incomplete.');
  }
  const excerpts = new Map(detail.excerpts.map((excerpt) => [
    excerpt.excerpt_id,
    excerpt.exact_text,
  ]));
  const triggers = [...detail.triggers]
    .sort((left, right) => left.relationship_ordinal - right.relationship_ordinal)
    .map((trigger, index) => {
      const effect = trigger?.effect;
      const governedV2 = schemaVersion.endsWith('/V2');
      const indexedFacts = governedV2 ? effect?.indexed_facts : effect?.conditions;
      const timing = paymentTimingLabel(effect);
      const terminatingParty = terminatingPartyLabel(effect);
      if (trigger.relationship_ordinal !== index
        || ![
          'CREATES_BUYER_TERMINATION_FEE_PAYMENT_TRIGGER',
          'CREATES_SELLER_TERMINATION_FEE_PAYMENT_TRIGGER',
        ].includes(effect?.legal_operation)
        || !triggerLabel(effect)
        || !Array.isArray(indexedFacts)
        || !indexedFacts.every((fact) => factLabel(fact, effect))
        || !Array.isArray(trigger.evidence_references)
        || trigger.evidence_references.length === 0) {
        throw new Error('Certified trigger detail contains an unsupported legal term.');
      }
      const pathway = effect.pathway_code == null ? null : pathwayLabel(effect);
      if (governedV2 && (!pathway || !effect.condition_expression)) {
        throw new Error('Certified trigger detail contains an unsupported legal term.');
      }
      const logic = governedV2 ? conditionExpressionView(effect.condition_expression, effect) : null;
      const evidence = trigger.evidence_references.map((reference) => excerpts.get(reference.excerpt_id));
      if (evidence.some((text) => typeof text !== 'string' || !text)) {
        throw new Error('Certified trigger evidence is incomplete.');
      }
      return Object.freeze({
        key: trigger.relationship_revision_id,
        label: triggerLabel(effect),
        pathway,
        timing,
        terminatingParty,
        conditions: Object.freeze(
          governedV2 ? [] : indexedFacts.map((fact) => factLabel(fact, effect)),
        ),
        logic,
        evidence: Object.freeze([...new Set(evidence)]),
      });
    });
  return Object.freeze({
    kind: 'termination_fee_triggers',
    triggerCount: detail.trigger_count,
    triggers: Object.freeze(triggers),
  });
}

function governedSourceDetail(detail) {
  const triggerView = terminationFeeTriggerView(detail);
  if (triggerView) return triggerView;
  const text = exactText(detail);
  if (!text) throw new Error('Exact source is unavailable.');
  return Object.freeze({ kind: 'exact_text', text });
}

function RowFailure({ item }) {
  return (
    <div className="border border-[#D8B56A] bg-[#FFF9EC] px-3 py-2" data-canonical-row-failed={item.key}>
      <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#8A6417]">Provision needs review</div>
      <p className="mt-1 text-[10px] leading-4 text-[#5F4A1E]">
        This row could not be rendered safely. Other certified provisions remain available.
      </p>
    </div>
  );
}

class CanonicalRowErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <RowFailure item={this.props.item} />;
    return this.props.children;
  }
}

function ConditionExpression({ expression }) {
  if (expression.operator === 'FACT') return <span>{expression.label}</span>;
  if (expression.operator === 'IF_THEN') {
    return (
      <div className="border-l border-[#C7CED8] pl-2">
        <div><span className="font-bold">If:</span> <ConditionExpression expression={expression.if} /></div>
        <div className="mt-1"><span className="font-bold">Then:</span> <ConditionExpression expression={expression.then} /></div>
      </div>
    );
  }
  return (
    <div className="border-l border-[#C7CED8] pl-2">
      <div className="font-bold">{expression.operator === 'ALL_OF' ? 'All of:' : 'Any one of:'}</div>
      <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
        {expression.operands.map((operand, index) => (
          <li key={`${expression.operator}:${index}`}>
            <ConditionExpression expression={operand} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TerminationFeeTriggerDetail({ detail }) {
  return (
    <div data-canonical-trigger-detail>
      <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#55514B]">
        {detail.triggerCount} certified fee triggers
      </div>
      <ol className="mt-2 space-y-2">
        {detail.triggers.map((trigger) => (
          <li key={trigger.key} className="border border-[#DDE3EC] bg-white px-3 py-2">
            <div className="text-[10px] font-bold text-[#1F1F1F]">{trigger.label}</div>
            {trigger.pathway ? <div className="mt-1 text-[10px] text-[#55514B]">{trigger.pathway}</div> : null}
            <div className="mt-1 text-[10px] text-[#55514B]">{trigger.terminatingParty}. {trigger.timing}.</div>
            {trigger.logic ? (
              <div className="mt-2 text-[10px] leading-4 text-[#55514B]">
                <ConditionExpression expression={trigger.logic} />
              </div>
            ) : null}
            {trigger.conditions.length ? (
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[10px] text-[#55514B]">
                {trigger.conditions.map((condition) => <li key={condition}>{condition}</li>)}
              </ul>
            ) : null}
            <SeeProvisionDisclosure
              className="mt-2"
              triggerClassName="cursor-pointer text-[9px] font-bold uppercase tracking-[0.08em] text-[#2F6DB5]"
              label="Exact trigger evidence"
            >
              {trigger.evidence.map((text, index) => (
                <p key={`${trigger.key}:${index}`} className="mt-2 whitespace-pre-wrap text-[10px] leading-4 text-[#1F1F1F]">
                  {text}
                </p>
              ))}
            </SeeProvisionDisclosure>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function CanonicalSourceDetail({
  envelope,
  rowKey,
  sourceAction,
  governedDealKey = null,
}) {
  const [state, setState] = useState({
    open: false,
    loading: false,
    error: null,
    detail: null,
  });
  const toggle = useCallback(async () => {
    if (state.open) {
      setState((current) => ({ ...current, open: false }));
      return;
    }
    if (state.detail) {
      setState((current) => ({ ...current, open: true }));
      return;
    }
    setState({ open: true, loading: true, error: null, detail: null });
    try {
      const query = new URLSearchParams({
        namespace: envelope.serving_namespace_id,
        release: envelope.corpus_release_id,
        contract: envelope.contract_fingerprint,
        row: rowKey,
        source: sourceAction.source_detail_reference_id,
      });
      if (envelope.application_deal_id) query.set('dealId', envelope.application_deal_id);
      else if (governedDealKey) query.set('dealKey', governedDealKey);
      else throw new Error('The selected deal identity is unavailable.');
      const body = await fetchJson(`/api/canonical-v2/exact-detail?${query.toString()}`);
      setState({
        open: true,
        loading: false,
        error: null,
        detail: governedSourceDetail(body.detail),
      });
    } catch (error) {
      setState({
        open: true,
        loading: false,
        error: error.message || String(error),
        detail: null,
      });
    }
  }, [envelope, governedDealKey, rowKey, sourceAction, state.detail, state.open]);

  return (
    <div className="mt-2 border-t border-[#E6E4DF] pt-2">
      <button
        type="button"
        onClick={(event) => { event.stopPropagation(); toggle(); }}
        className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#2F6DB5] hover:underline"
        aria-expanded={state.open}
      >
        {state.open ? 'Hide provision' : 'See provision'}
      </button>
      {state.open ? (
        <div className="mt-2 border-l-2 border-[#2F6DB5] bg-[#F7F9FC] px-3 py-2 text-[10px] leading-4 text-[#1F1F1F]">
          {state.loading ? 'Loading exact source…' : null}
          {state.error ? <span className="text-[#9A2E2E]">{state.error}</span> : null}
          {state.detail?.kind === 'exact_text' ? (
            <p className="whitespace-pre-wrap">{state.detail.text}</p>
          ) : null}
          {state.detail?.kind === 'termination_fee_triggers' ? (
            <TerminationFeeTriggerDetail detail={state.detail} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function canonicalSidebarContext(prepared) {
  if (prepared?.resolution?.rowKind === 'REVIEWED_SOURCE_SPECIFIC') {
    const sourceSpecific = prepared.resolution.sourceSpecific;
    const currentDealTerms = sourceSpecific.primitives.map((primitive) => ({
      key: primitive.key,
      label: primitive.kind.replaceAll('_', ' ').toLowerCase(),
      value: String(primitive.interpretedValue ?? primitive.rawValue),
    }));
    return {
      marketKey: prepared.row_key,
      marketRowKey: prepared.row_key,
      label: sourceSpecific.displayLabel,
      peerSetSize: null,
      termDealCount: null,
      scope: 'reviewed-source-specific',
      scopeNote: sourceSpecific.nonComparableReason,
      treatments: [],
      exceptions: [],
      metrics: [],
      currentDealTerms,
      primarySummary: null,
      deals: [],
      truncated: false,
    };
  }
  return buildTypedRowMarketContext(prepared?.resolution, prepared?.data);
}

function uniqueBy(values, identity) {
  const seen = new Set();
  return values.filter((value) => {
    const key = identity(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sharedFiniteValue(contexts, key) {
  const values = [...new Set(contexts.map((context) => context?.[key]).filter(Number.isFinite))];
  return values.length === 1 ? values[0] : null;
}

function combineCanonicalSidebarContexts(preparedRows, {
  label = 'Selected term',
  marketKey = 'canonical-review-row',
} = {}) {
  const contexts = (preparedRows || []).map(canonicalSidebarContext).filter(Boolean);
  if (!contexts.length) return null;
  const arrays = (key) => uniqueBy(
    contexts.flatMap((context) => (Array.isArray(context[key]) ? context[key] : [])),
    (value) => JSON.stringify(value),
  );
  const currentDealTerms = uniqueBy(
    contexts.flatMap((context) => (Array.isArray(context.currentDealTerms) ? context.currentDealTerms : [])),
    (term) => `${term?.key || term?.label || ''}\u0000${term?.value || ''}`,
  );
  const deals = uniqueBy(
    contexts.flatMap((context) => (Array.isArray(context.deals) ? context.deals : [])),
    (deal) => String(deal?.dealId || deal?.deal_id || deal?.id || JSON.stringify(deal)),
  );
  const scopeNote = [...new Set(contexts.map((context) => context.scopeNote).filter(Boolean))].join(' ');
  const treatments = arrays('treatments');
  const exceptions = arrays('exceptions');
  const metrics = arrays('metrics');
  return {
    marketKey,
    marketRowKey: marketKey,
    label,
    peerSetSize: sharedFiniteValue(contexts, 'peerSetSize'),
    termDealCount: sharedFiniteValue(contexts, 'termDealCount'),
    scope: 'canonical-review-binding',
    scopeNote,
    treatments,
    exceptions,
    metrics,
    currentDealTerms,
    primarySummary: metrics[0] || treatments[0] || exceptions[0] || contexts[0].primarySummary,
    deals,
    truncated: contexts.some((context) => context.truncated),
  };
}

function canonicalRowInteraction(item, context, onSelectCanonicalContext) {
  if (!context || !onSelectCanonicalContext) return { onClick: null, select: null };
  const select = () => onSelectCanonicalContext(context, item.prepared.row_key);
  return { onClick: select, select };
}

function CanonicalContextButton({ select, selected, sourceSpecific = false }) {
  if (!select) return null;
  return (
    <button
      type="button"
      onClick={(event) => { event.stopPropagation(); select(); }}
      className="mt-2 text-[9px] font-bold uppercase tracking-[0.1em] text-[#2F6DB5] hover:underline"
      aria-pressed={selected}
      data-canonical-context-select
    >
      {selected ? 'Context selected' : (sourceSpecific ? 'View deal context' : 'Compare terms')}
    </button>
  );
}

function CanonicalResult({ item, envelope, selected, onSelectCanonicalContext }) {
  const adapted = item.prepared;
  const metricKey = adapted.resolution.metrics[0].metricKey;
  const metric = adapted.data.byRow[adapted.row_key].metrics[metricKey];
  const context = canonicalSidebarContext(adapted);
  const interaction = canonicalRowInteraction(item, context, onSelectCanonicalContext);
  const comparableCount = metric.coverage?.comparableCount;
  return (
    <div
      onClick={interaction.onClick || undefined}
      className={`border bg-white ${selected ? 'border-[#2F6DB5] shadow-[inset_2px_0_0_#2F6DB5]' : 'border-[#E6E4DF]'} ${interaction.onClick ? 'cursor-pointer' : ''}`}
      data-canonical-row-key={adapted.row_key}
      data-canonical-row-kind={adapted.resolution.rowKind}
    >
      <table className="w-full table-fixed text-xs font-ui">
        <tbody>
          <tr className="align-top">
            <td className="w-[36%] border-b border-[#E6E4DF] px-3 py-3 md:border-b-0 md:border-r">
              <div className="text-[10px] font-bold text-[#1F1F1F]">{adapted.resolution.label}</div>
              <div className="mt-1 text-[11px] font-semibold text-[#2F6DB5]">{metric.subject.label}</div>
              {Number.isFinite(comparableCount) ? (
                <div className="mt-2 text-[9px] text-[#77736C]">
                  {comparableCount} comparable deal{comparableCount === 1 ? '' : 's'}
                </div>
              ) : (
                <div className="mt-2 text-[9px] text-[#8A642E]">Selected-deal context only</div>
              )}
              <CanonicalContextButton select={interaction.select} selected={selected} />
            </td>
            <td className="px-3 py-3">
              <MarketMetricCell resolution={adapted.resolution} data={adapted.data} />
            </td>
          </tr>
        </tbody>
      </table>
      <div className="px-3 pb-3">
        {metric.source?.state === 'available' ? (
          <CanonicalSourceDetail
            envelope={envelope}
            rowKey={adapted.row_key}
            sourceAction={metric.source.action}
          />
        ) : null}
      </div>
    </div>
  );
}

function SourceSpecificResult({ item, envelope, selected, onSelectCanonicalContext }) {
  const adapted = item.prepared;
  const context = adapted.resolution.sourceSpecific;
  const sidebarContext = canonicalSidebarContext(adapted);
  const interaction = canonicalRowInteraction(item, sidebarContext, onSelectCanonicalContext);
  return (
    <div
      onClick={interaction.onClick || undefined}
      className={`border bg-[#FFFCF4] px-3 py-3 ${selected ? 'border-[#2F6DB5] shadow-[inset_2px_0_0_#2F6DB5]' : 'border-[#D8B56A]'} ${interaction.onClick ? 'cursor-pointer' : ''}`}
      data-canonical-row-key={adapted.row_key}
      data-canonical-row-kind={adapted.resolution.rowKind}
    >
      <div className="text-[10px] font-bold text-[#1F1F1F]">{context.displayLabel}</div>
      <p className="mt-1 text-[10px] leading-4 text-[#6B5630]">{context.nonComparableReason}</p>
      <CanonicalContextButton select={interaction.select} selected={selected} sourceSpecific />
      {context.primitives.length ? (
        <dl className="mt-2 space-y-1.5 border-t border-[#E8D9B8] pt-2">
          {context.primitives.map((primitive) => (
            <div key={primitive.key} className="grid grid-cols-[110px_1fr] gap-3 text-[10px] leading-4">
              <dt className="font-bold text-[#77736C]">{primitive.kind.replaceAll('_', ' ').toLowerCase()}</dt>
              <dd className="text-[#1F1F1F]">{String(primitive.interpretedValue ?? primitive.rawValue)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {context.source?.state === 'available' ? (
        <CanonicalSourceDetail
          envelope={envelope}
          rowKey={adapted.row_key}
          sourceAction={context.source.action}
        />
      ) : null}
    </div>
  );
}

function CanonicalRow({ item, envelope, selected, onSelectCanonicalContext }) {
  if (item.render_kind !== 'ROW') return <RowFailure item={item} />;
  if (item.prepared.resolution.rowKind === 'REVIEWED_SOURCE_SPECIFIC') {
    return (
      <SourceSpecificResult
        item={item}
        envelope={envelope}
        selected={selected}
        onSelectCanonicalContext={onSelectCanonicalContext}
      />
    );
  }
  return (
    <CanonicalResult
      item={item}
      envelope={envelope}
      selected={selected}
      onSelectCanonicalContext={onSelectCanonicalContext}
    />
  );
}

function CanonicalReviewRemainder({
  state,
  bindingResult,
  bindingError = null,
  selectedCanonicalRowKey = null,
  onSelectCanonicalContext = null,
  onRetry = null,
}) {
  if (!ENABLED || !state) return null;
  if (state.error && !state.envelope) {
    return (
      <div className="border border-[#E6E4DF] bg-[#F7F5F0] px-3 py-2 text-[10px] text-[#6B6B6B]">
        Certified terms are unavailable. The existing review remains fully available.
        {typeof onRetry === 'function' ? (
          <button
            type="button"
            className="ml-2 font-bold uppercase tracking-[0.1em] text-[#2F6DB5] hover:underline"
            onClick={onRetry}
          >
            Retry
          </button>
        ) : null}
      </div>
    );
  }
  if (!state.envelope || !Array.isArray(state.items)) return null;
  const boundRowKeys = new Set(
    (bindingResult?.bindings || []).flatMap((binding) => (
      binding.prepared_rows.map((prepared) => prepared.row_key)
    )),
  );
  const items = state.items.filter((item) => (
    item.render_kind !== 'ROW' || !boundRowKeys.has(item.prepared.row_key)
  ));
  const bindingWarnings = bindingResult?.errors || [];
  if (!items.length && !bindingWarnings.length && !bindingError && !state.paginationError) return null;
  return (
    <section
      id="sec-canonical-v2-additional"
      className="scroll-mt-28"
      data-canonical-v2-review-remainder
    >
      <details open className="mtx-section">
        <summary className="flex cursor-pointer list-none items-center gap-2.5 border-b-2 border-black pb-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#D8B56A]" />
          <h2 className="text-base font-bold tracking-tight text-[#1F1F1F]">Additional certified terms</h2>
          <span className="text-[9px] text-[#77736C]">{items.length} rows</span>
          <span aria-hidden="true" className="mtx-section-caret ml-auto text-[10px] text-[#6B6B6B]">▾</span>
        </summary>
        {bindingError || bindingWarnings.length ? (
          <p className="mt-3 border border-[#E8D9B8] bg-[#FFFCF4] px-3 py-2 text-[10px] text-[#6B5630]">
            Some certified terms could not be attached to their normal Review row. Other Review terms remain available.
          </p>
        ) : null}
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <CanonicalRowErrorBoundary key={item.key} item={item}>
              <CanonicalRow
                item={item}
                envelope={state.envelope}
                selected={item.render_kind === 'ROW'
                  && item.prepared.row_key === selectedCanonicalRowKey}
                onSelectCanonicalContext={onSelectCanonicalContext}
              />
            </CanonicalRowErrorBoundary>
          ))}
          {state.paginationError ? (
            <p className="text-[10px] text-[#8A6417]">
              More certified terms could not be loaded. The terms above remain available.
            </p>
          ) : null}
        </div>
      </details>
    </section>
  );
}

export default function CanonicalReviewSection({
  dealId,
  onSelectCanonicalContext = null,
  selectedCanonicalRowKey = null,
  onContextStateChange = null,
  standalone = true,
  autoLoadAll = false,
  reloadKey = 0,
}) {
  const [state, setState] = useState({
    loading: false,
    loadingMore: false,
    error: null,
    paginationError: null,
    envelope: null,
    items: [],
  });
  const requestGenerationRef = useRef(0);
  const loadMorePendingRef = useRef(false);
  useEffect(() => {
    const generation = requestGenerationRef.current + 1;
    requestGenerationRef.current = generation;
    loadMorePendingRef.current = false;
    if (!ENABLED || !dealId) return undefined;
    let cancelled = false;
    setState({
      loading: true,
      loadingMore: false,
      error: null,
      paginationError: null,
      envelope: null,
      items: [],
    });
    fetchJson(`/api/canonical-v2/review-context?dealId=${encodeURIComponent(dealId)}`)
      .then((body) => {
        if (cancelled || requestGenerationRef.current !== generation) return;
        const { items, ...envelope } = body;
        setState({
          loading: false,
          loadingMore: false,
          error: null,
          paginationError: null,
          envelope,
          items: items || [],
        });
      })
      .catch((error) => {
        if (!cancelled && requestGenerationRef.current === generation) {
          setState({
            loading: false,
            loadingMore: false,
            error: error.message || String(error),
            paginationError: null,
            envelope: null,
            items: [],
          });
        }
      });
    return () => {
      cancelled = true;
      if (requestGenerationRef.current === generation) requestGenerationRef.current += 1;
    };
  }, [dealId, reloadKey]);

  const loadMore = useCallback(async () => {
    const cursor = state.envelope?.next_cursor;
    if (!cursor || state.loadingMore || loadMorePendingRef.current) return;
    loadMorePendingRef.current = true;
    const expectedEnvelope = state.envelope;
    const generation = requestGenerationRef.current;
    setState((current) => ({ ...current, loadingMore: true, paginationError: null }));
    try {
      const body = await fetchJson(
        `/api/canonical-v2/review-context?dealId=${encodeURIComponent(dealId)}&after=${encodeURIComponent(cursor)}`,
      );
      const { items, ...envelope } = body;
      assertReviewPageContinuation(expectedEnvelope, envelope, cursor);
      if (requestGenerationRef.current !== generation) return;
      setState((current) => {
        if (requestGenerationRef.current !== generation
          || !sameReviewPageIdentity(current.envelope, expectedEnvelope)
          || current.envelope?.next_cursor !== cursor) return current;
        return appendReviewPage(current, envelope, items || [], cursor);
      });
    } catch (error) {
      setState((current) => ({
        ...(requestGenerationRef.current === generation
          && sameReviewPageIdentity(current.envelope, expectedEnvelope)
          && current.envelope?.next_cursor === cursor
          ? {
            ...current,
            loadingMore: false,
            paginationError: error.message || String(error),
          }
          : current),
      }));
    } finally {
      if (requestGenerationRef.current === generation) loadMorePendingRef.current = false;
    }
  }, [dealId, state.envelope, state.loadingMore]);
  useEffect(() => {
    if (autoLoadAll
      && state.envelope?.next_cursor
      && !state.loading
      && !state.loadingMore
      && !state.paginationError) {
      loadMore();
    }
  }, [
    autoLoadAll,
    loadMore,
    state.envelope?.next_cursor,
    state.loading,
    state.loadingMore,
    state.paginationError,
  ]);

  const validCount = useMemo(
    () => state.items.filter((item) => item.render_kind === 'ROW').length,
    [state.items],
  );
  useEffect(() => {
    if (typeof onContextStateChange === 'function') {
      onContextStateChange(ENABLED ? state : null);
    }
  }, [onContextStateChange, state]);
  if (!ENABLED) return null;
  if (!standalone) return null;
  if (state.loading) {
    return <p className="mtx-meta-label text-[10px] tracking-[0.14em]">Loading certified terms…</p>;
  }
  if (state.error) {
    return (
      <div className="border border-[#E6E4DF] bg-[#F7F5F0] px-3 py-2 text-[10px] text-[#6B6B6B]">
        Certified terms are unavailable. The existing review remains fully available.
      </div>
    );
  }
  if (!state.envelope || state.items.length === 0) return null;

  return (
    <section id="sec-canonical-v2" className="scroll-mt-28" data-canonical-v2-review>
      <details open className="mtx-section">
        <summary className="flex cursor-pointer list-none items-center gap-2.5 border-b-2 border-black pb-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#2F6DB5]" />
          <h2 className="text-base font-bold tracking-tight text-[#1F1F1F]">Certified terms</h2>
          <span className="text-[9px] text-[#77736C]">{validCount} rows</span>
          <span aria-hidden="true" className="mtx-section-caret ml-auto text-[10px] text-[#6B6B6B]">▾</span>
        </summary>
        <div className="mt-4 space-y-2">
          {state.items.map((item) => (
            <CanonicalRowErrorBoundary key={item.key} item={item}>
              <CanonicalRow
                item={item}
                envelope={state.envelope}
                selected={item.render_kind === 'ROW' && item.prepared.row_key === selectedCanonicalRowKey}
                onSelectCanonicalContext={onSelectCanonicalContext}
              />
            </CanonicalRowErrorBoundary>
          ))}
          {state.envelope.next_cursor ? (
            <button
              type="button"
              onClick={loadMore}
              disabled={state.loadingMore}
              className="w-full border border-[#C7CED8] bg-white px-3 py-2 text-[10px] font-bold text-[#2F6DB5] disabled:opacity-50"
            >
              {state.loadingMore ? 'Loading more certified terms…' : 'Show more certified terms'}
            </button>
          ) : null}
          {state.paginationError ? (
            <p className="text-[10px] text-[#8A6417]">
              More certified terms could not be loaded. The terms above remain available.
            </p>
          ) : null}
        </div>
      </details>
    </section>
  );
}

export {
  CanonicalReviewRemainder,
  combineCanonicalSidebarContexts,
  canonicalSidebarContext,
  exactText,
  governedSourceDetail,
  terminationFeeTriggerView,
};
