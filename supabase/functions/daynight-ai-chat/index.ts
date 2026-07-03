// DAY NIGHT live AI assistant edge function.
// Deploy with: supabase functions deploy daynight-ai-chat
// Required secret: OPENROUTER_API_KEY
// Optional secrets: OPENROUTER_MODEL, HF_API_TOKEN, HF_MODEL

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are DAY NIGHT DELIVERY SERVICES UAE smart website assistant.
Official company data:
- Company: DAY NIGHT DELIVERY SERVICES / داي نايت لخدمات التوصيل والشحن
- Website: https://daynightae.com
- Email: Admin@daynightae.com
- Phone: +971 56 875 7331
- Local UAE shipping: charged by order count and route, not by kilograms.
- Standard UAE city routes: 30 AED per order.
- Special UAE routes: 50 AED per order.
- International GCC: 95 AED first kg, then 45 AED per extra kg.
- International worldwide: 190 AED first kg, then 90 AED per extra kg.
- Tracking accepts invoice number, tracking number, coupon number, or phone number saved on order.
- Main actions: request delivery, track shipment, pricing, WhatsApp support, merchant/corporate account, COD.
Answer naturally in the user language. Be direct, commercial, useful, and never invent unavailable tracking data. For exact order status, direct the user to /tracking or WhatsApp.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json; charset=utf-8" },
  });
}

function safeText(value: unknown, max = 900) {
  return String(value ?? "").replace(/sk-or-v1-[A-Za-z0-9_-]+/g, "[redacted-openrouter-key]").slice(0, max);
}

function configuredModels() {
  const requested = Deno.env.get("OPENROUTER_MODEL")?.trim();
  return [
    requested,
    "openrouter/free",
    "meta-llama/llama-3.2-3b-instruct:free",
  ].filter((model, index, arr): model is string => Boolean(model) && arr.indexOf(model) === index);
}

async function callOpenRouter(message: string) {
  const key = Deno.env.get("OPENROUTER_API_KEY")?.trim();
  if (!key) return { answer: null, provider: "openrouter", error: "missing_OPENROUTER_API_KEY" };

  const errors: string[] = [];
  for (const model of configuredModels()) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "authorization": `Bearer ${key}`,
          "content-type": "application/json",
          "http-referer": "https://daynightae.com",
          "x-title": "DAY NIGHT DELIVERY SERVICES",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: message },
          ],
          temperature: 0.35,
          max_tokens: 520,
        }),
      });

      const raw = await res.text();
      if (!res.ok) {
        errors.push(`${model}: HTTP ${res.status} ${safeText(raw, 420)}`);
        continue;
      }

      const data = JSON.parse(raw || "{}");
      const answer = data?.choices?.[0]?.message?.content;
      if (typeof answer === "string" && answer.trim()) {
        return { answer: answer.trim(), provider: "openrouter", model: data?.model || model, error: null };
      }
      errors.push(`${model}: empty_response ${safeText(raw, 420)}`);
    } catch (error) {
      errors.push(`${model}: ${safeText((error as Error)?.message || error, 420)}`);
    }
  }

  return { answer: null, provider: "openrouter", error: errors.join(" | ") || "openrouter_no_response" };
}

async function callHuggingFace(message: string) {
  const key = Deno.env.get("HF_API_TOKEN")?.trim();
  if (!key) return { answer: null, provider: "huggingface", error: "missing_HF_API_TOKEN" };

  try {
    const model = Deno.env.get("HF_MODEL")?.trim() || "mistralai/Mistral-7B-Instruct-v0.3";
    const prompt = `<s>[INST] ${SYSTEM_PROMPT}\n\nCustomer message: ${message} [/INST]`;
    const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 420, temperature: 0.35, return_full_text: false } }),
    });
    const raw = await res.text();
    if (!res.ok) return { answer: null, provider: "huggingface", model, error: `HTTP ${res.status} ${safeText(raw, 420)}` };
    const data = JSON.parse(raw || "{}");
    const answer = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;
    return { answer: typeof answer === "string" ? answer.trim() : null, provider: "huggingface", model, error: null };
  } catch (error) {
    return { answer: null, provider: "huggingface", error: safeText((error as Error)?.message || error, 420) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const message = String(body?.message || "").trim().slice(0, 1600);
    if (!message) return json({ answer: null, error: "empty_message" }, 400);

    const openRouter = await callOpenRouter(message);
    if (openRouter.answer) return json({ answer: openRouter.answer, mode: "live_ai", provider: openRouter.provider, model: openRouter.model });

    const huggingFace = await callHuggingFace(message);
    if (huggingFace.answer) return json({ answer: huggingFace.answer, mode: "live_ai", provider: huggingFace.provider, model: huggingFace.model });

    return json({
      answer: null,
      mode: "not_configured",
      debug: {
        openrouter: openRouter.error,
        huggingface: huggingFace.error,
        has_openrouter_key: Boolean(Deno.env.get("OPENROUTER_API_KEY")?.trim()),
        openrouter_model: Deno.env.get("OPENROUTER_MODEL") || null,
      }
    }, 200);
  } catch (error) {
    return json({ answer: null, mode: "edge_error", error: safeText((error as Error)?.message || error, 900) }, 200);
  }
});
