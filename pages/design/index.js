import Head from 'next/head';
import {
  Breadcrumb,
  ColorSwatches,
  EmptyTile,
  FullDocOverlay,
  LandingGrid,
  LandingTile,
  ReviewHeader,
  Sidebar,
  SidebarItem,
  SpacingRadiiMotionDemo,
  TypeScaleDemo,
  shellStyles,
} from '../../lib/design/components';
import { colors, radii, spacing, typeScale } from '../../lib/design/tokens';
import { designPreviewServerSideProps } from '../../lib/design/route-guard';
import { primitiveStories, typeSamples } from '../../__fixtures__/ux-shell/design';

export async function getServerSideProps() {
  return designPreviewServerSideProps();
}

export default function DesignIndex() {
  return (
    <>
      <Head>
        <title>Design tokens</title>
      </Head>

      <div style={styles.page}>
        <header style={styles.header}>
          <div>
            <p style={styles.eyebrow}>UX shell phase 1</p>
            <h1 style={styles.title}>Design tokens</h1>
          </div>
          <div style={styles.badge}>Static fixtures only</div>
        </header>

        <TokenSection title="Type scale">
          <TypeScaleDemo samples={typeSamples} />
        </TokenSection>

        <TokenSection title="Colour">
          <ColorSwatches palette={colors} />
        </TokenSection>

        <TokenSection title="Spacing and radii">
          <SpacingRadiiMotionDemo />
        </TokenSection>

        <TokenSection title="Primitive stories">
          <div style={shellStyles.primitiveGrid}>
            {primitiveStories.map((primitive) => (
              <article key={primitive.name} style={shellStyles.primitivePanel}>
                <h2 style={shellStyles.panelTitle}>{primitive.name}</h2>
                <div style={shellStyles.storyStack}>
                  {primitive.stories.map((story) => (
                    <PrimitiveStory key={story.label} primitive={primitive.name} story={story} />
                  ))}
                </div>
              </article>
            ))}
          </div>
        </TokenSection>
      </div>
    </>
  );
}

function TokenSection({ title, children }) {
  return (
    <section style={styles.section}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

function PrimitiveStory({ primitive, story }) {
  return (
    <div style={shellStyles.story}>
      <div style={shellStyles.storyLabel}>{story.label}</div>
      {primitive === 'Breadcrumb' ? <Breadcrumb crumbs={story.crumbs} /> : null}
      {primitive === 'Review header' ? <ReviewHeader {...story} /> : null}
      {primitive === 'Sidebar' ? <Sidebar sections={story.sections} /> : null}
      {primitive === 'Sidebar item' ? <SidebarItem label={story.section} state={story.state} /> : null}
      {primitive === 'Landing tile' ? <LandingTile {...story} /> : null}
      {primitive === 'Landing grid' ? <LandingGrid tiles={story.tiles} /> : null}
      {primitive === 'Empty tile' ? <EmptyTile {...story} /> : null}
      {primitive === 'Full document overlay' ? <FullDocOverlay {...story} /> : null}
    </div>
  );
}

const styles = {
  page: {
    maxWidth: 1180,
    margin: '0 auto',
    padding: `${spacing[8]} ${spacing[6]} ${spacing[16]}`,
  },
  header: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing[6],
    marginBottom: spacing[8],
  },
  eyebrow: {
    ...typeScale.caption,
    color: colors.accent.editorialDeep,
    textTransform: 'uppercase',
    letterSpacing: '0',
    margin: `0 0 ${spacing[2]}`,
  },
  title: {
    ...typeScale.display,
    margin: 0,
    color: colors.text.primary,
  },
  badge: {
    ...typeScale.caption,
    color: colors.accent.editorialDeep,
    background: colors.accent.soft,
    border: `1px solid ${colors.border.strong}`,
    borderRadius: radii.md,
    padding: `${spacing[2]} ${spacing[3]}`,
    whiteSpace: 'nowrap',
  },
  section: {
    marginTop: spacing[8],
  },
  sectionTitle: {
    ...typeScale.h2,
    color: colors.text.secondary,
    margin: `0 0 ${spacing[4]}`,
  },
};
