import "jsr:@supabase/functions-js/edge-runtime.d.ts";

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type EmailPayload = {
  to: string;
  subject: string;
  language?: "ar" | "en";
  template: "order_confirmation" | "status_update" | "invoice" | "delivery_reminder" | "delivery_failed";
  data?: Record<string, unknown>;
};

const templates = {
  en: {
    order_confirmation: "Your order has been confirmed.",
    status_update: "Your shipment status has been updated.",
    invoice: "Your invoice is ready.",
    delivery_reminder: "Delivery reminder from DAY NIGHT DELIVERY SERVICES.",
    delivery_failed: "Delivery attempt failed. Please contact support."
  },
  ar: {
    order_confirmation: "تم تأكيد طلبك بنجاح.",
    status_update: "تم تحديث حالة الشحنة.",
    invoice: "فاتورتك جاهزة.",
    delivery_reminder: "تذكير بالتسليم من داي نايت.",
    delivery_failed: "تعذر التسليم. يرجى التواصل مع الدعم."
  }
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const payload = (await req.json()) as EmailPayload;
  const language = payload.language === "en" ? "en" : "ar";
  const content = templates[language][payload.template] || templates[language].status_update;

  return new Response(JSON.stringify({
    queued: true,
    to: payload.to,
    subject: payload.subject,
    content,
    template: payload.template
  }), {
    headers: { "Content-Type": "application/json" }
  });
});
