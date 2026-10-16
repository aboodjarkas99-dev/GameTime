import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import bcrypt from "npm:bcryptjs@2.4.3";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";

  const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: authData, error: authError } = await caller.auth.getUser();
  if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

  const { data: profile, error: profileError } = await caller.from("profiles").select("role,active").eq("id", authData.user.id).single();
  if (profileError || !profile?.active || profile.role !== "manager") return json({ error: "Management access required" }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid request" }, 400); }

  const displayName = String(body.display_name || "").trim();
  const employeeCode = String(body.employee_code || "").trim().toLowerCase();
  const role = String(body.role || "").trim();
  const pin = String(body.pin || "").trim();

  if (displayName.length < 2 || displayName.length > 60) return json({ error: "Enter a valid employee name" }, 400);
  if (!/^[a-z0-9._-]{1,30}$/.test(employeeCode)) return json({ error: "Employee code can be 1-30 letters or numbers" }, 400);
  if (!["batch","prod","viewer","chemist","shipping","inventory"].includes(role)) return json({ error: "Invalid employee role" }, 400);
  if (!/^\d{4,12}$/.test(pin)) return json({ error: "PIN must be 4-12 digits" }, 400);

  const jobTitle = role === "batch" ? "Batch Maker" : role === "prod" ? "Production" : role === "chemist" ? "Chemist" : role === "shipping" ? "Shipping" : role === "inventory" ? "Inventory" : "View Only";

  const admin = createClient(supabaseUrl, serviceRole);
  const email = employeeCode + "@gametime.local";
  const passwordHash = await bcrypt.hash(pin, 10);

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email, password_hash: passwordHash, email_confirm: true,
    user_metadata: { display_name: displayName, employee_code: employeeCode, role, job_title: jobTitle },
  });
  if (createError || !created.user) return json({ error: createError?.message || "Could not create employee" }, 400);

  const { error: insertError } = await admin.from("profiles").insert({
    id: created.user.id, display_name: displayName, employee_code: employeeCode, role, job_title: jobTitle, active: true,
  });

  if (insertError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: insertError.message }, 400);
  }

  return json({ ok: true, employee: { id: created.user.id, display_name: displayName, employee_code: employeeCode, role, job_title: jobTitle } });
});
