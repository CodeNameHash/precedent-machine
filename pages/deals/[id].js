import { useRouter } from 'next/router';

export default function DealDetail() {
  const { query } = useRouter();
  return <h1 className="font-display text-2xl text-ink">Deal Detail — {query.id}</h1>;
}
