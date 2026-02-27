import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { useUser } from '../lib/useUser';

export default function Login() {
  const [users, setUsers] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState(null);
  const { user, login } = useUser({ redirectTo: null });
  const router = useRouter();

  // If already logged in, redirect
  useEffect(() => {
    if (user) router.push('/');
  }, [user, router]);

  // Fetch users from Supabase
  useEffect(() => {
    async function fetchUsers() {
      if (!supabase) {
        setError('Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
        return;
      }
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('id, name')
        .order('name');

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setUsers(data || []);
      }
    }
    fetchUsers();
  }, []);

  const handleLogin = () => {
    const found = users.find((u) => u.id === selectedId);
    if (found) {
      login({ id: found.id, name: found.name });
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="bg-white border border-border rounded-lg p-10 w-full max-w-sm shadow-sm">
        <h1 className="font-display text-2xl text-ink mb-1 tracking-wide">PRECEDENT MACHINE</h1>
        <p className="text-sm text-inkLight font-ui mb-8">Select your identity to continue.</p>

        {error && (
          <p className="text-sm text-seller mb-4 font-ui">{error}</p>
        )}

        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full border border-border rounded px-3 py-2 text-sm font-ui text-ink bg-white mb-4 focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">Choose user…</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>

        <button
          onClick={handleLogin}
          disabled={!selectedId}
          className="w-full bg-ink text-white text-sm font-ui py-2 rounded hover:bg-inkMid transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
