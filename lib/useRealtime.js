import { useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { useToast } from './useToast';

/**
 * Subscribe to realtime changes on a Supabase table.
 * @param {string} table - Table name
 * @param {string} event - 'INSERT' | 'UPDATE' | 'DELETE' | '*'
 * @param {function} callback - (payload) => void
 * @param {object} filter - optional { column, value } for eq filter
 */
export function useRealtimeSubscription(table, event, callback, filter) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!supabase) return;

    let channel = supabase.channel(`${table}-${event}-${filter?.value || 'all'}`);

    const opts = { event, schema: 'public', table };
    if (filter?.column && filter?.value) {
      opts.filter = `${filter.column}=eq.${filter.value}`;
    }

    channel = channel.on('postgres_changes', opts, (payload) => {
      cbRef.current(payload);
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, event, filter?.column, filter?.value]);
}

/**
 * Hook that subscribes to annotations, comments, signoffs and shows toasts.
 */
export function useRealtimeNotifications(provisionId) {
  const { addToast } = useToast();

  useRealtimeSubscription(
    'annotations',
    'INSERT',
    (payload) => {
      const a = payload.new;
      if (a.provision_id === provisionId) {
        addToast(`New annotation added: "${(a.phrase || '').slice(0, 40)}…"`);
      }
    },
    provisionId ? { column: 'provision_id', value: provisionId } : undefined
  );

  useRealtimeSubscription(
    'comments',
    'INSERT',
    (payload) => {
      addToast('New comment added');
    }
  );

  useRealtimeSubscription(
    'signoffs',
    'INSERT',
    (payload) => {
      const s = payload.new;
      if (s.entity_id === provisionId) {
        addToast('New sign-off recorded');
      }
    }
  );
}
