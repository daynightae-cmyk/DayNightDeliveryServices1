import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import {
  isLikelyMojibake,
  repairLikelyMojibake,
} from "../src/services/whatsappMessageCore.mjs";

const url = String(process.env.VITE_SUPABASE_URL || "").trim();
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

if (!url || !serviceRoleKey) {
  throw new Error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

function assertNoError(error, context) {
  if (error) throw new Error(`${context}: ${error.message || String(error)}`);
}

async function repairTemplates() {
  const { data, error } = await supabase
    .from("message_templates")
    .select("id,title,body,is_active,template_key,language")
    .order("template_key", { ascending: true })
    .order("language", { ascending: true });
  assertNoError(error, "Unable to read message_templates");

  let repaired = 0;
  let disabled = 0;

  for (const row of data || []) {
    const title = repairLikelyMojibake(row.title);
    const body = repairLikelyMojibake(row.body);
    const remainsCorrupted = isLikelyMojibake(title) || isLikelyMojibake(body);
    const changed = title !== row.title || body !== row.body;
    const shouldDisable = remainsCorrupted && row.is_active !== false;

    if (!changed && !shouldDisable) continue;

    const { error: updateError } = await supabase
      .from("message_templates")
      .update({
        title,
        body,
        is_active: remainsCorrupted ? false : row.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    assertNoError(updateError, `Unable to update template ${row.template_key}/${row.language}`);

    if (changed) repaired += 1;
    if (shouldDisable) disabled += 1;
  }

  const { data: activeRows, error: verifyError } = await supabase
    .from("message_templates")
    .select("template_key,language,title,body")
    .eq("is_active", true);
  assertNoError(verifyError, "Unable to verify active templates");

  const corruptedActive = (activeRows || []).filter(
    (row) => isLikelyMojibake(row.title) || isLikelyMojibake(row.body),
  );
  if (corruptedActive.length) {
    throw new Error(`Active corrupted templates remain: ${corruptedActive.map((row) => `${row.template_key}/${row.language}`).join(", ")}`);
  }

  return { total: (data || []).length, repaired, disabled };
}

async function repairNotifications() {
  const { data, error } = await supabase
    .from("notifications")
    .select("id,title,message")
    .order("created_at", { ascending: false })
    .limit(1000);
  assertNoError(error, "Unable to read notifications");

  let repaired = 0;
  for (const row of data || []) {
    const title = repairLikelyMojibake(row.title);
    const message = repairLikelyMojibake(row.message);
    if (title === row.title && message === row.message) continue;

    const { error: updateError } = await supabase
      .from("notifications")
      .update({ title, message })
      .eq("id", row.id);
    assertNoError(updateError, `Unable to update notification ${row.id}`);
    repaired += 1;
  }
  return repaired;
}

async function repairMessageLogs() {
  const { data, error } = await supabase
    .from("outbound_message_logs")
    .select("id,generated_message")
    .order("created_at", { ascending: false })
    .limit(1000);
  assertNoError(error, "Unable to read outbound_message_logs");

  let repaired = 0;
  for (const row of data || []) {
    const generatedMessage = repairLikelyMojibake(row.generated_message);
    if (generatedMessage === row.generated_message) continue;

    const { error: updateError } = await supabase
      .from("outbound_message_logs")
      .update({ generated_message: generatedMessage })
      .eq("id", row.id);
    assertNoError(updateError, `Unable to update message log ${row.id}`);
    repaired += 1;
  }
  return repaired;
}

console.log("DAY NIGHT live UTF-8 repair started.");
const templates = await repairTemplates();
const notifications = await repairNotifications();
const messageLogs = await repairMessageLogs();
console.log(JSON.stringify({ ok: true, templates, notifications, messageLogs }));
console.log("DAY NIGHT live UTF-8 repair: PASS");
