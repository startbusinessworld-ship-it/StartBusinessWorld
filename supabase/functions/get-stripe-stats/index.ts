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

async function stripePost(endpoint: string, params: Record<string, string>) {
  const body = new URLSearchParams(params)
  const res = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` }
  })
  return res.json()
}

async function stripeList(endpoint: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  const url = `https://api.stripe.com/v1${endpoint}${qs ? '?' + qs : ''}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` }
  })
  return res.json()
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
    const startTs = Math.floor(startOfMonth.getTime() / 1000).toString()
    const lastMonthTs = Math.floor(startOfLastMonth.getTime() / 1000).toString()

    // Récupérer abonnements actifs + charges en parallèle
    const [subs, chargesThis, chargesLast] = await Promise.all([
      stripeList('/subscriptions', { status: 'active', limit: '100' }),
      stripeList('/charges', { 'created[gte]': startTs, limit: '100', status: 'succeeded' }),
      stripeList('/charges', { 'created[gte]': lastMonthTs, 'created[lt]': startTs, limit: '100', status: 'succeeded' })
    ])

    // Identifier les customers SBW via leurs abonnements
    const sbwSubs = (subs.data || []).filter((s: any) =>
      s.items?.data?.some((item: any) => SBW_PRICE_IDS.has(item.price?.id))
    )
    const sbwCustomerIds = new Set(sbwSubs.map((s: any) => s.customer))

    // Filtrer les charges par customers SBW
    const filterSbwCharges = (charges: any[]) =>
      charges.filter((c: any) => sbwCustomerIds.has(c.customer))

    const sbwChargesThis = filterSbwCharges(chargesThis.data || [])
    const sbwChargesLast = filterSbwCharges(chargesLast.data || [])

    const revenueThisMonth = sbwChargesThis.reduce((sum: number, c: any) =>
      sum + (c.amount - (c.amount_refunded || 0)), 0) / 100
    const revenueLastMonth = sbwChargesLast.reduce((sum: number, c: any) =>
      sum + (c.amount - (c.amount_refunded || 0)), 0) / 100

    const revenueDelta = revenueLastMonth > 0
      ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100)
      : 0

    const mrr = sbwSubs.reduce((sum: number, s: any) => {
      const item = s.items?.data?.find((i: any) => SBW_PRICE_IDS.has(i.price?.id))
      return sum + (item?.price?.unit_amount || 0) / 100
    }, 0)

    // Derniers paiements SBW
    const recentPayments = sbwChargesThis.slice(0, 5).map((c: any) => ({
      id: c.id,
      amount: (c.amount - (c.amount_refunded || 0)) / 100,
      email: c.billing_details?.email || c.receipt_email || '—',
      date: new Date(c.created * 1000).toISOString(),
      status: c.status
    }))

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
