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

// ─── LIENS AFFILIÉS ───────────────────────────────────────────────────────────
const LINKS = {
  luminos:    "https://luminoscorp.com/?ref=AYB16592ZK8O",
  airwallex:  "https://www.airwallex.com/app/signup?utm_source=agent_referral&utm_medium=partner_referral&utm_campaign=cn&utm_term=hongkongwinchine&utm_content=1",
  legalplace: "https://c3po.link/QP9duxvAkg",
  shopify:    "https://shopify.pxf.io/c/5645860/1061744/13624",
  wix:        "https://wix.pxf.io/c/5645860/2049257/25616",
  wise:       "https://wise.com/invite/ihpc/ayoubhassanr2",
  xtransfer:  "https://www.xtransfer.cn/register?campaign=partner&businessSource=partner-leads&code=165698",
  pingpong:   "https://flowmore.pingpongx.com/entrance/signup?inviteCode=ch3-LMINUO",
  airalo:     "https://airalo.pxf.io/c/5645860/1268485/15608",
  capcut:     "https://capcutaffiliateprogram.pxf.io/jeK1EP",
  udemy:      "https://trk.udemy.com/c/5645860/3193860/39854",
  kiwi:       "https://kiwi.com/user/refer-friend/",
  club:       "https://www.startbusinessworld.com/club.html",
};

// ─── BLOCS CTA FORMAT [OUTIL:] ─────────────────────────────────────────────
const CTA = {
  luminos:    `[OUTIL:Luminos Corp — Créer sa société à Hong Kong|Création en 7 jours, 100% en ligne, depuis n'importe où|${LINKS.luminos}]`,
  airwallex:  `[OUTIL:Airwallex — Compte bancaire international|Multi-devises, compatible Stripe et PayPal, zéro frais cachés|${LINKS.airwallex}]`,
  legalplace: `[OUTIL:LegalPlace — Créer sa société en France|SASU, EURL, SAS en ligne. Code SBW15 pour -15%|${LINKS.legalplace}]`,
  shopify:    `[OUTIL:Shopify — Lance ta boutique e-commerce|La plateforme n°1. Essai gratuit 3 mois via ce lien|${LINKS.shopify}]`,
  wix:        `[OUTIL:Wix — Crée ton site professionnel|Éditeur no-code simple et puissant. Offre spéciale SBW|${LINKS.wix}]`,
  wise:       `[OUTIL:Wise Business — Paiements internationaux|Frais transparents, multi-devises, idéal pour entrepreneurs|${LINKS.wise}]`,
  xtransfer:  `[OUTIL:XTransfer — Paiements Chine & Asie|Solution de référence pour importer depuis la Chine|${LINKS.xtransfer}]`,
  pingpong:   `[OUTIL:PingPong — Encaisser depuis l'étranger|Idéal pour e-commerçants vendant sur Amazon, Shopify|${LINKS.pingpong}]`,
  airalo:     `[OUTIL:Airalo — eSIM internationale|Reste connecté à l'étranger sans frais excessifs|${LINKS.airalo}]`,
  capcut:     `[OUTIL:CapCut — Montage vidéo professionnel|Crée des vidéos pour Reels, Shorts et TikTok facilement|${LINKS.capcut}]`,
  udemy:      `[OUTIL:Udemy — Formations en ligne|Des milliers de cours pour développer tes compétences|${LINKS.udemy}]`,
  kiwi:       `[OUTIL:Kiwi.com — Vols pas chers pour expatriés|Trouve les meilleurs prix pour tes déplacements internationaux|${LINKS.kiwi}]`,
  club:       `[OUTIL:Club Start Business World — Rejoindre maintenant|Formations, outils exclusifs et communauté d'entrepreneurs|${LINKS.club}]`,
};

const CTA_CLUB_BLOCK = `> Rejoins le Club Start Business World — Formations complètes, outils exclusifs, communauté d'entrepreneurs. Tout ce qu'il faut pour lancer et scaler ton business international.

${CTA.club}`;

// ─── MAPPING CTA PAR CATÉGORIE ────────────────────────────────────────────────
function getCTAs(category: string): string {
  const map: Record<string, string[]> = {
    "Hong Kong":         [CTA.luminos, CTA.airwallex],
    "Fiscalité":         [CTA.luminos, CTA.legalplace],
    "Création société":  [CTA.legalplace, CTA.airwallex],
    "E-commerce":        [CTA.shopify, CTA.airwallex, CTA.pingpong],
    "Import-Export":     [CTA.xtransfer, CTA.airwallex, CTA.luminos],
    "Finance":           [CTA.airwallex, CTA.wise, CTA.xtransfer],
    "Expatriation":      [CTA.luminos, CTA.airwallex, CTA.airalo, CTA.kiwi],
    "Business Chine":    [CTA.xtransfer, CTA.airwallex, CTA.shopify],
    "Actualité":         [CTA.airwallex, CTA.wise],
  };
  return (map[category] || [CTA.legalplace]).join("\n\n");
}

