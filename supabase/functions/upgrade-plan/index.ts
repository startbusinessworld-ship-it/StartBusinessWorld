import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const PRICE_IDS: Record<string, string> = {
  mensuel:  "price_1TIMA8LBxNkjNd23sNkSycog", // 79€/mois
  annuel:   "price_1TIM2kA5M4c8fIsKmDwrKAAf", // 597€/an
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

    const body = await req.json()
    const newPlan = body.plan

    if (!newPlan || !PRICE_IDS[newPlan]) {
      return new Response(JSON.stringify({ error: "Plan invalide" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    // Récupérer le membre (par ID, puis par email)
    let { data: member } = await sb.from("members")
      .select("id, email, plan, stripe_subscription_id, stripe_customer_id")
      .eq("id", user.id)
      .single()

    if (!member) {
      const { data: memberByEmail } = await sb.from("members")
        .select("id, email, plan, stripe_subscription_id, stripe_customer_id")
        .eq("email", user.email)
        .maybeSingle()
      if (memberByEmail) {
        await sb.from("members").update({ id: user.id, email: user.email! }).eq("id", memberByEmail.id)
        member = { ...memberByEmail, id: user.id }
      }
    }

    if (!member) {
      // Créer le membre s'il n'existe pas
      await sb.from("members").upsert({
        id: user.id,
        email: user.email!,
        plan: "inscrit",
        created_at: new Date().toISOString()
      }, { onConflict: "id" })
      member = { id: user.id, email: user.email!, plan: "inscrit", stripe_subscription_id: null, stripe_customer_id: null }
    }

    // Si le membre a un abonnement Stripe actif → modifier l'abonnement
    if (member.stripe_subscription_id) {
      // Récupérer l'abonnement pour obtenir l'item ID
      const subRes = await fetch(
        `https://api.stripe.com/v1/subscriptions/${member.stripe_subscription_id}`,
        { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } }
      )
      const sub = await subRes.json()

      if (sub.error) {
        console.error("Erreur récup abo:", sub.error.message)
        // Abo introuvable → créer un nouveau checkout
        return createNewCheckout(user, member, newPlan)
      }

      const itemId = sub.items?.data?.[0]?.id
      if (!itemId) {
        return createNewCheckout(user, member, newPlan)
      }

      // Modifier l'abonnement (upgrade immédiat, prorata)
      const updateRes = await fetch(
        `https://api.stripe.com/v1/subscriptions/${member.stripe_subscription_id}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            [`items[0][id]`]: itemId,
            [`items[0][price]`]: PRICE_IDS[newPlan],
            proration_behavior: "create_prorations",
            "metadata[plan]": newPlan,
            "metadata[supabase_id]": user.id,
          }),
        }
      )
      const updated = await updateRes.json()

      if (updated.error) {
        console.error("Erreur upgrade Stripe:", updated.error.message)
        return new Response(JSON.stringify({ error: updated.error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
      }

      // Mettre à jour dans Supabase
      await sb.from("members").update({
        plan: newPlan,
        stripe_subscription_status: updated.status,
        plan_updated_at: new Date().toISOString(),
      }).eq("id", user.id)

      console.log(`Upgrade OK: ${user.id} → ${newPlan}`)

      return new Response(JSON.stringify({
        success: true,
        plan: newPlan,
        message: `Upgrade vers ${newPlan} effectué`
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    // Pas d'abonnement → créer un nouveau checkout
    return createNewCheckout(user, member, newPlan)

  } catch (err) {
    console.error("Erreur:", err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})

async function createNewCheckout(user: any, member: any, plan: string) {
  const customerId = member.stripe_customer_id
  const params: Record<string, string> = {
    mode: "subscription",
    "line_items[0][price]": PRICE_IDS[plan],
    "line_items[0][quantity]": "1",
    success_url: "https://www.startbusinessworld.com/client-dashboard.html?payment=success",
    cancel_url: "https://www.startbusinessworld.com/client-dashboard.html",
    "metadata[supabase_id]": user.id,
    "metadata[plan]": plan,
    "subscription_data[metadata][supabase_id]": user.id,
    "subscription_data[metadata][plan]": plan,
  }
  if (customerId) {
    params.customer = customerId
  } else {
    params.customer_email = user.email || member.email
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
    return new Response(JSON.stringify({ error: session.error.message }), {
      status: 400, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
    })
  }

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
  })
}
