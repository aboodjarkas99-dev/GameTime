import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import ExcelJS from "npm:exceljs@4.4.0";

const PROJECT_NAME = "GameTime Secure V2";
const BUCKET = "gametime-backups";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PAGE_SIZE = 1000;

type BackupSpec = {
  sheet: string;
  source: string;
  select?: string;
  note?: string;
};

const SPECS: BackupSpec[] = [
  { sheet: "Employees", source: "profiles" },
  { sheet: "Work Orders", source: "work_orders" },
  { sheet: "Daily Progress", source: "work_order_daily_progress" },
  { sheet: "Activity", source: "activity_logs" },
  { sheet: "Work History", source: "work_order_history" },
  { sheet: "Products", source: "factory_products" },
  { sheet: "Product Aliases", source: "inventory_product_aliases" },
  { sheet: "Inventory Current", source: "inventory_current_stock", note: "Current calculated stock snapshot" },
  { sheet: "Inventory Events", source: "inventory_events" },
  { sheet: "Inventory Lines", source: "inventory_event_lines" },
  { sheet: "Shipping", source: "shipping_shipments" },
  { sheet: "Shipping Lines", source: "shipping_lines" },
  { sheet: "Shipping Reviews", source: "shipping_product_reviews" },
  { sheet: "Shipping Monthly", source: "inventory_shipping_monthly", note: "Derived monthly shipping view" },
  { sheet: "Fill Supplies", source: "fill_line_supplies" },
  { sheet: "Supply Movements", source: "fill_line_supply_movements" },
  { sheet: "Label Stock", source: "fill_line_label_stock" },
  { sheet: "Label Movements", source: "fill_line_label_movements" },
  { sheet: "Label Requests", source: "label_requests" },
  { sheet: "Fill Consumption", source: "fill_line_consumption" },
  { sheet: "Backup Runs", source: "backup_runs" },
  {
    sheet: "Shipping Sessions",
    source: "shipping_desk_sessions",
    select: "user_id,name,role,order_name,customer,since,seen_at",
    note: "Live session token intentionally excluded"
  },
  {
    sheet: "Push Devices",
    source: "push_subscriptions",
    select: "id,user_id,created_at",
    note: "Push endpoint and encryption keys intentionally excluded"
  },
  {
    sheet: "System Bootstrap",
    source: "bootstrap_config",
    select: "id,created_at",
    note: "Bootstrap code hash intentionally excluded"
  },
  {
    sheet: "Integration Keys",
    source: "integration_keys",
    select: "id,name,active,created_at,last_used_at",
    note: "Integration key hash intentionally excluded"
  }
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });

function chicagoDateParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value || "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    display: `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")} America/Chicago`
  };
}

function safeCell(value: unknown): string | number | boolean | Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "boolean") return value;
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /^[=+@-]/.test(text) ? "'" + text : text;
}

async function fetchAll(admin: any, spec: BackupSpec) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await admin
      .from(spec.source)
      .select(spec.select || "*")
      .range(from, to);
    if (error) throw new Error(`${spec.source}: ${error.message}`);
    const page = (data || []) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchAccounts(admin: any) {
  const result: Record<string, unknown>[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error("auth.users: " + error.message);
    const users = data?.users || [];
    result.push(...users.map((u: any) => ({
      id: u.id,
      email: u.email || "",
      phone: u.phone || "",
      role: u.role || "",
      created_at: u.created_at || "",
      updated_at: u.updated_at || "",
      invited_at: u.invited_at || "",
      last_sign_in_at: u.last_sign_in_at || "",
      confirmed_at: u.confirmed_at || "",
      email_confirmed_at: u.email_confirmed_at || "",
      phone_confirmed_at: u.phone_confirmed_at || "",
      recovery_sent_at: u.recovery_sent_at || "",
      email_change_sent_at: u.email_change_sent_at || "",
      phone_change_sent_at: u.phone_change_sent_at || "",
      banned_until: u.banned_until || "",
      deleted_at: u.deleted_at || "",
      is_anonymous: !!u.is_anonymous
    })));
    if (users.length < 1000) break;
  }
  return result;
}

async function fetchSystemMetadata(admin: any) {
  const { data, error } = await admin.rpc("gametime_backup_metadata");
  if (error) throw new Error("backup metadata: " + error.message);
  return (data || {}) as Record<string, Record<string, unknown>[]>;
}

function addDataSheet(workbook: any, name: string, rows: Record<string, unknown>[]) {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }]
  });

  if (!rows.length) {
    sheet.addRow(["No records"]);
    sheet.getCell("A1").font = { bold: true };
    sheet.getColumn(1).width = 18;
    return;
  }

  const keys = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach(k => set.add(k));
      return set;
    }, new Set<string>())
  );

  const header = sheet.addRow(keys);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
  header.alignment = { vertical: "middle", horizontal: "center" };

  for (const row of rows) {
    sheet.addRow(keys.map(k => safeCell(row[k])));
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, rows.length + 1), column: keys.length }
  };

  keys.forEach((key, index) => {
    const sample = rows.slice(0, 150).map(r => safeCell(r[key]));
    let width = Math.max(10, key.length + 2);
    for (const value of sample) width = Math.max(width, Math.min(42, String(value ?? "").length + 2));
    sheet.getColumn(index + 1).width = Math.min(42, width);
  });

  sheet.eachRow((row: any, rowNumber: number) => {
    if (rowNumber > 1) row.alignment = { vertical: "top", wrapText: true };
  });
}

async function ensureBucket(admin: any) {
  const { data } = await admin.storage.getBucket(BUCKET);
  if (data) return;
  const { error } = await admin.storage.createBucket(BUCKET, {
    public: false,
    allowedMimeTypes: [XLSX_MIME]
  });
  if (error && !/already exists/i.test(error.message)) {
    throw new Error("Storage bucket: " + error.message);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) return json({ error: "Supabase environment unavailable" }, 500);

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const token = (req.headers.get("x-gametime-backup-token") || "").trim();
  const { data: allowed, error: authError } = await admin.rpc(
    "verify_gametime_backup_token",
    { p_token: token }
  );
  if (authError || allowed !== true) return json({ error: "Unauthorized" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }

  if (body?.action === "signed-url" || body?.action === "download-chunk") {
    const path = String(body?.path || "latest/GameTime-Latest.xlsx");
    if (!/^latest\/GameTime-Latest\.xlsx$|^daily\/\d{4}\/\d{2}\/GameTime-\d{4}-\d{2}-\d{2}\.xlsx$/.test(path)) {
      return json({ error: "Invalid backup path" }, 400);
    }
    if (body?.action === "signed-url") {
      const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 300);
      if (error || !data?.signedUrl) return json({ error: error?.message || "Signed URL failed" }, 500);
      return json({ ok: true, path, signed_url: data.signedUrl });
    }
    const offset = Math.max(0, Number(body?.offset || 0) | 0);
    const length = Math.min(24576, Math.max(1, Number(body?.length || 24576) | 0));
    const { data, error } = await admin.storage.from(BUCKET).download(path);
    if (error || !data) return json({ error: error?.message || "Download failed" }, 500);
    const all = new Uint8Array(await data.arrayBuffer());
    const chunk = all.slice(offset, Math.min(all.length, offset + length));
    let binary = "";
    for (let i = 0; i < chunk.length; i++) binary += String.fromCharCode(chunk[i]);
    return json({ ok: true, path, offset, length: chunk.length, total: all.length, base64: btoa(binary) });
  }

  const source = String(body?.source || "cron").slice(0, 40);
  const now = new Date();
  const central = chicagoDateParts(now);
  const archivePath = `daily/${central.date.slice(0, 4)}/${central.date.slice(5, 7)}/GameTime-${central.date}.xlsx`;
  const latestPath = "latest/GameTime-Latest.xlsx";

  const { data: run, error: runError } = await admin
    .from("backup_runs")
    .insert({ backup_date: central.date, source, status: "running" })
    .select("id")
    .single();
  if (runError || !run?.id) return json({ error: "Could not start backup audit: " + (runError?.message || "unknown") }, 500);

  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "GameTime";
    workbook.lastModifiedBy = "GameTime Daily Backup";
    workbook.created = now;
    workbook.modified = now;

    const rowCounts: Record<string, number> = {};
    const indexRows: Array<[string, string | number]> = [
      ["GameTime Daily Backup", PROJECT_NAME],
      ["Generated UTC", now.toISOString()],
      ["Generated Central", central.display],
      ["Latest workbook", latestPath],
      ["Daily archive", archivePath],
      ["Security", "Passwords, password hashes, API/integration hashes, push encryption keys, live session tokens, OAuth secrets, and cron secret values are intentionally excluded."],
      ["Coverage", "Every current public table and view is classified and included. The backup fails instead of silently succeeding if a new public relation is added without a backup rule."],
      ["Restore note", "Operational data plus database schema, constraints, indexes, triggers, RLS policies, cron schedules, extensions, routines, and storage inventory are included for recovery reference."]
    ];

    const accounts = await fetchAccounts(admin);
    rowCounts["Accounts"] = accounts.length;

    const systemMetadata = await fetchSystemMetadata(admin);
    const metadataSheets: Array<{ sheet: string; key: string; source: string; note: string }> = [
      { sheet: "DB Schema", key: "schema_columns", source: "information_schema.columns", note: "Every public table/view column, type, default, and nullability" },
      { sheet: "DB Constraints", key: "constraints", source: "pg_constraint", note: "Primary keys, foreign keys, unique and check constraints" },
      { sheet: "DB Indexes", key: "indexes", source: "pg_indexes", note: "Public schema indexes and definitions" },
      { sheet: "DB Triggers", key: "triggers", source: "pg_trigger", note: "Non-internal triggers and definitions" },
      { sheet: "RLS Policies", key: "rls_policies", source: "pg_policies", note: "Row Level Security policy definitions" },
      { sheet: "Cron Jobs", key: "cron_jobs", source: "cron.job", note: "Schedules and enabled state; job commands/secrets excluded" },
      { sheet: "Storage Buckets", key: "storage_buckets", source: "storage.buckets", note: "Storage bucket configuration" },
      { sheet: "Storage Objects", key: "storage_objects", source: "storage.objects", note: "Stored object inventory and metadata; file contents are not embedded in Excel" },
      { sheet: "Extensions", key: "extensions", source: "pg_extension", note: "Installed PostgreSQL extensions" },
      { sheet: "DB Routines", key: "routines", source: "pg_proc", note: "Routine signatures and security mode; routine source code is in the code backup, not Excel" }
    ];

    const relationNames = Array.from(new Set(
      (systemMetadata.schema_columns || []).map((row: any) => String(row.table_name || "")).filter(Boolean)
    )).sort();
    const knownSources = new Set(SPECS.map(spec => spec.source));
    const missingSources = relationNames.filter(name => !knownSources.has(name));
    if (missingSources.length) {
      throw new Error("Backup coverage incomplete. New public tables/views require classification: " + missingSources.join(", "));
    }

    const coverageRows = relationNames.map(name => {
      const spec = SPECS.find(item => item.source === name)!;
      return {
        source: name,
        sheet: spec.sheet,
        coverage: spec.select ? "SAFE SUBSET" : "ALL COLUMNS",
        selected_columns: spec.select || "*",
        note: spec.note || ""
      };
    });
    rowCounts["Backup Coverage"] = coverageRows.length;

    const dataSets: Array<{ spec: BackupSpec; rows: Record<string, unknown>[] }> = [];
    for (const spec of SPECS) {
      const rows = await fetchAll(admin, spec);
      dataSets.push({ spec, rows });
      rowCounts[spec.sheet] = rows.length;
    }

    for (const meta of metadataSheets) {
      rowCounts[meta.sheet] = (systemMetadata[meta.key] || []).length;
    }

    const index = workbook.addWorksheet("Index", { views: [{ state: "frozen", ySplit: 9 }] });
    index.columns = [{ width: 24 }, { width: 88 }, { width: 14 }, { width: 56 }];
    for (const row of indexRows) index.addRow(row);
    index.addRow([]);
    const head = index.addRow(["Sheet", "Source", "Rows", "Notes"]);
    head.font = { bold: true, color: { argb: "FFFFFFFF" } };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
    index.addRow(["Accounts", "auth.users (safe lifecycle fields)", accounts.length, "Passwords and authentication secrets excluded"]);
    index.addRow(["Backup Coverage", "public tables/views", coverageRows.length, "Coverage audit for every public relation"]);
    for (const { spec, rows } of dataSets) {
      index.addRow([spec.sheet, spec.source, rows.length, spec.note || ""]);
    }
    for (const meta of metadataSheets) {
      index.addRow([meta.sheet, meta.source, (systemMetadata[meta.key] || []).length, meta.note]);
    }
    index.eachRow((row: any) => { row.alignment = { vertical: "top", wrapText: true }; });

    addDataSheet(workbook, "Accounts", accounts);
    addDataSheet(workbook, "Backup Coverage", coverageRows);
    for (const { spec, rows } of dataSets) addDataSheet(workbook, spec.sheet, rows);
    for (const meta of metadataSheets) addDataSheet(workbook, meta.sheet, systemMetadata[meta.key] || []);

    const raw = await workbook.xlsx.writeBuffer();
    const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBuffer);

    await ensureBucket(admin);

    const uploadOne = async (path: string) => {
      const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
        contentType: XLSX_MIME,
        cacheControl: "0",
        upsert: true
      });
      if (error) throw new Error(`Upload ${path}: ${error.message}`);
    };

    await uploadOne(archivePath);
    await uploadOne(latestPath);

    const { error: finishError } = await admin
      .from("backup_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        latest_path: latestPath,
        archive_path: archivePath,
        file_bytes: bytes.byteLength,
        row_counts: rowCounts,
        error_message: null
      })
      .eq("id", run.id);
    if (finishError) throw new Error("Backup audit update: " + finishError.message);

    return json({
      ok: true,
      backup_date: central.date,
      latest_path: latestPath,
      archive_path: archivePath,
      bytes: bytes.byteLength,
      row_counts: rowCounts
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await admin.from("backup_runs").update({
      status: "failed",
      finished_at: new Date().toISOString(),
      error_message: message.slice(0, 2000)
    }).eq("id", run.id);
    console.error("GameTime backup failed:", message);
    return json({ error: message }, 500);
  }
});