// ─── Scores des derniers articles ────────────────────────────────────────────
async function getLastScores(): Promise<string> {
  const { data } = await sb.from("articles")
    .select("title,seo_score,copy_score,engagement_score,seo_recommendations")
    .eq("generated_by_ai", true)
    .order("created_at", { ascending: false })
    .limit(5);
  if (!data || data.length === 0) return "Premier article — pas d'historique.";
  return data.map((a, i) =>
    `#${i+1} "${a.title}" SEO:${a.seo_score} Copy:${a.copy_score} Eng:${a.engagement_score} — Améliorer: ${a.seo_recommendations||"rien"}`
  ).join(" | ");
}

async function callClaude(messages: object[], system: string, maxTokens: number): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: maxTokens, system, messages })
  });
  const data = await res.json();
  return data.content[0].text.trim();
}

// ─── Handler ─────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const manualTopic: string | null = body.topic || null;

    const lastScores = await getLastScores();

    // Sujet
    let topic = manualTopic;
    if (!topic) {
      topic = await callClaude(
        [{ role: "user", content: `Date: ${new Date().toLocaleDateString("fr-FR")}. Propose UN sujet d'article pour Start Business World. Thématiques: Hong Kong, fiscalité internationale, création société, e-commerce, import-export Chine, expatriation, finance entrepreneur, mindset, actualité business (entrepreneurs qui réussissent, réformes, banques, nouvelles tendances). Concret, recherché sur Google en 2026, angle original. Réponds UNIQUEMENT avec le sujet.` }],
        "Tu es rédacteur en chef de Start Business World, média francophone d'entrepreneuriat international.",
        150
      );
    }

    // Générer l'article
    const raw = await callClaude(
      [{ role: "user", content: `Rédige un article complet sur: "${topic}"\n\nScores articles précédents (analyse et fais mieux): ${lastScores}\n\nNote-toi honnêtement après rédaction et donne des recommandations concrètes.` }],
      `Tu es le meilleur rédacteur web francophone. Tu maîtrises le copywriting comme Eugène Schwartz. Tu écris pour Start Business World (SBW), média d'entrepreneuriat international francophone.

ANALYSE D'ABORD: Lis les scores des articles précédents et identifie comment faire MIEUX sur cet article.

RÈGLES ABSOLUES:
- TON: Direct, punchy, entre entrepreneurs. Phrases courtes. Pas de blabla.
- ACCROCHE: 2-3 phrases qui accrochent immédiatement SANS titre
- STRUCTURE: Minimum 4 sections ## avec contenu dense
- DONNÉES: Toujours avec l'année 2026, chiffres concrets
- LONGUEUR: 900-1100 mots
- COPYWRITING: Commence par la douleur ou le désir. Amplifie. Solution. Preuve. Action.

FORMAT MARKDOWN STRICT — RIEN D'AUTRE:
- ## Titre de section
- ### Sous-section
- - élément de liste
- > conseil ou information clé important
- Texte normal en paragraphes séparés par ligne vide
JAMAIS de HTML, JAMAIS de balises <>, JAMAIS de symboles étranges

CATÉGORIES DISPONIBLES: Hong Kong | Fiscalité | Création société | E-commerce | Import-Export | Finance | Expatriation | Business Chine | Mindset | Outils | Actualité

RÉPONDS UNIQUEMENT EN JSON VALIDE (pas de markdown autour):
{
  "title": "Titre SEO accrocheur avec mot-clé principal",
  "deck": "Résumé 150 chars max qui donne envie de lire",
  "slug": "url-optimisee-seo-avec-tirets",
  "category": "une seule catégorie parmi la liste",
  "tags": ["tag1","tag2","tag3","tag4"],
  "meta_title": "Meta titre 55-60 chars avec mot-clé",
  "meta_description": "Meta description 150-155 chars avec mot-clé et CTA",
  "content": "accroche\\n\\n## Section 1\\n\\nContenu...\\n\\n## Section 2\\n\\nContenu...",
  "tools": ["noms des outils mentionnés dans l'article"],
  "seo_score": 0,
  "copy_score": 0,
  "engagement_score": 0,
  "seo_recommendations": "3 points précis pour améliorer le prochain article"
}`,
      2800
    );

    const clean = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const article = JSON.parse(clean);

    // Injecter CTA au milieu de l'article
    const ctaCategory = getCTAs(article.category);
    const paragraphs = article.content.split("\n\n");
    const midPoint = Math.floor(paragraphs.length / 2);

    const contentFinal = [
      ...paragraphs.slice(0, midPoint),
      ctaCategory,
      ...paragraphs.slice(midPoint),
      "",
      CTA_CLUB_BLOCK
    ].join("\n\n");

    // Publier
    const { data, error } = await sb.from("articles").insert({
      title: article.title,
      deck: article.deck,
      slug: article.slug,
      category: article.category,
      tags: article.tags,
      content: contentFinal,
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
