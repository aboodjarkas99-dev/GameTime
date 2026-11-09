# Google Drive Backup — Current Setup

Configured: 2026-11-09

Requested owner/access emails:
- Abood@gametimecoatings.com
- chuck@gametimecoatings.com

## Current Google Drive location

```
GameTime Backups/
  Latest/
    GameTime-Latest-YYYY-MM-DD.xlsx
    GameTime-Full-Code-YYYY-MM-DD-<short-commit>.zip
  Daily/
    YYYY/
      MM/
        GameTime-YYYY-MM-DD.xlsx
        GameTime-Full-Code-YYYY-MM-DD-<short-commit>.zip
```

The connected Google Drive account currently allows GameTime automation to create folders and upload new files. The connector does not currently support replacing, renaming, deleting, or changing Drive sharing permissions, so backups use unique date/commit-stamped filenames and preserve older versions.

## Daily automation

A ChatGPT scheduled task named `GameTime Drive Backup` runs daily after the Supabase Excel backup. It:
1. verifies the current Supabase Excel backup,
2. securely copies the workbook to Google Drive without making the Supabase bucket public,
3. fetches the newest full-source handoff archive generated from GitHub `secure-v2`,
4. uploads date/commit-stamped Drive copies,
5. preserves prior backups.

Supabase also independently creates its private daily workbook backup before the Drive mirror.

## Full code archive

GitHub workflow:
`.github/workflows/gametime-handoff-backup.yml`

On every push to `secure-v2`, it creates a complete repository ZIP artifact named `GameTime-Full-Code`. The ZIP includes:
- main web app,
- Shipping source and built assets,
- database SQL,
- Supabase Edge Functions,
- tests,
- backup utilities,
- this HANDOFF_PACKAGE.

It does not include the repository's `.git` directory.

## Security

Never commit or copy these into the handoff ZIP:
- Supabase service-role/secret keys
- Google OAuth tokens or refresh tokens
- passwords/password hashes
- integration API secrets or key hashes
- push encryption secrets
- live session tokens

Google authorization stays in the connected account/connector and outside source control.

## Sharing note

The backup folder is created in the currently connected Google Drive. The current Drive connector cannot change folder sharing permissions, so access for `chuck@gametimecoatings.com` must be granted from Google Drive sharing controls unless a future connector adds permission-management support.
