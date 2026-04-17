import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const PRICE_IDS: Record<string, string> = {
  mensuel:  "price_1TIMA8LBxNkjNd23sNkSycog", // 79€/mois
  annuel:   "price_ANNUEL_597",                // TODO: créer dans Stripe Dashboard (597€/an)
}

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
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const token = authHeader.replace("Bearer ", "")
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: { user }, error: authError } = await sb.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token invalide" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const body = await req.json()
    const plan = body.plan || "mensuel"
    const email = user.email!
    const userId = user.id

    // Créer ou récupérer le client Stripe (chercher par ID d'abord, puis par email)
    let { data: member } = await sb
      .from("members")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle()

    if (!member) {
      // Fallback: chercher par email et lier au user auth
      const { data: memberByEmail } = await sb
        .from("members")
        .select("id, stripe_customer_id")
        .eq("email", email)
        .maybeSingle()
      if (memberByEmail) {
        await sb.from("members").update({ id: userId, email: email }).eq("id", memberByEmail.id)
        member = memberByEmail
      }
    }

    let customerId = member?.stripe_customer_id

    if (!customerId) {
      const customerRes = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          email: email,
          "metadata[supabase_id]": userId,
        }),
      })
      const customer = await customerRes.json()
      if (customer.error) throw new Error(customer.error.message)
      customerId = customer.id

      // Upsert pour créer le membre s'il n'existe pas encore
      await sb.from("members").upsert({
        id: userId,
        email: email,
        stripe_customer_id: customerId,
        plan: "inscrit",
        created_at: new Date().toISOString()
      }, { onConflict: "id" })
    }

    // Créer le Checkout Session
    const priceId = PRICE_IDS[plan] || PRICE_IDS.mensuel
    const baseParams: Record<string, string> = {
      mode: "subscription",
      success_url: "https://www.startbusinessworld.com/client-dashboard.html?payment=success",
      cancel_url: "https://www.startbusinessworld.com/club.html",
      "metadata[supabase_id]": userId,
      "metadata[plan]": plan,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      "subscription_data[metadata][supabase_id]": userId,
      "subscription_data[metadata][plan]": plan,
    }

    if (customerId) {
      baseParams.customer = customerId
    } else {
      baseParams.customer_email = email
    }

    const sessionRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(baseParams),
    })

    const session = await sessionRes.json()
    if (session.error) throw new Error(session.error.message)

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (err) {
    console.error("Erreur:", err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
