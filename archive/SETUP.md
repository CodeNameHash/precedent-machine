# Precedent Machine v2 — Phase 3 Setup Guide

## Terminal Commands

```bash
# 1. Clone & install
git clone https://github.com/CodeNameHash/precedent-machine.git
cd precedent-machine
npm install

# 2. Create .env.local with your keys
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=sk-ant-your-key
EOF

# 3. Run locally
npm run dev
# → http://localhost:3000

# 4. Push to GitHub
git add -A
git commit -m "Phase 3: AI features, Frankenstein builder, realtime, polish"
git push origin main
```

---

## Supabase Setup

1. **Create project** at [supabase.com/dashboard](https://supabase.com/dashboard)
2. **Run the schema**: Go to SQL Editor → paste contents of `supabase/schema.sql` → Run
3. **Get keys**: Settings → API
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` key → `SUPABASE_SERVICE_ROLE_KEY`
4. **Enable Realtime**: Database → Replication → Ensure `annotations`, `comments`, `signoffs` tables are enabled

---

## Vercel Setup

1. **Import project**: [vercel.com/new](https://vercel.com/new) → Import from GitHub → select `precedent-machine`
2. **Set environment variables** (Settings → Environment Variables):

   | Variable | Value | Source |
   |----------|-------|--------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Supabase → Settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Supabase → Settings → API → anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Supabase → Settings → API → service_role key |
   | `ANTHROPIC_API_KEY` | `sk-ant-...` | [console.anthropic.com](https://console.anthropic.com) |

3. **Deploy**: Push to `main` or click "Deploy" in Vercel dashboard
4. **Custom domain** (optional): Settings → Domains → Add `precedent-machine.vercel.app`

---

## What's in Phase 3

### AI Features (require `ANTHROPIC_API_KEY`)
- **Auto-Categorize**: On provision detail → analyzes text → suggests MAE/IOC type, category, favorability
- **AI Compare**: On compare page → generates executive summary of differences across deals
- **Suggest Annotations**: On provision detail → identifies key legal phrases to annotate

### Annotation Propagation
- When you annotate a phrase, the system checks all other provisions for that phrase
- Shows "This phrase appears in X other provisions" with propagation count
- Human overrides are sticky (future propagations respect them)

### Frankenstein Builder (`/frankenstein`)
- Select provision type + category
- Click sentences from multiple deals to build composite provision
- Reorder, remove, preview assembled text
- Copy to clipboard or save as template provision

### Real-time Updates
- Supabase Realtime subscriptions on annotations, comments, signoffs
- Toast notifications when other users make changes

### Saved Comparisons
- Save comparison configurations from compare page
- Quick-access links on dashboard

### Polish
- Skeleton loaders on all data-fetching pages
- Error states with retry buttons
- Empty states with guidance
- Mobile responsive (hamburger menu sidebar)
- Breadcrumbs on all detail pages
- Keyboard shortcuts (Escape to close, Enter to submit)

---

## File Structure (Phase 3 additions)

```
pages/
  _app.js                     ← App wrapper with providers
  index.js                    ← Dashboard with saved comparisons
  login.js                    ← Name picker login
  admin.js                    ← Admin page
  frankenstein.js             ← Frankenstein Builder
  compare.js                  ← Updated: AI Compare + Save Comparison
  deals/
    index.js                  ← Deals list
    [id].js                   ← Deal detail
  provisions/
    index.js                  ← Provisions list (existing)
    [id].js                   ← Updated: AI buttons, propagation, realtime
  api/
    users.js                  ← Users CRUD
    deals.js                  ← Deals CRUD
    provisions.js             ← Provisions CRUD
    annotations.js            ← Annotations CRUD
    annotations/propagate.js  ← Annotation propagation logic
    comments.js               ← Comments CRUD
    signoffs.js               ← Signoffs CRUD
    comparisons.js            ← Saved comparisons CRUD
    ai/
      categorize.js           ← Claude: auto-categorize provision
      summarize.js            ← Claude: compare provisions
      suggest-annotations.js  ← Claude: suggest annotation phrases

components/
  Layout.js                   ← Updated: mobile responsive sidebar
  UI.js                       ← Skeleton, Empty, Error, Breadcrumbs, AIBadge

lib/
  supabase.js                 ← Supabase client (browser + server)
  useUser.js                  ← User context + auth hook
  useSupabaseData.js          ← Data hooks (existing)
  useToast.js                 ← Toast notification system
  useRealtime.js              ← Supabase Realtime subscriptions
```
