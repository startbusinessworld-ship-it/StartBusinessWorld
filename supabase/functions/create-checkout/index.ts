import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const PRICE_IDS = {
  basic:    "price_1TIM9hLBxNkjNd236Z3AfvoS",
  pro:      "price_1TIMA8LBxNkjNd23sNkSycog",
  business: "price_1TIMAPLBxNkjNd23KR5yVvdf",
}

// Offre d'entrée : 1€/mois pendant 3 mois puis 29€/mois (Basic)
const INTRO_PRICE_ID = PRICE_IDS.basic
const INTRO_COUPON_MONTHS = 3
const INTRO_AMOUNT = 100 // 1€ en centimes

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
    // Vérifier le token manuellement
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const token = authHeader.replace("Bearer ", "")
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Vérifier que le token est valide
    const { data: { user }, error: authError } = await sb.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token invalide" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { plan, email, userId, isIntro } = await req.json()

    // Vérifier si le client Stripe existe déjà
    const { data: member } = await sb
      .from("members")
      .select("stripe_customer_id, email")
      .eq("id", userId)
      .maybeSingle()

    let customerId = member?.stripe_customer_id

    // Créer le client Stripe si nécessaire
    if (!customerId) {
      const customerRes = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          email: email || member?.email || "",
          metadata: JSON.stringify({ supabase_id: userId }),
        }),
      })
      const customer = await customerRes.json()
      customerId = customer.id

      // Sauvegarder le stripe_customer_id
      await sb.from("members").update({ stripe_customer_id: customerId }).eq("id", userId)
    }

    // Construire les line_items
    let lineItems
    let subscriptionData: Record<string, unknown> = {
      metadata: { supabase_id: userId, plan: isIntro ? "basic" : plan },
    }

    if (isIntro) {
      // Offre 1€/mois x 3 mois via Subscription Schedule
      // On crée d'abord le coupon si nécessaire, puis la session
      lineItems = [{ price: INTRO_PRICE_ID, quantity: 1 }]
      subscriptionData = {
        ...subscriptionData,
        metadata: { supabase_id: userId, plan: "basic", is_intro: "true" },
        // Phase d'intro gérée via subscription_data.trial_settings n'existe pas
        // On utilise un coupon à durée limitée créé dynamiquement
      }
    } else {
      lineItems = [{ price: PRICE_IDS[plan as keyof typeof PRICE_IDS], quantity: 1 }]
    }

    // Créer le coupon 1€ si intro
    let couponId: string | undefined
    if (isIntro) {
      const couponRes = await fetch("https://api.stripe.com/v1/coupons", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          amount_off: String(2800), // réduction de 28€ (29€ - 1€)
          currency: "eur",
          duration: "repeating",
          duration_in_months: String(INTRO_COUPON_MONTHS),
          name: "Offre d'entrée SBW — 1€/mois x 3 mois",
        }),
      })
      const coupon = await couponRes.json()
      couponId = coupon.id
    }

    // Créer la Checkout Session
    const params: Record<string, string> = {
      mode: "subscription",
      customer: customerId,
      "line_items[0][price]": isIntro ? INTRO_PRICE_ID : PRICE_IDS[plan as keyof typeof PRICE_IDS],
      "line_items[0][quantity]": "1",
      success_url: "https://startbusinessworld.com/client-dashboard.html?payment=success",
      cancel_url: "https://startbusinessworld.com/club.html?payment=cancelled",
      "subscription_data[metadata][supabase_id]": userId,
      "subscription_data[metadata][plan]": isIntro ? "basic" : plan,
    }

    if (couponId) {
      params["discounts[0][coupon]"] = couponId
    }

    const sessionRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params),
    })

    const session = await sessionRes.json()

    if (session.error) {
      throw new Error(session.error.message)
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
