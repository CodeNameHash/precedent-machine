import Head from 'next/head';
import MergertraceStyles from '../../components/review-v2/MergertraceStyles';
import { designPreviewServerSideProps } from '../../lib/design/route-guard';

export async function getServerSideProps() {
  const guard = designPreviewServerSideProps();
  if (guard.notFound) return guard;
  const {
    loadSevenFamilyGroupingPreview,
  } = require('../../lib/canonical-v2/seven-family-grouping-preview-source');
  const preview = loadSevenFamilyGroupingPreview({ env: process.env });
  if (!preview) return { notFound: true };
  return { props: { preview } };
}

function SourceIdentity({ source }) {
  return (
    <details className="mt-3 text-[10px] text-[#77736C]">
      <summary className="cursor-pointer font-semibold hover:text-[#1F1F1F]">Sealed source identity</summary>
      <div className="mt-2 break-all border-l-2 border-[#D9D7D2] pl-3 font-mono leading-4">
        <div>{source.path}</div>
        <div>{source.byte_length.toLocaleString()} bytes</div>
        <div>SHA-256 {source.sha256}</div>
        <div>Package {source.family_profile_package_id}</div>
      </div>
    </details>
  );
}

function V1Surface({ v1 }) {
  return (
    <div className="border border-[#D9D7D2] bg-white">
      <header className="border-b border-[#E6E4DF] bg-[#F7F5F0] px-4 py-3">
        <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#77736C]">Existing V1 surface</div>
        <h3 className="mt-1 text-xs font-bold text-[#1F1F1F]">{v1.surface}</h3>
      </header>
      <ul className="divide-y divide-[#EEECE7]">
        {v1.rows.map((row) => (
          <li key={row} className="px-4 py-2.5 text-[11px] leading-4 text-[#1F1F1F]">{row}</li>
        ))}
      </ul>
      {v1.note ? <p className="border-t border-[#EEECE7] px-4 py-3 text-[10px] leading-4 text-[#77736C]">{v1.note}</p> : null}
    </div>
  );
}

function PartyBands({ bands }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {bands.map((band) => (
        <span
          key={band.party_band || 'not-party-banded'}
          className="inline-flex items-center gap-1 rounded-full border border-[#D9D7D2] bg-white px-2 py-1 text-[9px] font-semibold text-[#4F4C47]"
        >
          <span>{band.party_band || 'Not party-banded'}</span>
          <span className="font-mono text-[#77736C]">{band.profile_count}</span>
        </span>
      ))}
    </div>
  );
}

