import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Auth — admin seulement
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const token = authHeader.replace("Bearer ", "")
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: { user } } = await sb.auth.getUser(token)
    if (!user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const { data: userData } = await sb.from("users").select("role").eq("id", user.id).maybeSingle()
    if (userData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Accès refusé" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const body = await req.json()
    const { to, subject, message, memberName } = body

    if (!to || !subject || !message) {
      return new Response(JSON.stringify({ error: "to, subject et message requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const firstName = (memberName || "").split(" ")[0] || "membre"

    const htmlBody = `
      <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff">
        <div style="background:#0E0D0B;padding:24px 32px;text-align:center">
          <div style="font-family:Georgia,serif;font-size:20px;color:#F0EDE4;letter-spacing:-0.01em">Start Business World</div>
          <div style="font-size:11px;color:#A67C3A;text-transform:uppercase;letter-spacing:2px;margin-top:4px">Le Club SBW</div>
        </div>
        <div style="padding:32px;color:#111110;font-size:15px;line-height:1.7">
          <p style="margin:0 0 16px">Bonjour ${firstName},</p>
          ${message.split("\n").map((line: string) => `<p style="margin:0 0 12px">${line}</p>`).join("")}
          <div style="margin-top:32px;padding-top:20px;border-top:1px solid #DDDDD8">
            <p style="margin:0;font-size:13px;color:#888884">Start Business World — Le Club SBW</p>
            <p style="margin:4px 0 0;font-size:12px;color:#888884">
              <a href="https://www.startbusinessworld.com" style="color:#A67C3A;text-decoration:none">startbusinessworld.com</a>
            </p>
          </div>
        </div>
      </div>
    `

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Club SBW <contact@startbusinessworld.com>",
        to: [to],
        subject: subject,
        html: htmlBody,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error("Resend error:", data)
      return new Response(JSON.stringify({ error: data.message || "Erreur envoi email" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    console.log(`Email envoyé à ${to}: ${subject}`)

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (err) {
    console.error("Erreur:", err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
