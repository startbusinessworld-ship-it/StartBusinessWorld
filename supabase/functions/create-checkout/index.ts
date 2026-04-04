import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

// Prix normaux
const PRICE_IDS: Record<string, string> = {
  basic:    "price_1TIM9hLBxNkjNd236Z3AfvoS", // 29€/mois
  pro:      "price_1TIMA8LBxNkjNd23sNkSycog", // 79€/mois
  business: "price_1TIMAPLBxNkjNd23KR5yVvdf", // 149€/mois
}

// Prix d'entrée 1€/mois
const INTRO_PRICE_ID = "price_1TIQSWLBxNkjNd23gtGJ3LKp"

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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const token = authHeader.replace("Bearer ", "")
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const { data: { user }, error: authError } = await sb.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token invalide" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const body = await req.json()
    const plan = body.plan || "basic"
    const email = body.email || user.email
    const userId = body.userId || user.id
    const isIntro = body.isIntro === true

    // Créer ou récupérer le client Stripe
    const { data: member } = await sb
      .from("members")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle()

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
      await sb.from("members").update({ stripe_customer_id: customerId }).eq("id", userId)
    }

    let sessionUrl: string

    if (isIntro) {
      // Offre 1€/mois x 3 mois → 29€/mois via Subscription Schedule
      // Étape 1 : créer l'abonnement via Checkout Session avec le prix 1€
      // Étape 2 : après le checkout, créer la Subscription Schedule via webhook

      const sessionRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          mode: "subscription",
          customer: customerId,
          "line_items[0][price]": INTRO_PRICE_ID,
          "line_items[0][quantity]": "1",
          success_url: "https://startbusinessworld.com/client-dashboard.html?payment=success",
          cancel_url: "https://startbusinessworld.com/club.html",
          "subscription_data[metadata][supabase_id]": userId,
          "subscription_data[metadata][plan]": "basic",
          "subscription_data[metadata][is_intro]": "true",
        }),
      })

      const session = await sessionRes.json()
      if (session.error) throw new Error(session.error.message)
      sessionUrl = session.url

    } else {
      // Abonnement normal au prix plein
      const priceId = PRICE_IDS[plan] || PRICE_IDS.basic

      const sessionRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          mode: "subscription",
          customer: customerId,
          "line_items[0][price]": priceId,
          "line_items[0][quantity]": "1",
          success_url: "https://startbusinessworld.com/client-dashboard.html?payment=success",
          cancel_url: "https://startbusinessworld.com/club.html",
          "subscription_data[metadata][supabase_id]": userId,
          "subscription_data[metadata][plan]": plan,
        }),
      })

      const session = await sessionRes.json()
      if (session.error) throw new Error(session.error.message)
      sessionUrl = session.url
    }

    return new Response(JSON.stringify({ url: sessionUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (err) {
    console.error("Erreur:", err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
