# Google Drive Backup Target

Requested owners/access:
- Abood@gametimecoatings.com
- chuck@gametimecoatings.com

Desired Drive structure:

```
GameTime Backups/
  Latest/
    GameTime-Latest.xlsx
    GameTime-Full-Code-Latest.zip
  Daily/
    YYYY/
      MM/
        GameTime-YYYY-MM-DD.xlsx
        GameTime-Full-Code-YYYY-MM-DD.zip
```

The Google Drive integration must use Google authorization/credentials stored securely outside source control. Do not commit OAuth tokens, refresh tokens, client secrets, or service-account private keys to GitHub.

The Supabase-side Excel backup already runs daily. Once Google Drive authorization is connected, mirror the latest Excel workbook and the code handoff archive to the shared Drive folder.
