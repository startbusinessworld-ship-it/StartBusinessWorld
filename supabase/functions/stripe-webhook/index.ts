import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const PRICE_TO_PLAN: Record<string, string> = {
  "price_1TIM9hLBxNkjNd236Z3AfvoS": "basic",
  "price_1TIMA8LBxNkjNd23sNkSycog": "pro",
  "price_1TIMAPLBxNkjNd23KR5yVvdf": "business",
  "price_1TIQSWLBxNkjNd23gtGJ3LKp": "intro",
}

const INTRO_PRICE_ID = "price_1TIQSWLBxNkjNd23gtGJ3LKp"
const BASIC_PRICE_ID = "price_1TIM9hLBxNkjNd236Z3AfvoS"

serve(async (req) => {
  const body = await req.text()
  const signature = req.headers.get("stripe-signature") || ""

  let event
  try {
    event = await verifyWebhook(body, signature, STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error("Signature invalide:", err.message)
    return new Response(JSON.stringify({ error: "Signature invalide" }), { status: 400 })
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  console.log("Event:", event.type)

  try {
    switch (event.type) {

      case "checkout.session.completed": {
        const session = event.data.object
        const supabaseId = session.metadata?.supabase_id
        const isIntro = session.metadata?.is_intro === "true"
        const plan = isIntro ? "intro" : (session.metadata?.plan || "basic")
        const customerId = session.customer
        const subscriptionId = session.subscription

        if (!supabaseId) {
          console.error("Pas de supabase_id dans metadata")
          break
        }

        // Mettre à jour le membre
        await sb.from("members").update({
          plan,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          stripe_subscription_status: "active",
          plan_updated_at: new Date().toISOString(),
        }).eq("id", supabaseId)

        console.log(`Membre mis à jour: ${supabaseId} → ${plan}`)

        // Offre intro: créer Subscription Schedule 1€×3 → 29€
        if (isIntro && subscriptionId) {
          const scheduleRes = await fetch("https://api.stripe.com/v1/subscription_schedules", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              from_subscription: subscriptionId,
              end_behavior: "release",
              "phases[0][items][0][price]": INTRO_PRICE_ID,
              "phases[0][items][0][quantity]": "1",
              "phases[0][iterations]": "3",
              "phases[1][items][0][price]": BASIC_PRICE_ID,
              "phases[1][items][0][quantity]": "1",
            }),
          })
          const schedule = await scheduleRes.json()
          if (schedule.error) {
            console.error("Erreur Schedule:", schedule.error.message)
          } else {
            console.log("Schedule créée:", schedule.id, "— bascule 29€ après 3 mois")
          }
        }
        break
      }

      case "customer.subscription.updated": {
        const sub = event.data.object
        const supabaseId = sub.metadata?.supabase_id
        if (!supabaseId) break
        const priceId = sub.items?.data?.[0]?.price?.id
        const plan = PRICE_TO_PLAN[priceId] || "basic"
        const status = sub.status
        await sb.from("members").update({
          plan: status === "canceled" || status === "unpaid" ? "basic" : plan,
          stripe_subscription_status: status,
          plan_updated_at: new Date().toISOString(),
        }).eq("id", supabaseId)
        console.log(`Abonnement mis à jour: ${supabaseId} → ${plan} (${status})`)
        break
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object
        const supabaseId = sub.metadata?.supabase_id
        if (!supabaseId) break
        await sb.from("members").update({
          plan: "basic",
          stripe_subscription_status: "canceled",
          stripe_subscription_id: null,
          plan_updated_at: new Date().toISOString(),
        }).eq("id", supabaseId)
        console.log(`Abonnement annulé: ${supabaseId}`)
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object
        const { data: member } = await sb.from("members")
          .select("id").eq("stripe_customer_id", invoice.customer).maybeSingle()
        if (member) {
          await sb.from("members").update({ stripe_subscription_status: "past_due" }).eq("id", member.id)
        }
        break
      }

      default:
        console.log(`Ignoré: ${event.type}`)
    }
  } catch (err) {
    console.error("Erreur traitement:", err.message)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" }
  })
})

async function verifyWebhook(payload: string, signature: string, secret: string) {
  if (!signature) throw new Error("Signature manquante")

  const parts = signature.split(",")
  const timestamp = parts.find(p => p.startsWith("t="))?.split("=")[1]
  const signatures = parts.filter(p => p.startsWith("v1=")).map(p => p.slice(3))

  if (!timestamp || signatures.length === 0) throw new Error("Format signature invalide")

  const diff = Math.abs(Date.now() / 1000 - parseInt(timestamp))
  if (diff > 300) throw new Error("Timestamp trop ancien")

  const signedPayload = `${timestamp}.${payload}`
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload))
  const expected = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, "0")).join("")

  if (!signatures.some(s => s === expected)) throw new Error("Signature invalide")

  return JSON.parse(payload)
}
