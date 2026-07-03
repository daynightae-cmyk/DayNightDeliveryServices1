// DAY NIGHT live AI assistant edge function.
// Deploy with: supabase functions deploy daynight-ai-chat
// Required secret: HF_API_TOKEN or OPENROUTER_API_KEY
// Optional secrets: HF_MODEL, OPENROUTER_MODEL

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

async function callOpenRouter(message: string) {
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) return null;
  const model = Deno.env.get("OPENROUTER_MODEL") || "mistralai/mistral-7b-instruct:free";
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
      max_tokens: 450,
    }),
  });
  if (!res.ok) throw new Error(`openrouter_${res.status}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || null;
}

async function callHuggingFace(message: string) {
  const key = Deno.env.get("HF_API_TOKEN");
  if (!key) return null;
  const model = Deno.env.get("HF_MODEL") || "mistralai/Mistral-7B-Instruct-v0.3";
  const prompt = `<s>[INST] ${SYSTEM_PROMPT}\n\nCustomer message: ${message} [/INST]`;
  const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 420, temperature: 0.35, return_full_text: false } }),
  });
  if (!res.ok) throw new Error(`huggingface_${res.status}`);
  const data = await res.json();
  if (Array.isArray(data)) return data[0]?.generated_text || null;
  return data?.generated_text || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const message = String(body?.message || "").trim().slice(0, 1600);
    if (!message) return json({ answer: null, error: "empty_message" }, 400);

    const answer = await callOpenRouter(message).catch(() => null) || await callHuggingFace(message).catch(() => null);
    if (!answer) return json({ answer: null, mode: "not_configured" }, 200);
    return json({ answer, mode: "live_ai" });
  } catch (error) {
    return json({ answer: null, error: String(error?.message || error) }, 200);
  }
});
