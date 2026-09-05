import { useRouter } from 'next/router';
import ReviewWorkspace from '../../../components/product/ReviewWorkspace';
import { useUser } from '../../../lib/useUser';

export default function ProductReviewPage() {
  useUser({ redirectTo: '/login' });
  const router = useRouter();
  const id = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id;
  return id ? <ReviewWorkspace runId={id} /> : null;
}
