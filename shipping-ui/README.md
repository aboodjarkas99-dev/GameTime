# Original GameTime Logistics interface

The components, pallet rules, print layout and branding are from the shipping source handoff. The server functions have been replaced with the existing factory Supabase session, role policies, shipments and stock ledger. Loading completion saves READY; only Mark Shipped deducts warehouse stock. Drawdown samples are excluded.

Build: `npm ci --ignore-scripts && npm run typecheck && npm run build`. Compiled assets are committed under `shipping-desk/` for the existing static Vercel project.
