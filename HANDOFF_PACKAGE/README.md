# GameTime — Full System Handoff

Snapshot prepared: 2026-11-09

This folder is the human-readable handoff for the complete GameTime codebase. The **full source code is the repository itself** on branch `secure-v2`; the downloadable handoff ZIP should contain the entire repository plus this folder.

## Current source snapshot

- Repository: `aboodjarkas99-dev/GameTime`
- Branch: `secure-v2`
- Source HEAD when this handoff was prepared: `8425221df08371aa4f83e3782255cfc6b88838a3`
- Production URL: `https://gametime-secure-v2.vercel.app`
- Production project: `gametime-secure-v2`
- Supabase project: `GameTime Secure V2`
- Supabase project ref: `bqnptjfdsxzbxtkzigim`

## What is included in the repository

- Main GameTime web app: `index.html`, `app.js`, `styles.css`
- Fill Line logic: `fill-line.js`, `fill-completion.js`
- Shipping application source: `shipping-ui/`
- Built shipping app: `shipping-desk/`
- Database SQL / schema patches: `database/`
- Supabase Edge Functions: `supabase/functions/`
- Tests: `tests/` and `database/tests/`
- Backup utilities: `scripts/backup-gametime.mjs`
- Automatic Excel backup function: `supabase/functions/gametime-daily-backup/`
- Daily Excel backup database setup: `database/daily_excel_backup.sql`

## Important

This handoff intentionally does **not** contain passwords, Supabase service-role keys, Google OAuth tokens, API secrets, or private authentication credentials. Those must remain in the deployment/provider secret stores.

If this package is provided to a new developer or a future ChatGPT session, start with `SYSTEM_STATE.md` and `RESTORE_GUIDE.md`.
