import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

// Map Stripe Price ID → plan SBW
const PRICE_TO_PLAN: Record<string, string> = {
  "price_1TIM9hLBxNkjNd236Z3AfvoS": "basic",
  "price_1TIMA8LBxNkjNd23sNkSycog": "pro",
  "price_1TIMAPLBxNkjNd23KR5yVvdf": "business",
}

serve(async (req) => {
  const body = await req.text()
  const signature = req.headers.get("stripe-signature")!

  // Vérifier la signature Stripe
  let event
  try {
    event = await verifyStripeWebhook(body, signature, STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error("Webhook signature invalide:", err.message)
    return new Response("Signature invalide", { status: 400 })
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  console.log("Événement Stripe reçu:", event.type)

  switch (event.type) {

    // Paiement réussi — abonnement créé
    case "checkout.session.completed": {
      const session = event.data.object
      const supabaseId = session.metadata?.supabase_id
      const plan = session.metadata?.plan || "basic"
      const customerId = session.customer
      const subscriptionId = session.subscription
      const isIntro = session.metadata?.is_intro === "true"

      if (supabaseId) {
        await sb.from("members").update({
          plan,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          plan_updated_at: new Date().toISOString(),
        }).eq("id", supabaseId)
        console.log(`Plan mis à jour : ${supabaseId} → ${plan}`)
      }

      // Si offre intro → créer Subscription Schedule pour basculer sur 29€ après 3 mois
      if (isIntro && subscriptionId) {
        const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!
        const BASIC_PRICE_ID = "price_1TIM9hLBxNkjNd236Z3AfvoS"

        const scheduleRes = await fetch("https://api.stripe.com/v1/subscription_schedules", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            from_subscription: subscriptionId,
            "phases[0][items][0][price]": "price_1TIQSWLBxNkjNd23gtGJ3LKp",
            "phases[0][items][0][quantity]": "1",
            "phases[0][iterations]": "3", // 3 mois à 1€
            "phases[1][items][0][price]": BASIC_PRICE_ID,
            "phases[1][items][0][quantity]": "1",
          }),
        })
        const schedule = await scheduleRes.json()
        if (schedule.error) {
          console.error("Erreur Schedule:", schedule.error.message)
        } else {
          console.log("Subscription Schedule créée:", schedule.id)
        }
      }

      break
    }

    // Abonnement mis à jour (upgrade/downgrade)
    case "customer.subscription.updated": {
      const sub = event.data.object
      const supabaseId = sub.metadata?.supabase_id
      const priceId = sub.items?.data?.[0]?.price?.id
      const plan = PRICE_TO_PLAN[priceId] || "basic"
      const status = sub.status // active, past_due, canceled...

      if (supabaseId) {
        const update: Record<string, string> = {
          plan,
          stripe_subscription_status: status,
          plan_updated_at: new Date().toISOString(),
        }
        // Si annulé ou impayé, repasser en basic
        if (status === "canceled" || status === "unpaid") {
          update.plan = "basic"
        }
        await sb.from("members").update(update).eq("id", supabaseId)
        console.log(`Abonnement mis à jour : ${supabaseId} → ${plan} (${status})`)
      }
      break
    }

    // Abonnement annulé
    case "customer.subscription.deleted": {
      const sub = event.data.object
      const supabaseId = sub.metadata?.supabase_id

      if (supabaseId) {
        await sb.from("members").update({
          plan: "basic",
          stripe_subscription_status: "canceled",
          stripe_subscription_id: null,
          plan_updated_at: new Date().toISOString(),
        }).eq("id", supabaseId)
        console.log(`Abonnement annulé : ${supabaseId} → basic`)
      }
      break
    }

    // Paiement échoué
    case "invoice.payment_failed": {
      const invoice = event.data.object
      const customerId = invoice.customer

      const { data: member } = await sb
        .from("members")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle()

      if (member) {
        await sb.from("members").update({
          stripe_subscription_status: "past_due",
        }).eq("id", member.id)
        console.log(`Paiement échoué : ${member.id}`)
      }
      break
    }

    default:
      console.log(`Événement ignoré : ${event.type}`)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  })
})

// Vérification signature Stripe (HMAC SHA256)
async function verifyStripeWebhook(payload: string, signature: string, secret: string) {
  const parts = signature.split(",")
  const timestamp = parts.find(p => p.startsWith("t="))?.split("=")[1]
  const sig = parts.find(p => p.startsWith("v1="))?.split("=")[1]

  if (!timestamp || !sig) throw new Error("Signature manquante")

  const signedPayload = `${timestamp}.${payload}`
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signatureBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload))
  const expectedSig = Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")

  if (expectedSig !== sig) throw new Error("Signature invalide")

  // Vérifier que le timestamp n'est pas trop vieux (5 min max)
  const diff = Math.abs(Date.now() / 1000 - parseInt(timestamp))
  if (diff > 300) throw new Error("Timestamp trop ancien")

  return JSON.parse(payload)
}
