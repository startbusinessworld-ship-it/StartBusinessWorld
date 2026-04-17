import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const PRICE_TO_PLAN: Record<string, string> = {
  "price_1TIMA8LBxNkjNd23sNkSycog": "mensuel",
  "price_ANNUEL_597": "annuel",                // TODO: remplacer par le vrai Price ID Stripe
}

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
        const plan = session.metadata?.plan || "mensuel"
        const customerId = session.customer
        const subscriptionId = session.subscription
        const customerEmail = session.customer_details?.email || session.customer_email || ""

        if (!supabaseId) {
          console.error("Pas de supabase_id dans metadata")
          // Tenter de trouver le membre par email
          if (customerEmail) {
            const { data: memberByEmail } = await sb.from("members")
              .select("id").eq("email", customerEmail).maybeSingle()
            if (memberByEmail) {
              await sb.from("members").update({
                plan,
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
                stripe_subscription_status: "active",
                plan_updated_at: new Date().toISOString(),
              }).eq("id", memberByEmail.id)
              console.log(`Membre trouvé par email: ${customerEmail} → ${plan}`)
            }
          }
          break
        }

        // Upsert le membre (créer si n'existe pas, mettre à jour sinon)
        const memberData = {
          id: supabaseId,
          plan,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          stripe_subscription_status: "active",
          plan_updated_at: new Date().toISOString(),
          ...(customerEmail ? { email: customerEmail } : {}),
        }

        const { error: upsertError } = await sb.from("members").upsert(memberData, { onConflict: "id" })

        if (upsertError) {
          console.error("Erreur upsert membre:", upsertError.message)
          // Fallback: tenter un update simple
          await sb.from("members").update({
            plan,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            stripe_subscription_status: "active",
            plan_updated_at: new Date().toISOString(),
          }).eq("id", supabaseId)
        }

        console.log(`Membre mis à jour: ${supabaseId} → ${plan}`)
        break
      }

      case "customer.subscription.updated": {
        const sub = event.data.object
        let subMemberId = sub.metadata?.supabase_id
        const priceId = sub.items?.data?.[0]?.price?.id
        const plan = PRICE_TO_PLAN[priceId] || "mensuel"
        const status = sub.status
        // Fallback: chercher par stripe_customer_id
        if (!subMemberId) {
          const { data: m } = await sb.from("members")
            .select("id").eq("stripe_customer_id", sub.customer).maybeSingle()
          if (m) subMemberId = m.id
        }
        if (!subMemberId) break
        await sb.from("members").update({
          plan: status === "canceled" || status === "unpaid" ? "cancelled" : plan,
          stripe_subscription_status: status,
          plan_updated_at: new Date().toISOString(),
        }).eq("id", subMemberId)
        console.log(`Abonnement mis à jour: ${subMemberId} → ${plan} (${status})`)
        break
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object
        let delMemberId = sub.metadata?.supabase_id
        if (!delMemberId) {
          const { data: m } = await sb.from("members")
            .select("id").eq("stripe_customer_id", sub.customer).maybeSingle()
          if (m) delMemberId = m.id
        }
        if (!delMemberId) break
        await sb.from("members").update({
          plan: "cancelled",
          stripe_subscription_status: "canceled",
          stripe_subscription_id: null,
          plan_updated_at: new Date().toISOString(),
        }).eq("id", delMemberId)
        console.log(`Abonnement annulé: ${delMemberId}`)
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
