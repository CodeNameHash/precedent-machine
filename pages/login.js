import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '../lib/useUser';

export default function Login() {
  const { user, login } = useUser({ redirectTo: null });
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) { router.push('/'); return; }
    fetch('/api/users')
      .then(r => r.json())
      .then(d => { setUsers(d.users || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user, router]);

  const handleSelect = (u) => {
    login(u);
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="bg-white border border-border rounded-lg shadow-sm p-8 w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold tracking-widest text-ink">PRECEDENT MACHINE</h1>
          <p className="text-sm text-inkLight font-ui mt-2">Select your profile to continue</p>
        </div>

        {loading ? (
          <div className="text-center text-sm text-inkFaint font-ui py-4">Loading users…</div>
        ) : users.length === 0 ? (
          <div className="text-center text-sm text-inkFaint font-ui py-4">No users found. Check Supabase connection.</div>
        ) : (
          <div className="space-y-2">
            {users.map(u => (
              <button
                key={u.id}
                onClick={() => handleSelect(u)}
                className="w-full text-left px-4 py-3 rounded-lg border border-border hover:border-accent hover:bg-bg transition-colors flex items-center justify-between group"
              >
                <span className="font-ui text-sm text-ink">{u.name}</span>
                {u.is_admin && (
                  <span className="text-[10px] font-ui text-accent opacity-0 group-hover:opacity-100 transition-opacity">admin</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
