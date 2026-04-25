// Voice assistant edge function — parses Kannada/English voice commands
// using Lovable AI Gateway (Gemini) into a structured intent the UI can act on.
//
// Intents:
//   - booking_draft : extract customer/phone/dates/items → UI opens prefilled form
//   - query         : answer questions about bookings/payments/expenses (reads DB)
//   - chat          : free conversational reply
//
// Replies are always in Kannada text (kn). UI speaks them via browser TTS.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const SYSTEM_PROMPT = `You are the voice assistant for "Shiva Shakti Shamiyana", a tent/event-rental business in Karnataka, India. The user speaks Kannada or English. ALWAYS reply in Kannada (ಕನ್ನಡ) text — short, polite, clear sentences a non-technical owner can understand.

You MUST classify every user input into ONE of three intents and return ONLY a tool call:

1. "booking_draft" — user wants to create a new booking. Extract: customer_name, phone (10 digits), start_date (YYYY-MM-DD; resolve "ನಾಳೆ"=tomorrow, "ಮುಂದಿನ ಭಾನುವಾರ"=next Sunday relative to today's date supplied), end_date, delivery_mode ("Delivery" or "Takeaway"), items (array of {name, quantity}). Any field you cannot extract → leave null. Always set reply to a short Kannada confirmation like "ಬುಕಿಂಗ್ ರಚಿಸಲು ಸಿದ್ಧ. ದಯವಿಟ್ಟು ವಿವರಗಳನ್ನು ಪರಿಶೀಲಿಸಿ." plus mention what's missing.

2. "query" — user asks about existing data: today's income, this month's bookings, pending payments, low stock, expenses. Set query_type to one of: "today_income" | "month_income" | "month_expenses" | "month_profit" | "pending_payments" | "today_bookings" | "month_bookings" | "low_stock" | "total_customers". The reply field will be REPLACED by the system using actual DB numbers — set it to a short Kannada template like "ಪರಿಶೀಲಿಸುತ್ತಿದ್ದೇನೆ…".

3. "chat" — greetings, help requests, or anything not actionable. Reply in Kannada conversationally.`;

const tool = {
  type: "function",
  function: {
    name: "respond",
    description: "Classify intent and return structured response",
    parameters: {
      type: "object",
      properties: {
        intent: { type: "string", enum: ["booking_draft", "query", "chat"] },
        reply: { type: "string", description: "Kannada reply for the user" },
        booking: {
          type: "object",
          properties: {
            customer_name: { type: ["string", "null"] },
            phone: { type: ["string", "null"] },
            address: { type: ["string", "null"] },
            start_date: { type: ["string", "null"] },
            end_date: { type: ["string", "null"] },
            delivery_mode: { type: ["string", "null"], enum: ["Delivery", "Takeaway", null] },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  quantity: { type: "number" },
                },
                required: ["name", "quantity"],
                additionalProperties: false,
              },
            },
          },
          additionalProperties: false,
        },
        query_type: {
          type: ["string", "null"],
          enum: [
            "today_income", "month_income", "month_expenses", "month_profit",
            "pending_payments", "today_bookings", "month_bookings",
            "low_stock", "total_customers", null,
          ],
        },
      },
      required: ["intent", "reply"],
      additionalProperties: false,
    },
  },
};

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
    .format(Math.round(n || 0));

async function runQuery(qt: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().slice(0, 10);

  switch (qt) {
    case "today_income": {
      const { data } = await supabase
        .from("bookings")
        .select("payments")
        .gte("created_at", today);
      let sum = 0;
      for (const b of data || [])
        for (const p of (b.payments as any[]) || [])
          if ((p.date || "").slice(0, 10) === today) sum += Number(p.amount || 0);
      return `ಇಂದು ಸಂಗ್ರಹವಾದ ಒಟ್ಟು ಹಣ ${fmtINR(sum)}.`;
    }
    case "month_income": {
      const { data } = await supabase
        .from("bookings")
        .select("total_paid, created_at")
        .gte("created_at", monthStart);
      const sum = (data || []).reduce((s, b: any) => s + Number(b.total_paid || 0), 0);
      return `ಈ ತಿಂಗಳ ಒಟ್ಟು ಆದಾಯ ${fmtINR(sum)}.`;
    }
    case "month_expenses": {
      const { data } = await supabase
        .from("expenses")
        .select("amount")
        .gte("date", monthStart);
      const sum = (data || []).reduce((s, e: any) => s + Number(e.amount || 0), 0);
      return `ಈ ತಿಂಗಳ ಒಟ್ಟು ವೆಚ್ಚ ${fmtINR(sum)}.`;
    }
    case "month_profit": {
      const [{ data: bs }, { data: es }] = await Promise.all([
        supabase.from("bookings").select("total_paid").gte("created_at", monthStart),
        supabase.from("expenses").select("amount").gte("date", monthStart),
      ]);
      const inc = (bs || []).reduce((s, b: any) => s + Number(b.total_paid || 0), 0);
      const exp = (es || []).reduce((s, e: any) => s + Number(e.amount || 0), 0);
      return `ಈ ತಿಂಗಳ ಲಾಭ ${fmtINR(inc - exp)} (ಆದಾಯ ${fmtINR(inc)}, ವೆಚ್ಚ ${fmtINR(exp)}).`;
    }
    case "pending_payments": {
      const { data } = await supabase
        .from("bookings")
        .select("customer_name, remaining_amount")
        .gt("remaining_amount", 0);
      const total = (data || []).reduce((s, b: any) => s + Number(b.remaining_amount || 0), 0);
      return `ಬಾಕಿ ಪಾವತಿ: ${data?.length || 0} ಬುಕಿಂಗ್‌ಗಳು, ಒಟ್ಟು ${fmtINR(total)}.`;
    }
    case "today_bookings": {
      const { data } = await supabase
        .from("bookings")
        .select("customer_name")
        .eq("start_date", today);
      return `ಇಂದು ${data?.length || 0} ಬುಕಿಂಗ್‌ಗಳಿವೆ.`;
    }
    case "month_bookings": {
      const { count } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .gte("start_date", monthStart);
      return `ಈ ತಿಂಗಳ ಒಟ್ಟು ಬುಕಿಂಗ್‌ಗಳು ${count || 0}.`;
    }
    case "low_stock": {
      const { data } = await supabase
        .from("inventory_items")
        .select("name, available_quantity, low_stock_threshold");
      const low = (data || []).filter(
        (i: any) => Number(i.available_quantity) <= Number(i.low_stock_threshold || 0),
      );
      if (low.length === 0) return "ಯಾವುದೇ ವಸ್ತು ಕಡಿಮೆ ಸ್ಟಾಕ್‌ನಲ್ಲಿಲ್ಲ.";
      return `${low.length} ವಸ್ತು(ಗಳು) ಕಡಿಮೆ ಸ್ಟಾಕ್: ${low.slice(0, 5).map((i: any) => i.name).join(", ")}.`;
    }
    case "total_customers": {
      const { count } = await supabase
        .from("customers")
        .select("id", { count: "exact", head: true });
      return `ಒಟ್ಟು ಗ್ರಾಹಕರು ${count || 0}.`;
    }
  }
  return "ಮಾಹಿತಿ ಲಭ್ಯವಿಲ್ಲ.";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "AI not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { transcript } = await req.json();
    if (!transcript || typeof transcript !== "string") {
      return new Response(JSON.stringify({ error: "transcript required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const userMsg = `Today's date is ${today}. User said: "${transcript}"`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "respond" } },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(
        JSON.stringify({ error: "ದರ ಮಿತಿ ತಲುಪಿದೆ. ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (aiResp.status === 402) {
      return new Response(
        JSON.stringify({ error: "AI ಕ್ರೆಡಿಟ್ ಮುಗಿದಿದೆ. ದಯವಿಟ್ಟು ಸೆಟ್ಟಿಂಗ್‌ನಲ್ಲಿ ಸೇರಿಸಿ." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, txt);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const call = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) {
      return new Response(JSON.stringify({
        intent: "chat",
        reply: "ಕ್ಷಮಿಸಿ, ನನಗೆ ಅರ್ಥವಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಹೇಳಿ.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const args = JSON.parse(call.function.arguments || "{}");

    // For queries, replace the placeholder reply with real numbers from DB.
    if (args.intent === "query" && args.query_type) {
      args.reply = await runQuery(args.query_type);
    }

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("voice-assistant error:", e);
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
