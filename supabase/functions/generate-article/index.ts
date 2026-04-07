import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CTA_LEGALPLACE = `<div style="margin:32px 0;padding:24px;background:#FAFAF8;border-left:4px solid #A67C3A;border-radius:0 8px 8px 0"><p style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#A67C3A;margin:0 0 8px">Partenaire recommandé</p><p style="font-size:17px;font-weight:600;color:#111;margin:0 0 8px">Créer ta société avec LegalPlace</p><p style="font-size:14px;color:#555;margin:0 0 16px">SASU, EURL, SAS en ligne — garanti sans rejet. Code <strong>SBW15</strong> pour -15%.</p><a href="https://www.legalplace.fr" target="_blank" style="display:inline-block;background:#111;color:#fff;padding:10px 20px;border-radius:6px;font-size:13px;font-weight:500;text-decoration:none">Créer ma société →</a></div>`;

const CTA_AIRWALLEX = `<div style="margin:32px 0;padding:24px;background:#FAFAF8;border-left:4px solid #A67C3A;border-radius:0 8px 8px 0"><p style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#A67C3A;margin:0 0 8px">Banking recommandé</p><p style="font-size:17px;font-weight:600;color:#111;margin:0 0 8px">Ouvre ton compte Airwallex</p><p style="font-size:14px;color:#555;margin:0 0 16px">Multi-devises, cartes équipe, virements internationaux. Compatible Stripe et PayPal.</p><a href="https://www.airwallex.com/fr" target="_blank" style="display:inline-block;background:#111;color:#fff;padding:10px 20px;border-radius:6px;font-size:13px;font-weight:500;text-decoration:none">Ouvrir mon compte →</a></div>`;

const CTA_SHOPIFY = `<div style="margin:32px 0;padding:24px;background:#FAFAF8;border-left:4px solid #A67C3A;border-radius:0 8px 8px 0"><p style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#A67C3A;margin:0 0 8px">Outil recommandé</p><p style="font-size:17px;font-weight:600;color:#111;margin:0 0 8px">Lance ta boutique Shopify</p><p style="font-size:14px;color:#555;margin:0 0 16px">La plateforme e-commerce la plus utilisée au monde. Essai gratuit 3 mois.</p><a href="https://shopify.pxf.io/gOP9jv" target="_blank" style="display:inline-block;background:#111;color:#fff;padding:10px 20px;border-radius:6px;font-size:13px;font-weight:500;text-decoration:none">Essayer Shopify →</a></div>`;

const CTA_LUMINOS = `<div style="margin:32px 0;padding:24px;background:#FAFAF8;border-left:4px solid #A67C3A;border-radius:0 8px 8px 0"><p style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#A67C3A;margin:0 0 8px">Partenaire recommandé</p><p style="font-size:17px;font-weight:600;color:#111;margin:0 0 8px">Créer ta société à Hong Kong</p><p style="font-size:14px;color:#555;margin:0 0 16px">Luminos Corp — création en 7 jours, 100% en ligne, depuis n'importe où dans le monde.</p><a href="https://www.startbusinessworld.com/hong-kong" target="_blank" style="display:inline-block;background:#111;color:#fff;padding:10px 20px;border-radius:6px;font-size:13px;font-weight:500;text-decoration:none">Démarrer ma création →</a></div>`;

const CTA_WISE = `<div style="margin:32px 0;padding:24px;background:#FAFAF8;border-left:4px solid #A67C3A;border-radius:0 8px 8px 0"><p style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#A67C3A;margin:0 0 8px">Outil recommandé</p><p style="font-size:17px;font-weight:600;color:#111;margin:0 0 8px">Wise Business</p><p style="font-size:14px;color:#555;margin:0 0 16px">Paiements internationaux transparents et pas chers. Idéal pour freelances et solopreneurs.</p><a href="https://wise.com/fr/business" target="_blank" style="display:inline-block;background:#111;color:#fff;padding:10px 20px;border-radius:6px;font-size:13px;font-weight:500;text-decoration:none">Ouvrir mon compte Wise →</a></div>`;

const CTA_CLUB = `<div style="margin:40px 0;padding:32px;background:#111110;border-radius:12px;text-align:center"><p style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#A67C3A;margin:0 0 12px">Rejoins la communauté</p><p style="font-size:22px;font-weight:600;color:#F0ECE4;margin:0 0 12px">Club Start Business World</p><p style="font-size:14px;color:rgba(240,236,228,0.65);line-height:1.7;margin:0 0 24px">Formations complètes, outils exclusifs, communauté d'entrepreneurs — tout ce qu'il te faut pour lancer et scaler ton business international.</p><a href="https://www.startbusinessworld.com/club.html" target="_blank" style="display:inline-block;background:#A67C3A;color:#fff;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:500;text-decoration:none">Rejoindre le Club SBW →</a></div>`;

