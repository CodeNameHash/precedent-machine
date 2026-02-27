import { useRouter } from 'next/router';

export default function ProvisionDetail() {
  const { query } = useRouter();
  return <h1 className="font-display text-2xl text-ink">Provision Detail — {query.id}</h1>;
}
