import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const UNSPLASH_KEY = "DN6WRgVvzG_ZivB2m1HabRpSaUZXv2PpXUwAnNlMjC0";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── UNSPLASH ─────────────────────────────────────────────────────────────────
async function fetchImage(query: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`,
      { headers: { "Authorization": `Client-ID ${UNSPLASH_KEY}` } }
    );
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      const idx = Math.floor(Math.random() * Math.min(5, data.results.length));
      return data.results[idx].urls.regular;
    }
    return null;
  } catch { return null; }
}

// ─── LIENS AFFILIÉS ───────────────────────────────────────────────────────────
const LINKS: Record<string, string> = {
  luminos:   "https://luminoscorp.com/?ref=AYB16592ZK8O",
  airwallex: "https://www.airwallex.com/app/signup?utm_source=agent_referral&utm_medium=partner_referral&utm_campaign=cn&utm_term=hongkongwinchine&utm_content=1",
  legalplace:"https://c3po.link/QP9duxvAkg",
  shopify:   "https://shopify.pxf.io/c/5645860/1061744/13624",
  wix:       "https://wix.pxf.io/c/5645860/2049257/25616",
  wise:      "https://wise.com/invite/ihpc/ayoubhassanr2",
  xtransfer: "https://www.xtransfer.cn/register?campaign=partner&businessSource=partner-leads&code=165698",
  pingpong:  "https://flowmore.pingpongx.com/entrance/signup?inviteCode=ch3-LMINUO",
  airalo:    "https://airalo.pxf.io/c/5645860/1268485/15608",
  capcut:    "https://capcutaffiliateprogram.pxf.io/jeK1EP",
  udemy:     "https://trk.udemy.com/c/5645860/3193860/39854",
  kiwi:      "https://kiwi.com/user/refer-friend/",
  club:      "https://www.startbusinessworld.com/club.html",
};

// ─── CTA FORMAT [OUTIL:Nom|Description|URL] ──────────────────────────────────
const CTA: Record<string, string> = {
  luminos:   `[OUTIL:Luminos Corp — Société Hong Kong|Création 7 jours, 100% en ligne, depuis n'importe où|${LINKS.luminos}]`,
  airwallex: `[OUTIL:Airwallex — Compte bancaire international|Multi-devises, Stripe compatible, zéro frais cachés|${LINKS.airwallex}]`,
  legalplace:`[OUTIL:LegalPlace — Créer sa société en France|SASU EURL SAS en ligne. Code SBW15 pour -15%|${LINKS.legalplace}]`,
  shopify:   `[OUTIL:Shopify — Lance ta boutique e-commerce|Plateforme n°1 mondial. Essai gratuit 3 mois|${LINKS.shopify}]`,
  wix:       `[OUTIL:Wix — Crée ton site professionnel|Éditeur no-code simple et puissant. Offre SBW|${LINKS.wix}]`,
  wise:      `[OUTIL:Wise Business — Paiements internationaux|Frais transparents, multi-devises, idéal entrepreneurs|${LINKS.wise}]`,
  xtransfer: `[OUTIL:XTransfer — Paiements Chine et Asie|Solution de référence pour importer depuis la Chine|${LINKS.xtransfer}]`,
  pingpong:  `[OUTIL:PingPong — Encaisser depuis l'étranger|Idéal pour Amazon FBA et e-commerçants internationaux|${LINKS.pingpong}]`,
  airalo:    `[OUTIL:Airalo — eSIM internationale|Reste connecté à l'étranger sans frais excessifs|${LINKS.airalo}]`,
  capcut:    `[OUTIL:CapCut — Montage vidéo pro|Crée des Reels, Shorts et TikTok facilement|${LINKS.capcut}]`,
  udemy:     `[OUTIL:Udemy — Formations en ligne|Des milliers de cours pour développer tes compétences|${LINKS.udemy}]`,
  kiwi:      `[OUTIL:Kiwi.com — Vols pas chers|Trouve les meilleurs prix pour tes voyages internationaux|${LINKS.kiwi}]`,
  club:      `[OUTIL:Club Start Business World|Formations, outils exclusifs et communauté d'entrepreneurs|${LINKS.club}]`,
};

const CLUB_BLOCK = `> Rejoins le Club Start Business World — Formations complètes, outils exclusifs, communauté d'entrepreneurs francophones. Tout ce qu'il faut pour lancer et scaler ton business international.

${CTA.club}`;

// ─── CTA PAR CATÉGORIE ────────────────────────────────────────────────────────
function getCTAs(cat: string): string {
  const map: Record<string, string[]> = {
    "Hong Kong":        [CTA.luminos, CTA.airwallex],
    "Fiscalite":        [CTA.luminos, CTA.legalplace],
    "Fiscalité":        [CTA.luminos, CTA.legalplace],
    "Creation societe": [CTA.legalplace, CTA.airwallex],
    "Création société": [CTA.legalplace, CTA.airwallex],
    "E-commerce":       [CTA.shopify, CTA.airwallex, CTA.pingpong],
    "Import-Export":    [CTA.xtransfer, CTA.airwallex, CTA.luminos],
    "Finance":          [CTA.airwallex, CTA.wise, CTA.xtransfer],
    "Expatriation":     [CTA.luminos, CTA.airwallex, CTA.airalo, CTA.kiwi],
    "Business Chine":   [CTA.xtransfer, CTA.airwallex, CTA.shopify],
    "Mindset":          [CTA.capcut, CTA.udemy],
    "Outils":           [CTA.capcut, CTA.shopify, CTA.wix],
    "Actualite":        [CTA.airwallex, CTA.wise],
    "Actualité":        [CTA.airwallex, CTA.wise],
  };
  return (map[cat] || [CTA.legalplace]).join("\n\n");
}

// ─── SCORES DES DERNIERS ARTICLES ────────────────────────────────────────────
async function getLastScores(): Promise<string> {
  try {
    const { data } = await sb.from("articles")
      .select("title,seo_score,copy_score,engagement_score,seo_recommendations")
      .eq("generated_by_ai", true)
      .order("created_at", { ascending: false })
      .limit(5);
    if (!data || data.length === 0) return "Premier article — pas d'historique.";
    return data.map((a, i) =>
      `#${i+1} "${a.title}" SEO:${a.seo_score}/100 Copy:${a.copy_score}/100 Eng:${a.engagement_score}/100 — Améliorer: ${a.seo_recommendations || "rien"}`
    ).join(" || ");
  } catch { return "Impossible de charger l'historique."; }
}

// ─── APPEL CLAUDE ─────────────────────────────────────────────────────────────
async function callClaude(messages: object[], system: string, maxTokens: number): Promise<string> {
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
      system,
      messages
    })
  });
  const data = await res.json();
  if (!data.content || !data.content[0]) throw new Error("Claude API error: " + JSON.stringify(data));
  return data.content[0].text.trim();
}