function getCTAs(category: string): string {
  const map: Record<string, string> = {
    "Hong Kong": CTA_LUMINOS + CTA_AIRWALLEX,
    "Fiscalité": CTA_LUMINOS,
    "Création société": CTA_LEGALPLACE,
    "E-commerce": CTA_SHOPIFY + CTA_AIRWALLEX,
    "Import-Export": CTA_LUMINOS + CTA_AIRWALLEX,
    "Expatriation": CTA_LUMINOS + CTA_AIRWALLEX,
    "Finance": CTA_AIRWALLEX + CTA_WISE,
    "Mindset": "",
    "Business Chine": CTA_AIRWALLEX + CTA_SHOPIFY,
  };
  return map[category] || CTA_LEGALPLACE;
}

async function getLastScores(): Promise<string> {
  const { data } = await sb.from("articles")
    .select("title,seo_score,copy_score,engagement_score,seo_recommendations")
    .eq("generated_by_ai", true)
    .order("created_at", { ascending: false })
    .limit(3);
  if (!data || data.length === 0) return "Premier article.";
  return data.map((a, i) =>
    `#${i+1} "${a.title}" SEO:${a.seo_score} Copy:${a.copy_score} Eng:${a.engagement_score} — A ameliorer: ${a.seo_recommendations||"rien"}`
  ).join(" | ");
}

async function callClaude(messages: object[], systemPrompt: string, maxTokens: number) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages
    })
  });
  const data = await res.json();
  return data.content[0].text.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const manualTopic: string | null = body.topic || null;

    // 1. Scores des derniers articles
    const lastScores = await getLastScores();

    // 2. Sujet
    let topic = manualTopic;
    if (!topic) {
      topic = await callClaude(
        [{ role: "user", content: `Date: ${new Date().toLocaleDateString("fr-FR")}. Propose UN sujet d'article pour Start Business World (entrepreneuriat international francophone: Hong Kong, fiscalité, e-commerce, import-export, expatriation, finance, mindset). Concret, recherché sur Google 2026, angle original. Réponds UNIQUEMENT avec le sujet.` }],
        "Tu es rédacteur en chef SBW.",
        150
      );
    }

    // 3. Générer l'article
    const raw = await callClaude(
      [{ role: "user", content: `Rédige un article complet sur: "${topic}". Scores précédents: ${lastScores}. Note-toi après rédaction.` }],
      `Tu es le meilleur rédacteur web francophone. Style Eugène Schwartz. Tu écris pour Start Business World.

RÈGLES:
- HTML UNIQUEMENT. JAMAIS de markdown (pas ##, pas **, pas -)
- Utilise <h2><h3><p><ul><li><blockquote>
- Accroche <p> sans titre, min 4 <h2>, callouts <blockquote>, conclusion
- Direct, punchy, données 2026, 800-1000 mots
- Mot-clé dans premier <h2> et premiers 100 mots

RÉPONDS UNIQUEMENT EN JSON:
{"title":"...","deck":"résumé 150 chars","slug":"url-seo","category":"Hong Kong|Fiscalité|Création société|E-commerce|Import-Export|Expatriation|Finance|Mindset|Business Chine","tags":["..."],"meta_title":"60 chars","meta_description":"155 chars","content":"HTML ici","tools":["Airwallex","Wise","LegalPlace","Shopify"],"seo_score":0,"copy_score":0,"engagement_score":0,"seo_recommendations":"..."}`,
      2500
    );

    const clean = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const article = JSON.parse(clean);

    // 4. Injecter CTA
    const ctaCategory = getCTAs(article.category);
    const parts = article.content.split("</h2>");
    let contentWithCTA = article.content;
    if (parts.length >= 3) {
      const mid = Math.floor(parts.length / 2);
      parts.splice(mid, 0, ctaCategory);
      contentWithCTA = parts.join("</h2>");
    } else {
      contentWithCTA = article.content + ctaCategory;
    }
    contentWithCTA += CTA_CLUB;

    // 5. Publier dans Supabase
    const { data, error } = await sb.from("articles").insert({
      title: article.title,
      deck: article.deck,
      slug: article.slug,
      category: article.category,
      tags: article.tags,
      content: contentWithCTA,
      meta_title: article.meta_title,
      meta_description: article.meta_description,
      tools: article.tools || [],
      status: "published",
      generated_by_ai: true,
      seo_score: article.seo_score,
      copy_score: article.copy_score,
      engagement_score: article.engagement_score,
      seo_recommendations: article.seo_recommendations,
      views: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).select().single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, article: data, topic }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
