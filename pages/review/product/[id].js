import { useRouter } from 'next/router';
import ReviewWorkspace from '../../../components/product/ReviewWorkspace';
import { useUser } from '../../../lib/useUser';
import { parseFocusSections } from '../../../lib/product/section-highlight';
import { briefForRun } from '../../../lib/product/review-briefs';

// A run with a reviewer brief opens on the briefed provisions. `?focus=7.1,7.3`
// overrides the list; `?all=1` shows every section.
export function resolveFocus(query, brief) {
  if (query.all !== undefined) return [];
  const explicit = parseFocusSections(query.focus);
  if (explicit.length) return explicit;
  return (brief?.sections || []).map((item) => item.reference);
}

export default function ProductReviewPage() {
  useUser({ redirectTo: '/login' });
  const router = useRouter();
  const id = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id;
  const brief = id ? briefForRun(id) : null;
  const focus = id ? resolveFocus(router.query, brief) : [];
  return id ? <ReviewWorkspace runId={id} focus={focus} brief={brief} allSectionsHref={focus.length ? `/review/product/${id}?all=1` : null} /> : null;
}
