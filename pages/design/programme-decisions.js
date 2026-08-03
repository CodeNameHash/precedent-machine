import Head from 'next/head';
import { useEffect, useMemo, useState } from 'react';
import TopBar from '../../components/chrome/TopBar';
import MergertraceStyles from '../../components/review-v2/MergertraceStyles';
import { designPreviewServerSideProps } from '../../lib/design/route-guard';
import {
  DECISION_GROUPS,
  DECISIONS,
  M3_STAGES,
  RECORDED_RULINGS,
  recommendedChoice,
} from '../../lib/programme-decision-console';

const STORAGE_KEY = 'corpus_programme_decisions_2026_08_03';

export async function getServerSideProps() {
  return designPreviewServerSideProps();
}

ProgrammeDecisionsPage.noLayout = true;

function readSavedState() {
  if (typeof window === 'undefined') return { choices: { ...RECORDED_RULINGS }, notes: {} };
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    return {
      choices: {
        ...(saved?.choices && typeof saved.choices === 'object' ? saved.choices : {}),
        ...RECORDED_RULINGS,
      },
      notes: saved?.notes && typeof saved.notes === 'object' ? saved.notes : {},
    };
  } catch {
    return { choices: { ...RECORDED_RULINGS }, notes: {} };
  }
}

function rulingMarkdown(choices, notes) {
  const answered = DECISIONS.filter((decision) => choices[decision.id]);
  const lines = [
    '# Canonical v2 rulings, 2026-08-03',
    '',
    `Answered: ${answered.length}/${DECISIONS.length}`,
    '',
  ];
  for (const decision of answered) {
    const option = decision.options.find((entry) => entry.id === choices[decision.id]);
    lines.push(`## ${decision.title}`, '', `Ruling: ${option?.label || choices[decision.id]}.`);
    if (notes[decision.id]?.trim()) lines.push('', `Note: ${notes[decision.id].trim()}`);
    lines.push('', `Source: ${decision.source}.`, '');
  }
  return lines.join('\n');
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const field = document.createElement('textarea');
    field.value = value;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    return copied;
  }
}

function DecisionCard({ decision, choice, note, locked, onChoose, onNote }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  return (
    <article className={`decisionCard ${choice ? 'answered' : ''}`} id={decision.id}>
      <div className="decisionHead">
        <div>
          <div className="decisionMeta">
            <span>{locked ? 'Ruling recorded' : choice ? 'Answered' : 'Decision needed'}</span>
            <span>·</span>
            <span>{decision.source}</span>
          </div>
          <h3>{decision.title}</h3>
          <p className="question">{decision.question}</p>
        </div>
        <span className={`stateDot ${choice ? 'isDone' : ''}`} aria-label={choice ? 'Answered' : 'Unanswered'} />
      </div>

      <div className="recommendation">
        <span>Recommendation</span>
        <strong>{decision.recommendation}</strong>
        <p>{decision.consequence}</p>
      </div>

      <div className="choiceGrid" role="group" aria-label={decision.question}>
        {decision.options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`choice ${choice === option.id ? 'selected' : ''}`}
            aria-pressed={choice === option.id}
            disabled={locked}
            onClick={() => onChoose(option.id)}
          >
            <span>{option.label}</span>
            {option.recommended ? <small>Recommended</small> : null}
          </button>
        ))}
      </div>

      <button type="button" className="detailsToggle" onClick={() => setDetailsOpen((open) => !open)}>
        {detailsOpen ? 'Hide context' : 'Show context and evidence'}
        <span aria-hidden="true">{detailsOpen ? '−' : '+'}</span>
      </button>

      {detailsOpen ? (
        <div className="detailsGrid">
          <div>
            <span>Why this needs you</span>
            <p>{decision.why}</p>
          </div>
          <div>
            <span>Evidence</span>
            <p>{decision.evidence}</p>
          </div>
          <div>
            <span>Current treatment</span>
            <p>{decision.current}</p>
          </div>
        </div>
      ) : null}

      {!locked ? (
        <label className="noteField">
          <span>Ruling note, optional</span>
          <textarea
            rows="2"
            value={note || ''}
            onChange={(event) => onNote(event.target.value)}
            placeholder="Add a condition or correction"
          />
        </label>
      ) : null}
    </article>
  );
}

