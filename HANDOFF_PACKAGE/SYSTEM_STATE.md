# GameTime — System State

## Architecture

GameTime is an internal factory operations system for wood coatings. It currently covers:

- Batch Maker scheduling and work completion
- Fill Line scheduling, completion, actual quantities, and carryovers
- Factory finished-goods inventory
- Fill Line supply inventory and consumption
- Shipping / packing-slip workflow
- Label Sheet / label inventory
- Company Overview / manager reporting
- Employee roles, PIN login, audit/activity tracking
- Push/reminder infrastructure
- Daily Excel backups

## Hosting

### Web
- Vercel project: `gametime-secure-v2`
- Production alias: `https://gametime-secure-v2.vercel.app`
- Production app deployment at handoff time was built from source commit:
  `de876c92b5908c2ddfd4c150e3c9e92a91c6483a`

### Source
- GitHub: `aboodjarkas99-dev/GameTime`
- Branch: `secure-v2`
- Current source HEAD at handoff creation:
  `8425221df08371aa4f83e3782255cfc6b88838a3`

The source branch can be ahead of the Vercel web deployment when changes only affect Supabase/database/backup infrastructure.

### Database
- Supabase project: `GameTime Secure V2`
- Project ref: `bqnptjfdsxzbxtkzigim`
- PostgreSQL + Auth + Realtime + Storage + Edge Functions + Cron

## Automatic Excel backup

Private Supabase Storage bucket:
- `gametime-backups`

Files:
- `latest/GameTime-Latest.xlsx` — overwritten with the newest complete workbook
- `daily/YYYY/MM/GameTime-YYYY-MM-DD.xlsx` — one dated archive per day

Cron:
- job: `gametime-daily-excel-backup`
- schedule: `30 8 * * *` UTC

Function:
- `gametime-daily-backup`

Audit:
- table: `public.backup_runs`

The workbook contains operational data and excludes authentication secrets, password hashes, integration-key hashes, push encryption keys, and live session tokens.

## Key pallet / package rules

- Quart pallet: 720 quart cans
- 1 Gallon pallet: 120 cans
- 5 Gallon pallet: 36 pails
- Quart box: 4 cans
- Gallon box: 4 cans
- Jerry Can: 1.25 gallon
- Pint belongs only to Fill Line Inventory, not Factory Inventory

## Current calendar behavior

- Batch Maker: orange accent
- Fill Line: blue accent
- Mouse wheel moves the calendar one week at a time
- Weekends are narrower than Monday–Friday
- Holidays are not displayed
- Month boundaries use subtle alternating backgrounds and month chips
