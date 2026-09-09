import { useRouter } from 'next/router';
import ReviewWorkspace from '../../../components/product/ReviewWorkspace';
import { useUser } from '../../../lib/useUser';
import { parseFocusSections } from '../../../lib/product/section-highlight';

export default function ProductReviewPage() {
  useUser({ redirectTo: '/login' });
  const router = useRouter();
  const id = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id;
  const focus = parseFocusSections(router.query.focus);
  return id ? <ReviewWorkspace runId={id} focus={focus} allSectionsHref={focus.length ? `/review/product/${id}` : null} /> : null;
}
