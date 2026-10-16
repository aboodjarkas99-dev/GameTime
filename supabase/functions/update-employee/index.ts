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

  const { data: callerProfile, error: callerError } = await caller.from("profiles").select("role,active").eq("id", authData.user.id).single();
  if (callerError || !callerProfile?.active || callerProfile.role !== "manager") return json({ error: "Management access required" }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid request" }, 400); }

  const id = String(body.id || "").trim();
  const displayName = String(body.display_name || "").trim();
  const employeeCode = String(body.employee_code || "").trim().toLowerCase();
  const role = String(body.role || "").trim();
  const pin = String(body.pin || "").trim();
  const pageRoles = [...new Set(Array.isArray(body.page_roles) ? body.page_roles.map(String) : [role])];
  if(!pageRoles.length || pageRoles.length>6 || !pageRoles.includes(role) || pageRoles.some(r=>!["batch","prod","viewer","chemist","shipping","inventory"].includes(r)))return json({error:"Choose valid employee pages"},400);

  if (!id) return json({ error: "Employee is required" }, 400);
  if (displayName.length < 2 || displayName.length > 60) return json({ error: "Enter a valid employee name" }, 400);
  if (!/^[a-z0-9._-]{1,30}$/.test(employeeCode)) return json({ error: "Employee code can be 1-30 letters or numbers" }, 400);
  if (!["batch","prod","viewer","chemist","shipping","inventory"].includes(role)) return json({ error: "Invalid employee role" }, 400);
  if (pin && !/^\d{4,12}$/.test(pin)) return json({ error: "New PIN must be 4-12 digits" }, 400);

  const admin = createClient(supabaseUrl, serviceRole);
  const { data: target, error: targetError } = await admin.from("profiles")
    .select("id,display_name,employee_code,role,page_roles,job_title,active").eq("id", id).single();
  if (targetError || !target) return json({ error: "Employee not found" }, 404);
  if (target.role === "manager") return json({ error: "Management accounts cannot be edited here" }, 403);

  const { data: duplicate } = await admin.from("profiles").select("id").eq("employee_code", employeeCode).neq("id", id).maybeSingle();
  if (duplicate) return json({ error: "That Employee Code is already in use" }, 409);

  const jobTitle = role === "batch" ? "Batch Maker" : role === "prod" ? "Production" : role === "chemist" ? "Chemist" : role === "shipping" ? "Shipping" : role === "inventory" ? "Inventory" : "View Only";
  const newEmail = employeeCode + "@gametime.local";
  const authAttrs: Record<string, unknown> = {
    email: newEmail,
    email_confirm: true,
    user_metadata: { display_name: displayName, employee_code: employeeCode, role, page_roles:pageRoles, job_title: jobTitle },
  };
  if (pin) authAttrs.password_hash = await bcrypt.hash(pin, 10);

  const { error: authUpdateError } = await admin.auth.admin.updateUserById(id, authAttrs);
  if (authUpdateError) return json({ error: authUpdateError.message }, 400);

  const { error: profileUpdateError } = await admin.from("profiles").update({
    display_name: displayName,
    employee_code: employeeCode,
    role,
    page_roles:pageRoles,
    job_title: jobTitle,
  }).eq("id", id);

  if (profileUpdateError) return json({ error: profileUpdateError.message }, 400);

  return json({ ok: true });
});