function V2Rows({ rows }) {
  return (
    <div className="overflow-hidden border border-[#AFC6E0] bg-white">
      <header className="border-b border-[#C8D8EA] bg-[#EEF5FC] px-4 py-3">
        <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#2F6DB5]">Canonical V2 Preview</div>
        <h3 className="mt-1 text-xs font-bold text-[#1F1F1F]">Approved comparison shape</h3>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[580px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#E6E4DF] bg-[#FAFAF8] text-[9px] font-bold uppercase tracking-[0.1em] text-[#77736C]">
              <th className="px-3 py-2">Comparison line</th>
              <th className="px-3 py-2">Party band and profiles</th>
              <th className="px-3 py-2">Approved fields</th>
              <th className="px-3 py-2">Value state</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEECE7]">
            {rows.map((row) => (
              <tr key={`${row.row_kind}:${row.comparison_line}`} className="align-top">
                <td className="px-3 py-3 text-[11px] font-semibold text-[#1F1F1F]">
                  {row.comparison_line}
                  {row.row_kind === 'LINK' ? (
                    <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[#2F6DB5]">Linked family row</div>
                  ) : null}
                </td>
                <td className="px-3 py-3"><PartyBands bands={row.bands} /></td>
                <td className="px-3 py-3 text-[10px] leading-4 text-[#4F4C47]">
                  {row.comparison_fields.length ? row.comparison_fields.join('; ') : 'No separate field approved'}
                  {row.grouping_notes.map((note) => (
                    <div key={note} className="mt-1 text-[#77736C]">{note}</div>
                  ))}
                </td>
                <td className="px-3 py-3">
                  <span className="inline-block rounded bg-[#FFF4D6] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[#7A5A10]">
                    Not yet extracted in V2
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UnmeasuredConcepts({ concepts }) {
  if (!concepts.length) return null;
  return (
    <div className="mt-4 border-l-2 border-[#D8B56A] bg-[#FFF9EC] px-4 py-3">
      <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#8A6417]">V1 fields not yet measured</div>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-[10px] leading-4 text-[#5F4A1E]">
        {concepts.map((entry) => <li key={entry.concept}>{entry.concept}</li>)}
      </ul>
    </div>
  );
}

function FamilySection({ family, ordinal }) {
  return (
    <section id={family.family_key.toLowerCase()} className="scroll-mt-6 border border-[#D9D7D2] bg-[#FCFBF8] p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#77736C]">Family {ordinal}</div>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-[#1F1F1F]">{family.title}</h2>
        </div>
        <div className="rounded-full border border-[#B7D2BF] bg-[#EEF7F0] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#27633A]">
          {family.profile_count} sealed {family.profile_count === 1 ? 'profile' : 'profiles'}
        </div>
      </div>
      <p className="mt-3 max-w-4xl text-[11px] leading-5 text-[#4F4C47]">
        V1 remains unchanged. V2 shows the approved row structure from the sealed successor package and grouping disposition. This page does not claim that a V2 deal value has been extracted.
      </p>
      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(220px,0.7fr)_minmax(620px,1.7fr)]">
        <V1Surface v1={family.v1} />
        <V2Rows rows={family.v2_rows} />
      </div>
      <UnmeasuredConcepts concepts={family.unmeasured_concepts} />
      <SourceIdentity source={family.package} />
    </section>
  );
}

export default function SevenFamilyPreview({ preview }) {
  return (
    <>
      <Head>
        <title>Seven-family Canonical V2 Preview</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <MergertraceStyles />
      <main className="min-h-screen bg-[#F3F1EC] px-4 py-8 text-[#1F1F1F] sm:px-7 lg:px-10">
        <div className="mx-auto max-w-[1500px]">
          <header className="border-t-4 border-black bg-white px-5 py-6 shadow-sm sm:px-7">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#2F6DB5]">Canonical V2 Preview</div>
                <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Seven-family grouping application</h1>
                <p className="mt-3 max-w-3xl text-[11px] leading-5 text-[#4F4C47]">
                  Read-only taxonomy preview. V1 surfaces appear beside the ruled V2 comparison shape. The V2 shape is derived at request time from the exact sealed successor packages and their bound grouping dispositions.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-px overflow-hidden border border-[#D9D7D2] bg-[#D9D7D2] text-center">
                {[
                  ['Families', preview.family_count],
                  ['Profiles', preview.profile_count],
                  ['V2 rows', preview.comparison_row_count],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-[82px] bg-[#FAFAF8] px-3 py-3">
                    <div className="font-mono text-lg font-bold">{value}</div>
                    <div className="mt-1 text-[8px] font-bold uppercase tracking-[0.12em] text-[#77736C]">{label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2 text-[9px] font-bold uppercase tracking-[0.1em]">
              <span className="rounded bg-[#EEF7F0] px-2.5 py-1.5 text-[#27633A]">Independent review: {preview.review.state}</span>
              <span className="rounded bg-[#F0F0EE] px-2.5 py-1.5 text-[#4F4C47]">Preview only</span>
              <span className="rounded bg-[#F0F0EE] px-2.5 py-1.5 text-[#4F4C47]">No production effect</span>
              <span className="rounded bg-[#F0F0EE] px-2.5 py-1.5 text-[#4F4C47]">No database writes</span>
            </div>
          </header>

          <nav className="mt-4 flex flex-wrap gap-2" aria-label="Family navigation">
            {preview.families.map((family) => (
              <a
                key={family.family_key}
                href={`#${family.family_key.toLowerCase()}`}
                className="border border-[#D9D7D2] bg-white px-3 py-2 text-[9px] font-bold uppercase tracking-[0.08em] text-[#4F4C47] hover:border-[#2F6DB5] hover:text-[#2F6DB5]"
              >
                {family.title}
              </a>
            ))}
          </nav>

          <div className="mt-5 space-y-5">
            {preview.families.map((family, index) => (
              <FamilySection key={family.family_key} family={family} ordinal={index + 1} />
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

SevenFamilyPreview.noLayout = true;