// ─── HANDLER PRINCIPAL ────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const manualTopic: string | null = body.topic || null;

    // 1. Scores des derniers articles
    const lastScores = await getLastScores();

    // 2. Générer un sujet varié si pas de sujet manuel
    let topic = manualTopic;
    if (!topic) {
      const date = new Date().toLocaleDateString("fr-FR");
      const rand = Math.floor(Math.random() * 11);
      const themes = [
        "Hong Kong fiscalité société offshore",
        "e-commerce Shopify Amazon FBA dropshipping",
        "import export Chine fournisseurs",
        "expatriation Dubaï fiscalité nomade digital",
        "finance entrepreneur trésorerie banque",
        "actualité business entrepreneur succès réforme",
        "création société France SASU EURL",
        "mindset entrepreneur productivité succès",
        "outils IA automatisation business",
        "Airwallex Wise paiements internationaux",
        "immobilier investissement international"
      ];
      topic = await callClaude(
        [{ role: "user", content: `Date: ${date}. Thème imposé: "${themes[rand]}". Propose UN seul sujet d'article de blog ORIGINAL et CONCRET pour Start Business World, différent de ces sujets déjà traités: ${lastScores}. Réponds UNIQUEMENT avec le titre du sujet, rien d'autre.` }],
        "Tu es rédacteur en chef de Start Business World, média francophone d'entrepreneuriat international. Tu dois proposer des sujets variés, jamais répétitifs.",
        100
      );
    }

    // 3. Générer l'article complet en markdown
    const raw = await callClaude(
      [{ role: "user", content: `Rédige un article complet sur: "${topic}"\n\nAnalyse les scores précédents et fais MIEUX:\n${lastScores}\n\nNote-toi honnêtement et donne 3 recommandations précises.` }],
      `Tu es le meilleur rédacteur web francophone. Style Eugène Schwartz. Tu écris pour Start Business World (SBW).

ANALYSE: Lis les scores et recommandations des articles précédents. Fais MIEUX sur cet article.

RÈGLES ABSOLUES:
- TON: Direct, punchy, entrepreneur à entrepreneur. Phrases courtes. Impact immédiat.
- ACCROCHE: 2-3 phrases percutantes SANS titre en début
- STRUCTURE: 4-5 sections avec ## Titre section
- DONNÉES: Chiffres concrets, année 2026
- LONGUEUR: 900-1100 mots
- COPYWRITING SCHWARTZ: Douleur → Amplification → Solution → Preuve → Action

FORMAT MARKDOWN UNIQUEMENT (pas de HTML):
## Titre section
### Sous-section (si besoin)
- élément de liste
> conseil important ou information clé
Paragraphes séparés par UNE ligne vide

JAMAIS de balises HTML, JAMAIS de <div>, JAMAIS de <p>

CATÉGORIES: Hong Kong | Fiscalité | Création société | E-commerce | Import-Export | Finance | Expatriation | Business Chine | Mindset | Outils | Actualité

RÉPONDS UNIQUEMENT EN JSON VALIDE sur une seule ligne (escape les sauts de ligne avec \\n):
{"title":"...","deck":"résumé 150 chars","slug":"url-seo-tirets","category":"catégorie","tags":["tag1","tag2","tag3"],"meta_title":"titre SEO 55-60 chars","meta_description":"description 150-155 chars avec CTA","content":"accroche\\n\\n## Section 1\\n\\nparagraphe...\\n\\n## Section 2\\n\\nparagraphe...","tools":["outil1"],"seo_score":0,"copy_score":0,"engagement_score":0,"seo_recommendations":"3 points précis"}`,
      3000
    );

    // 4. Parser le JSON
    const clean = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const article = JSON.parse(clean);

    // 5. Nettoyer le markdown
    let content: string = article.content || "";
    content = content.replace(/^(#{2,3})([^ \n])/gm, "$1 $2");
    content = content.replace(/([^\n])\n(#{2,3} )/g, "$1\n\n$2");
    content = content.replace(/(#{2,3} [^\n]+)\n([^\n#\->-])/g, "$1\n\n$2");

    // 6. Images Unsplash en parallèle
    const keyword1 = (article.tags?.[0] || topic || "business").substring(0, 30);
    const keyword2 = (article.category || "entrepreneur").substring(0, 30);
    const [imgCover, imgMid] = await Promise.all([
      fetchImage(keyword1),
      fetchImage(keyword2 + " business")
    ]);

    // 7. Assembler le contenu final
    const paragraphs = content.split("\n\n").filter((p: string) => p.trim());
    const mid = Math.floor(paragraphs.length / 2);
    const ctaBlock = getCTAs(article.category);

    const parts: string[] = [];
    if (imgCover) parts.push(`[IMAGE:${imgCover}|${article.title}]`);
    parts.push(...paragraphs.slice(0, mid));
    if (imgMid) parts.push(`[IMAGE:${imgMid}|${article.category} — Start Business World]`);
    parts.push(ctaBlock);
    parts.push(...paragraphs.slice(mid));
    parts.push("");
    parts.push(CLUB_BLOCK);

    const contentFinal = parts.join("\n\n");

    // 8. Publier dans Supabase
    const { data, error } = await sb.from("articles").insert({
      title: article.title,
      deck: article.deck,
      slug: article.slug || article.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      category: article.category,
      tags: article.tags || [],
      content: contentFinal,
      meta_title: article.meta_title || article.title,
      meta_description: article.meta_description || article.deck,
      tools: article.tools || [],
      status: "published",
      generated_by_ai: true,
      seo_score: article.seo_score || 0,
      copy_score: article.copy_score || 0,
      engagement_score: article.engagement_score || 0,
      seo_recommendations: article.seo_recommendations || "",
      views: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).select().single();

    if (error) throw new Error("Supabase error: " + error.message);

    return new Response(
      JSON.stringify({ success: true, article: data, topic }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("generate-article error:", String(err));
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
