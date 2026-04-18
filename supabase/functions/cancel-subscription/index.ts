import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!
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
    // Auth
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

    // Récupérer l'abonnement Stripe du membre
    const { data: member } = await sb.from("members")
      .select("stripe_subscription_id")
      .eq("id", user.id)
      .maybeSingle()

    if (!member?.stripe_subscription_id) {
      return new Response(JSON.stringify({ error: "Pas d'abonnement actif" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    // Annuler à la fin de la période (cancel_at_period_end = true)
    // L'utilisateur garde accès jusqu'à la date de fin
    const cancelRes = await fetch(
      `https://api.stripe.com/v1/subscriptions/${member.stripe_subscription_id}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          cancel_at_period_end: "true",
        }),
      }
    )
    const canceled = await cancelRes.json()

    if (canceled.error) {
      console.error("Erreur annulation Stripe:", canceled.error.message)
      return new Response(JSON.stringify({ error: canceled.error.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    // Mettre à jour Supabase (statut annulé mais plan conservé jusqu'à la fin de période)
    await sb.from("members").update({
      stripe_subscription_status: "canceled",
      plan_updated_at: new Date().toISOString(),
    }).eq("id", user.id)

    console.log(`Abonnement programmé pour annulation: ${user.id}`)

    return new Response(JSON.stringify({
      success: true,
      period_end: canceled.current_period_end,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (err) {
    console.error("Erreur:", err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
