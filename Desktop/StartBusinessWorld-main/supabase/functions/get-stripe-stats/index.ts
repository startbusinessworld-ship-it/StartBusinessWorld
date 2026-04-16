import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

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

    // Charges du mois en cours
    const chargesRes = await fetch(
      `https://api.stripe.com/v1/charges?created[gte]=${Math.floor(startOfMonth.getTime()/1000)}&limit=100&status=succeeded`,
      { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } }
    )
    const charges = await chargesRes.json()

    // Charges du mois dernier
    const lastMonthRes = await fetch(
      `https://api.stripe.com/v1/charges?created[gte]=${Math.floor(startOfLastMonth.getTime()/1000)}&created[lt]=${Math.floor(startOfMonth.getTime()/1000)}&limit=100&status=succeeded`,
      { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } }
    )
    const lastMonthCharges = await lastMonthRes.json()

    // Abonnements actifs
    const subsRes = await fetch(
      `https://api.stripe.com/v1/subscriptions?status=active&limit=100`,
      { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } }
    )
    const subs = await subsRes.json()

    const revenueThisMonth = (charges.data || []).reduce((sum: number, c: any) => sum + c.amount, 0) / 100
    const revenueLastMonth = (lastMonthCharges.data || []).reduce((sum: number, c: any) => sum + c.amount, 0) / 100
    const revenueDelta = revenueLastMonth > 0
      ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100)
      : 0

    const mrr = (subs.data || []).reduce((sum: number, s: any) => {
      const amount = s.items?.data?.[0]?.price?.unit_amount || 0
      return sum + amount / 100
    }, 0)

    const recentPayments = (charges.data || []).slice(0, 5).map((c: any) => ({
      id: c.id,
      amount: c.amount / 100,
      email: c.billing_details?.email || '—',
      date: new Date(c.created * 1000).toISOString(),
      status: c.status
    }))

    return new Response(JSON.stringify({
      revenueThisMonth,
      revenueLastMonth,
      revenueDelta,
      mrr,
      activeSubscriptions: subs.data?.length || 0,
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
