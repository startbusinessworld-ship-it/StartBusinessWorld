import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const PRICE_TO_PLAN: Record<string, string> = {
  "price_1TIMA8LBxNkjNd23sNkSycog": "mensuel",
  "price_1TIM2kA5M4c8fIsKmDwrKAAf": "annuel",
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
    // Auth: vérifier le token utilisateur
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

    // Récupérer le membre
    let { data: member } = await sb.from("members")
      .select("id, email, plan, stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle()

    if (!member) {
      // Fallback: chercher par email dans members
      const { data: memberByEmail } = await sb.from("members")
        .select("id, email, plan, stripe_customer_id")
        .eq("email", user.email)
        .maybeSingle()

      if (memberByEmail) {
        // Lier le membre à l'auth user
        await sb.from("members").update({ id: user.id }).eq("id", memberByEmail.id)
        member = { ...memberByEmail, id: user.id }
      } else {
        return new Response(JSON.stringify({ synced: false, reason: "Membre non trouvé" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
      }
    }

    // Si pas de customer Stripe, chercher par email (escape les apostrophes)
    let customerId = member.stripe_customer_id
    if (!customerId && member.email) {
      const safeEmail = member.email.replace(/'/g, "\\'")
      const searchRes = await fetch(
        `https://api.stripe.com/v1/customers/search?query=email:'${safeEmail}'`,
        { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } }
      )
      const searchData = await searchRes.json()
      if (searchData.data?.length > 0) {
        customerId = searchData.data[0].id
        // Sauvegarder le customer_id
        await sb.from("members").update({ stripe_customer_id: customerId }).eq("id", user.id)
      }
    }

    if (!customerId) {
      return new Response(JSON.stringify({ synced: false, reason: "Pas de client Stripe" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    // Récupérer les abonnements actifs de ce customer
    const subsRes = await fetch(
      `https://api.stripe.com/v1/subscriptions?customer=${customerId}&status=active&limit=10`,
      { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } }
    )
    const subs = await subsRes.json()

    // Aussi vérifier les abonnements trialing
    const trialingRes = await fetch(
      `https://api.stripe.com/v1/subscriptions?customer=${customerId}&status=trialing&limit=10`,
      { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } }
    )
    const trialingSubs = await trialingRes.json()

    const allSubs = [...(subs.data || []), ...(trialingSubs.data || [])]

    // Trouver un abonnement SBW
    let newPlan = null
    let subId = null
    let subStatus = null

    for (const sub of allSubs) {
      for (const item of (sub.items?.data || [])) {
        const priceId = item.price?.id
        if (priceId && PRICE_TO_PLAN[priceId]) {
          newPlan = PRICE_TO_PLAN[priceId]
          subId = sub.id
          subStatus = sub.status
          break
        }
      }
      if (newPlan) break
    }

    if (!newPlan) {
      return new Response(JSON.stringify({ synced: false, reason: "Aucun abonnement SBW actif" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    // Mettre à jour le membre
    const { error: updateError } = await sb.from("members").update({
      plan: newPlan,
      stripe_customer_id: customerId,
      stripe_subscription_id: subId,
      stripe_subscription_status: subStatus,
      plan_updated_at: new Date().toISOString(),
    }).eq("id", user.id)

    if (updateError) {
      console.error("Erreur update:", updateError.message)
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    console.log(`Sync OK: ${user.id} → ${newPlan} (${subStatus})`)

    return new Response(JSON.stringify({
      synced: true,
      plan: newPlan,
      status: subStatus
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (err) {
    console.error("Erreur sync:", err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
