# GameTime — Restore / Recovery Guide

## If the app disappears but GitHub still exists

1. Obtain the complete repository snapshot and check out `secure-v2`.
2. Reconnect/recreate the Vercel project.
3. Deploy the repository root to the production alias.
4. Reconnect the correct Supabase project/environment values.
5. Verify login, Schedule, Fill Line, Inventory, Shipping, Labels, and Company Overview.

## If a future developer needs to understand the code

Start in this order:

1. `index.html`
2. `app.js`
3. `styles.css`
4. `fill-line.js`
5. `fill-completion.js`
6. `shipping-ui/src/components/pallet-desk.tsx`
7. `database/`
8. `supabase/functions/`

Do not edit the generated shipping bundle first. Prefer editing `shipping-ui/` source and rebuilding.

## If operational data is damaged

First option:
- use the daily Excel archives in the private `gametime-backups` bucket to inspect prior values.

For a true database restore:
- use the database/provider backup or a PostgreSQL dump when available.
- Excel is a recovery/data-reference layer; it is not a byte-for-byte PostgreSQL restore.

## Secret handling

Never put these into the handoff ZIP:
- Supabase service-role / secret keys
- password hashes
- Google OAuth refresh tokens
- VAPID/private push secrets
- integration API secrets
- employee PIN secrets

Recreate/reconnect those through the provider secret stores.

## Before any future code change

1. Fetch current `secure-v2` HEAD.
2. Inspect the exact live source file before modifying it.
3. Change only the requested scope.
4. Verify source.
5. Deploy if the change affects the web app.
6. Verify production.
