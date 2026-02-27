import { useState, useEffect, useCallback } from 'react';

function useFetch(url, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(() => {
    if (!url) return;
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e); setLoading(false); });
  }, [url]);

  useEffect(() => { refetch(); }, [refetch, ...deps]);

  return { data, loading, error, refetch };
}

export function useDeals() {
  const { data, loading, error, refetch } = useFetch('/api/deals');
  return { deals: data?.deals || [], loading, error, refetch };
}

export function useDeal(id) {
  const { data, loading, error, refetch } = useFetch(id ? `/api/deals?id=${id}` : null);
  return { deal: data?.deal || data?.deals?.[0] || null, loading, error, refetch };
}

export function useProvisions(filters = {}) {
  const params = new URLSearchParams();
  if (filters.deal_id) params.set('deal_id', filters.deal_id);
  if (filters.type) params.set('type', filters.type);
  const qs = params.toString();
  const url = `/api/provisions${qs ? `?${qs}` : ''}`;
  const { data, loading, error, refetch } = useFetch(url, [qs]);
  return { provisions: data?.provisions || [], loading, error, refetch };
}

export function useProvision(id) {
  const { data, loading, error, refetch } = useFetch(id ? `/api/provisions?id=${id}` : null);
  return { provision: data?.provision || data?.provisions?.[0] || null, loading, error, refetch };
}

export function useAnnotations(provisionId) {
  const url = provisionId ? `/api/annotations?provision_id=${provisionId}` : null;
  const { data, loading, error, refetch } = useFetch(url);
  return { annotations: data?.annotations || [], loading, error, refetch };
}

export function useComments(annotationId) {
  const url = annotationId ? `/api/comments?annotation_id=${annotationId}` : null;
  const { data, loading, error, refetch } = useFetch(url);
  return { comments: data?.comments || [], loading, error, refetch };
}

export function useUsers() {
  const { data, loading, error, refetch } = useFetch('/api/users');
  return { users: data?.users || [], loading, error, refetch };
}

export function useSignoffs(entityType, entityId) {
  const url = entityType && entityId ? `/api/signoffs?entity_type=${entityType}&entity_id=${entityId}` : null;
  const { data, loading, error, refetch } = useFetch(url);
  return { signoffs: data?.signoffs || [], loading, error, refetch };
}
