import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

// Price IDs SBW uniquement
const SBW_PRICE_IDS = new Set([
  'price_1TIM9hLBxNkjNd236Z3AfvoS',  // basic 29€
  'price_1TIMA8LBxNkjNd23sNkSycog',  // pro 79€
  'price_1TIMAPLBxNkjNd23KR5yVvdf',  // business 149€
  'price_1TIQSWLBxNkjNd23gtGJ3LKp',  // intro
])

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

async function stripeGet(endpoint: string) {
  const res = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` }
  })
  return res.json()
}

function sumSbwInvoices(invoices: any[]) {
  let total = 0
  for (const inv of invoices) {
    if (inv.status !== 'paid') continue
    for (const line of (inv.lines?.data || [])) {
      if (SBW_PRICE_IDS.has(line.price?.id)) {
        total += (line.amount - (line.amount_refunded || 0))
      }
    }
  }
  return total / 100
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
    const { data: { user } } = await sb.auth.getUser(token)
    if (!user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const { data: userData } = await sb.from("users").select("role").eq("id", user.id).single()
    if (userData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Accès refusé" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    // Invoices du mois en cours (avec line items pour filtrer par price)
    const invoices = await stripeGet(
      `/invoices?created[gte]=${Math.floor(startOfMonth.getTime()/1000)}&limit=100&expand[]=data.lines.data&status=paid`
    )

    // Invoices du mois dernier
    const lastMonthInvoices = await stripeGet(
      `/invoices?created[gte]=${Math.floor(startOfLastMonth.getTime()/1000)}&created[lt]=${Math.floor(startOfMonth.getTime()/1000)}&limit=100&expand[]=data.lines.data&status=paid`
    )

    const revenueThisMonth = sumSbwInvoices(invoices.data || [])
    const revenueLastMonth = sumSbwInvoices(lastMonthInvoices.data || [])
    const revenueDelta = revenueLastMonth > 0
      ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100)
      : 0

    // Abonnements actifs SBW uniquement
    const subs = await stripeGet(`/subscriptions?status=active&limit=100`)
    const sbwSubs = (subs.data || []).filter((s: any) =>
      s.items?.data?.some((item: any) => SBW_PRICE_IDS.has(item.price?.id))
    )

    const mrr = sbwSubs.reduce((sum: number, s: any) => {
      const item = s.items?.data?.find((i: any) => SBW_PRICE_IDS.has(i.price?.id))
      return sum + (item?.price?.unit_amount || 0) / 100
    }, 0)

    // Derniers paiements SBW
    const recentPayments: any[] = []
    for (const inv of (invoices.data || [])) {
      if (inv.status !== 'paid') continue
      const hasSbw = inv.lines?.data?.some((l: any) => SBW_PRICE_IDS.has(l.price?.id))
      if (hasSbw && recentPayments.length < 5) {
        recentPayments.push({
          id: inv.id,
          amount: inv.amount_paid / 100,
          email: inv.customer_email || '—',
          date: new Date(inv.created * 1000).toISOString(),
          status: inv.status
        })
      }
    }

    return new Response(JSON.stringify({
      revenueThisMonth,
      revenueLastMonth,
      revenueDelta,
      mrr,
      activeSubscriptions: sbwSubs.length,
      recentPayments
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (err) {
    console.error(err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