function Roadmap() {
  return (
    <section className="roadmap" aria-labelledby="m3-route">
      <div className="sectionIntro">
        <span className="kicker">Route from here</span>
        <h2 id="m3-route">M3 is a certified staging corpus, not a production cutover</h2>
        <p>The route below reconciles the overnight handoff with the current programme. M4 starts with production import and activation readiness.</p>
      </div>
      <ol className="roadmapList">
        {M3_STAGES.map((stage, index) => (
          <li key={stage.id}>
            <div className="rail" aria-hidden="true">
              <span>{stage.number}</span>
              {index < M3_STAGES.length - 1 ? <i /> : null}
            </div>
            <div className="stageBody">
              <div className="stageTitle">
                <h3>{stage.title}</h3>
                <span className={`stageState ${stage.state.toLowerCase()}`}>{stage.state}</span>
              </div>
              <p>{stage.detail}</p>
              <div className="exit"><span>Exit test</span>{stage.exit}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function ProgrammeDecisionsPage() {
  const [state, setState] = useState({ choices: { ...RECORDED_RULINGS }, notes: {} });
  const [hydrated, setHydrated] = useState(false);
  const [activeGroup, setActiveGroup] = useState('all');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [copyState, setCopyState] = useState('idle');

  useEffect(() => {
    setState(readSavedState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const answered = Object.values(state.choices).filter(Boolean).length;
  const visible = useMemo(() => DECISIONS.filter((decision) => {
    if (activeGroup !== 'all' && decision.group !== activeGroup) return false;
    if (onlyOpen && state.choices[decision.id]) return false;
    return true;
  }), [activeGroup, onlyOpen, state.choices]);

  const choose = (decisionId, optionId) => {
    if (RECORDED_RULINGS[decisionId]) return;
    setState((current) => ({
      ...current,
      choices: { ...current.choices, [decisionId]: optionId },
    }));
  };

  const note = (decisionId, value) => {
    setState((current) => ({
      ...current,
      notes: { ...current.notes, [decisionId]: value },
    }));
  };

  const acceptRecommendations = () => {
    setState((current) => ({
      ...current,
      choices: {
        ...current.choices,
        ...Object.fromEntries(DECISIONS
          .filter((decision) => !RECORDED_RULINGS[decision.id])
          .map((decision) => [decision.id, recommendedChoice(decision)])),
      },
    }));
  };

  const clearRulings = () => {
    setState({ choices: { ...RECORDED_RULINGS }, notes: {} });
  };

  const copyRulings = async () => {
    const copied = await copyText(rulingMarkdown(state.choices, state.notes));
    setCopyState(copied ? 'copied' : 'failed');
    window.setTimeout(() => setCopyState('idle'), 1800);
  };

  return (
    <div className="mtx decisionConsole">
      <Head>
        <title>Programme decisions · Corpus</title>
      </Head>
      <MergertraceStyles />
      <TopBar />

      <main>
        <header className="hero">
          <div className="heroCopy">
            <span className="kicker">Canonical v2 · 3 August 2026</span>
            <h1>Your decisions, in the order they unblock the programme</h1>
            <p>The original 15 rulings are fixed. New M3 build blockers appear here as they are found.</p>
          </div>
          <div className="progressPanel">
            <div className="progressCount"><strong>{answered}</strong><span>of {DECISIONS.length}</span></div>
            <div className="progressTrack" aria-label={`${answered} of ${DECISIONS.length} decisions answered`}>
              <span style={{ width: `${(answered / DECISIONS.length) * 100}%` }} />
            </div>
            <span>{answered === DECISIONS.length ? 'Decision record complete' : `${DECISIONS.length - answered} rulings remain`}</span>
          </div>
        </header>

        <div className="stickyControls">
          <nav className="groupTabs" aria-label="Decision groups">
            <button type="button" className={activeGroup === 'all' ? 'active' : ''} onClick={() => setActiveGroup('all')}>All <span>{DECISIONS.length}</span></button>
            {DECISION_GROUPS.map((group) => {
              const count = DECISIONS.filter((decision) => decision.group === group.id).length;
              return <button key={group.id} type="button" className={activeGroup === group.id ? 'active' : ''} onClick={() => setActiveGroup(group.id)}>{group.label} <span>{count}</span></button>;
            })}
          </nav>
          <div className="actions">
            <label className="openSwitch">
              <input type="checkbox" checked={onlyOpen} onChange={(event) => setOnlyOpen(event.target.checked)} />
              <span>Unanswered only</span>
            </label>
            {answered > Object.keys(RECORDED_RULINGS).length ? <button type="button" className="quietAction" onClick={clearRulings}>Clear open rulings</button> : null}
            <button type="button" className="secondaryAction" onClick={acceptRecommendations}>Accept recommendations</button>
            <button type="button" className="primaryAction" onClick={copyRulings} disabled={answered === 0}>
              {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy rulings'}
            </button>
          </div>
        </div>

        <div className="contentGrid">
          <section className="decisions" aria-label="Decision cards">
            {visible.map((decision) => (
              <DecisionCard
                key={decision.id}
                decision={decision}
                choice={state.choices[decision.id]}
                note={state.notes[decision.id]}
                locked={Boolean(RECORDED_RULINGS[decision.id])}
                onChoose={(optionId) => choose(decision.id, optionId)}
                onNote={(value) => note(decision.id, value)}
              />
            ))}
            {visible.length === 0 ? <div className="empty">No unanswered decisions in this group.</div> : null}
          </section>
          <aside className="sideSummary">
            <span className="kicker">What changes first</span>
            <h2>The critical path</h2>
            <ol>
              <li><strong>Apply the three fixtures in order.</strong><span>TopBuild, then Skechers, then Modiv. Stop after any failed verification.</span></li>
              <li><strong>Apply the closed taxonomy rulings.</strong><span>The original 15 programme decisions have recorded answers. New build blockers remain explicit.</span></li>
              <li><strong>Finish P2 phase 2.</strong><span>This is the first family build in the handoff.</span></li>
              <li><strong>Build and prove families.</strong><span>Fixture proof comes before corpus-scale claims.</span></li>
              <li><strong>Certify M3 in staging.</strong><span>Production import starts after M3.</span></li>
            </ol>
          </aside>
        </div>

        <Roadmap />
      </main>

      <style jsx global>{`
        .decisionConsole { min-height: 100vh; background: #f4f2ed; color: #20201e; }
        .decisionConsole main { max-width: 1420px; margin: 0 auto; padding: 54px 40px 100px; }
        .decisionConsole button, .decisionConsole textarea { font: inherit; }
        .decisionConsole .hero { display: grid; grid-template-columns: minmax(0, 1fr) 280px; align-items: end; gap: 60px; padding: 30px 0 42px; border-bottom: 1px solid #cfcdc6; }
        .decisionConsole .heroCopy { max-width: 820px; }
        .decisionConsole .kicker { display: block; font: 600 10px/1.3 'IBM Plex Mono', monospace; letter-spacing: .12em; text-transform: uppercase; color: #6d6a64; }
        .decisionConsole h1 { margin: 13px 0 18px; max-width: 790px; font: 400 clamp(40px, 5vw, 68px)/.98 'Tinos', serif; letter-spacing: -.025em; }
        .decisionConsole .heroCopy > p { max-width: 680px; margin: 0; font-size: 16px; line-height: 1.65; color: #615f59; }
        .decisionConsole .progressPanel { padding-left: 24px; border-left: 1px solid #cfcdc6; }
        .decisionConsole .progressCount { display: flex; align-items: baseline; gap: 8px; }
        .decisionConsole .progressCount strong { font: 400 46px/1 'Tinos', serif; }
        .decisionConsole .progressCount span, .decisionConsole .progressPanel > span { color: #6d6a64; font-size: 12px; }
        .decisionConsole .progressTrack { height: 4px; margin: 14px 0 10px; background: #dcd9d2; overflow: hidden; }
        .decisionConsole .progressTrack span { display: block; height: 100%; background: #1b3fa0; transition: width .2s ease; }
        .decisionConsole .stickyControls { position: sticky; top: 56px; z-index: 30; display: flex; align-items: center; justify-content: space-between; gap: 24px; margin: 0 -40px 36px; padding: 14px 40px; border-bottom: 1px solid #cfcdc6; background: rgba(244, 242, 237, .96); backdrop-filter: blur(12px); }
        .decisionConsole .groupTabs { display: flex; flex: 1; min-width: 0; max-width: 100%; gap: 4px; overflow-x: auto; }
        .decisionConsole .groupTabs button { white-space: nowrap; padding: 8px 10px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #69665f; font-size: 12px; cursor: pointer; }
        .decisionConsole .groupTabs button span { margin-left: 3px; color: #9b978f; }
        .decisionConsole .groupTabs button.active { border-bottom-color: #20201e; color: #20201e; font-weight: 600; }
        .decisionConsole .actions { display: flex; align-items: center; gap: 8px; }
        .decisionConsole .openSwitch { display: inline-flex; align-items: center; gap: 7px; margin-right: 8px; color: #615f59; font-size: 12px; white-space: nowrap; }
        .decisionConsole .openSwitch input { accent-color: #1b3fa0; }
        .decisionConsole .quietAction { min-height: 36px; padding: 0 7px; border: 0; background: transparent; color: #77736c; font-size: 11px; cursor: pointer; }
        .decisionConsole .secondaryAction, .decisionConsole .primaryAction { min-height: 36px; padding: 0 13px; border: 1px solid #bdbab2; background: transparent; color: #20201e; font-size: 12px; cursor: pointer; }
        .decisionConsole .primaryAction { border-color: #20201e; background: #20201e; color: #fff; }
        .decisionConsole .primaryAction:disabled { opacity: .38; cursor: default; }
        .decisionConsole .contentGrid { display: grid; grid-template-columns: minmax(0, 1fr) 290px; align-items: start; gap: 42px; }
        .decisionConsole .decisions { display: grid; gap: 18px; }
        .decisionConsole .decisionCard { border: 1px solid #d5d2ca; background: #fff; box-shadow: 0 2px 10px rgba(38, 36, 31, .03); }
        .decisionConsole .decisionCard.answered { border-color: #a7b5d9; }
        .decisionConsole .decisionHead { display: flex; justify-content: space-between; gap: 24px; padding: 26px 28px 20px; }
        .decisionConsole .decisionMeta { display: flex; flex-wrap: wrap; gap: 7px; font: 500 9px/1.4 'IBM Plex Mono', monospace; letter-spacing: .08em; text-transform: uppercase; color: #88847c; }
        .decisionConsole .decisionHead h3 { margin: 9px 0 5px; font: 400 26px/1.12 'Tinos', serif; }
        .decisionConsole .question { margin: 0; color: #514f4a; font-size: 14px; line-height: 1.5; }
        .decisionConsole .stateDot { flex: 0 0 auto; width: 10px; height: 10px; margin-top: 3px; border: 1px solid #aaa69e; border-radius: 50%; background: #fff; }
        .decisionConsole .stateDot.isDone { border-color: #1b3fa0; background: #1b3fa0; box-shadow: inset 0 0 0 2px #fff; }
        .decisionConsole .recommendation { margin: 0 28px 22px; padding: 15px 17px; border-left: 3px solid #1b3fa0; background: #f2f5fb; }
        .decisionConsole .recommendation > span, .decisionConsole .detailsGrid span, .decisionConsole .noteField > span, .decisionConsole .exit span { display: block; margin-bottom: 5px; font: 600 9px/1.35 'IBM Plex Mono', monospace; letter-spacing: .1em; text-transform: uppercase; color: #6e6a63; }
        .decisionConsole .recommendation strong { display: block; font-size: 13px; line-height: 1.5; }
        .decisionConsole .recommendation p { margin: 4px 0 0; color: #67645e; font-size: 12px; line-height: 1.5; }
        .decisionConsole .choiceGrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 0 28px 24px; }
        .decisionConsole .choice { display: flex; min-height: 56px; flex-direction: column; align-items: flex-start; justify-content: center; padding: 10px 12px; border: 1px solid #d5d2ca; background: #fff; color: #35332f; text-align: left; cursor: pointer; }
        .decisionConsole .choice:hover { border-color: #969189; }
        .decisionConsole .choice.selected { border-color: #1b3fa0; background: #1b3fa0; color: #fff; }
        .decisionConsole .choice:disabled { cursor: default; }
        .decisionConsole .choice:disabled:not(.selected) { opacity: .45; }
        .decisionConsole .choice span { font-size: 12px; line-height: 1.25; font-weight: 600; }
        .decisionConsole .choice small { margin-top: 4px; font: 500 8px/1.2 'IBM Plex Mono', monospace; letter-spacing: .08em; text-transform: uppercase; opacity: .62; }
        .decisionConsole .detailsToggle { display: flex; width: 100%; justify-content: space-between; padding: 13px 28px; border: 0; border-top: 1px solid #eceae5; background: #faf9f7; color: #5f5c55; font-size: 11px; cursor: pointer; }
        .decisionConsole .detailsGrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; padding: 20px 28px; border-top: 1px solid #eceae5; background: #faf9f7; }
        .decisionConsole .detailsGrid p { margin: 0; color: #55524c; font-size: 12px; line-height: 1.6; }
        .decisionConsole .noteField { display: block; padding: 18px 28px 24px; border-top: 1px solid #eceae5; }
        .decisionConsole .noteField textarea { width: 100%; resize: vertical; padding: 10px 11px; border: 1px solid #d5d2ca; background: #fff; color: #20201e; font-size: 12px; line-height: 1.5; }
        .decisionConsole .noteField textarea:focus { outline: 2px solid #1b3fa0; outline-offset: 1px; }
        .decisionConsole .sideSummary { position: sticky; top: 140px; padding: 24px 0 0 24px; border-left: 1px solid #cfcdc6; }
        .decisionConsole .sideSummary h2 { margin: 7px 0 20px; font: 400 28px/1.1 'Tinos', serif; }
        .decisionConsole .sideSummary ol { display: grid; gap: 18px; margin: 0; padding: 0; list-style: none; counter-reset: path; }
        .decisionConsole .sideSummary li { position: relative; padding-left: 28px; counter-increment: path; }
        .decisionConsole .sideSummary li::before { content: counter(path, decimal-leading-zero); position: absolute; left: 0; top: 1px; font: 500 9px/1.4 'IBM Plex Mono', monospace; color: #1b3fa0; }
        .decisionConsole .sideSummary strong { display: block; font-size: 12px; line-height: 1.4; }
        .decisionConsole .sideSummary li span { display: block; margin-top: 3px; color: #6d6a64; font-size: 11px; line-height: 1.5; }
        .decisionConsole .empty { padding: 56px; border-top: 1px solid #cfcdc6; border-bottom: 1px solid #cfcdc6; text-align: center; color: #6d6a64; }
        .decisionConsole .roadmap { margin-top: 100px; padding-top: 52px; border-top: 1px solid #bdbab2; }
        .decisionConsole .sectionIntro { display: grid; grid-template-columns: 160px minmax(0, 700px); column-gap: 40px; }
        .decisionConsole .sectionIntro .kicker { grid-row: 1 / span 2; }
        .decisionConsole .sectionIntro h2 { margin: -5px 0 13px; font: 400 38px/1.05 'Tinos', serif; }
        .decisionConsole .sectionIntro p { margin: 0; color: #615f59; font-size: 14px; line-height: 1.6; }
        .decisionConsole .roadmapList { max-width: 980px; margin: 48px 0 0 200px; padding: 0; list-style: none; }
        .decisionConsole .roadmapList li { display: grid; grid-template-columns: 48px minmax(0, 1fr); gap: 20px; }
        .decisionConsole .rail { display: flex; flex-direction: column; align-items: center; }
        .decisionConsole .rail span { display: grid; width: 38px; height: 38px; place-items: center; border: 1px solid #a9a59d; border-radius: 50%; background: #f4f2ed; font: 500 10px/1 'IBM Plex Mono', monospace; }
        .decisionConsole .rail i { width: 1px; flex: 1; min-height: 64px; background: #c8c5bd; }
        .decisionConsole .stageBody { padding: 3px 0 38px; }
        .decisionConsole .stageTitle { display: flex; align-items: baseline; justify-content: space-between; gap: 20px; }
        .decisionConsole .stageTitle h3 { margin: 0; font: 400 24px/1.15 'Tinos', serif; }
        .decisionConsole .stageState { padding: 4px 7px; border: 1px solid #bebbb3; font: 600 8px/1 'IBM Plex Mono', monospace; letter-spacing: .1em; }
        .decisionConsole .stageState.ben { border-color: #1b3fa0; background: #e9eef9; color: #17367f; }
        .decisionConsole .stageState.staging { background: #ebe9e4; }
        .decisionConsole .stageBody > p { max-width: 720px; margin: 9px 0 12px; color: #55524c; font-size: 13px; line-height: 1.6; }
        .decisionConsole .exit { max-width: 720px; padding-top: 10px; border-top: 1px solid #d8d5ce; color: #3b3935; font-size: 11px; line-height: 1.5; }
        .decisionConsole .exit span { display: inline; margin: 0 8px 0 0; color: #77736c; }
        @media (max-width: 1100px) {
          .decisionConsole .stickyControls { align-items: flex-start; flex-direction: column; }
          .decisionConsole .actions { width: 100%; justify-content: flex-end; }
          .decisionConsole .contentGrid { grid-template-columns: 1fr; }
          .decisionConsole .sideSummary { position: static; display: none; }
        }
        @media (max-width: 760px) {
          .decisionConsole main { padding: 28px 18px 70px; }
          .decisionConsole .hero { grid-template-columns: 1fr; gap: 28px; }
          .decisionConsole .progressPanel { padding: 0; border-left: 0; }
          .decisionConsole .stickyControls { top: 56px; margin: 0 -18px 24px; padding: 10px 18px; }
          .decisionConsole .groupTabs { width: 100%; }
          .decisionConsole .actions { align-items: stretch; flex-wrap: wrap; justify-content: flex-start; }
          .decisionConsole .openSwitch { width: 100%; }
          .decisionConsole .secondaryAction, .decisionConsole .primaryAction { flex: 1; }
          .decisionConsole .decisionHead { padding: 22px 20px 18px; }
          .decisionConsole .recommendation { margin: 0 20px 18px; }
          .decisionConsole .choiceGrid { grid-template-columns: 1fr; padding: 0 20px 20px; }
          .decisionConsole .detailsToggle { padding: 13px 20px; }
          .decisionConsole .detailsGrid { grid-template-columns: 1fr; padding: 18px 20px; }
          .decisionConsole .noteField { padding: 16px 20px 20px; }
          .decisionConsole .sectionIntro { grid-template-columns: 1fr; }
          .decisionConsole .sectionIntro .kicker { grid-row: auto; margin-bottom: 12px; }
          .decisionConsole .roadmapList { margin-left: 0; }
        }
      `}</style>
    </div>
  );
}
