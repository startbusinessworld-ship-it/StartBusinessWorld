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
  luminos:   `[OUTIL:Luminos Corp — Société Hong Kong|Création en 7 jours, 100% en ligne|${LINKS.luminos}]`,
  airwallex: `[OUTIL:Airwallex — Compte multi-devises|Compatible Stripe, PayPal, zéro frais cachés|${LINKS.airwallex}]`,
  legalplace:`[OUTIL:LegalPlace — Créer sa société|SASU EURL SAS. Code SBW15 pour -15%|${LINKS.legalplace}]`,
  shopify:   `[OUTIL:Shopify — Boutique e-commerce|Plateforme n°1. Essai gratuit 3 mois|${LINKS.shopify}]`,
  wix:       `[OUTIL:Wix — Site professionnel no-code|Simple, rapide, efficace|${LINKS.wix}]`,
  wise:      `[OUTIL:Wise Business — Virements internationaux|Frais bas, multi-devises, transparent|${LINKS.wise}]`,
  xtransfer: `[OUTIL:XTransfer — Paiements Chine|La référence pour payer tes fournisseurs chinois|${LINKS.xtransfer}]`,
  pingpong:  `[OUTIL:PingPong — Encaisser à l'international|Idéal Amazon FBA et ventes en ligne|${LINKS.pingpong}]`,
  airalo:    `[OUTIL:Airalo — eSIM de voyage|Reste connecté partout dans le monde|${LINKS.airalo}]`,
  capcut:    `[OUTIL:CapCut — Montage vidéo|Reels, Shorts, TikTok — simple et pro|${LINKS.capcut}]`,
  udemy:     `[OUTIL:Udemy — Formations en ligne|Des milliers de cours pour monter en compétences|${LINKS.udemy}]`,
  kiwi:      `[OUTIL:Kiwi.com — Vols pas chers|Les meilleurs prix pour voyager partout|${LINKS.kiwi}]`,
  club:      `[OUTIL:Club Start Business World|Formations + outils + communauté d'entrepreneurs|${LINKS.club}]`,
};

const CLUB_BLOCK = `> T'as aimé cet article ? Dans le Club SBW tu vas encore plus loin — formations complètes, outils exclusifs, et une communauté d'entrepreneurs qui bougent vraiment.

${CTA.club}`;

// ─── CTA PAR CATÉGORIE ────────────────────────────────────────────────────────
function getCTAs(cat: string): string {
  const map: Record<string, string[]> = {
    "Hong Kong":        [CTA.luminos, CTA.airwallex],
    "Fiscalité":        [CTA.luminos, CTA.legalplace],
    "Création société": [CTA.legalplace, CTA.airwallex],
    "E-commerce":       [CTA.shopify, CTA.airwallex, CTA.pingpong],
    "Import-Export":    [CTA.xtransfer, CTA.airwallex, CTA.luminos],
    "Finance":          [CTA.airwallex, CTA.wise, CTA.xtransfer],
    "Expatriation":     [CTA.luminos, CTA.airwallex, CTA.airalo, CTA.kiwi],
    "Business Chine":   [CTA.xtransfer, CTA.airwallex, CTA.shopify],
    "Mindset":          [CTA.capcut, CTA.udemy],
    "Outils":           [CTA.capcut, CTA.shopify, CTA.wix],
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
    if (!data || data.length === 0) return "Premier article.";
    return data.map((a, i) =>
      `#${i+1} "${a.title}" SEO:${a.seo_score} Copy:${a.copy_score} Eng:${a.engagement_score} — Améliorer: ${a.seo_recommendations || "rien"}`
    ).join(" || ");
  } catch { return "Pas d'historique."; }
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
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: maxTokens, system, messages })
  });
  const data = await res.json();
  if (!data.content?.[0]) throw new Error("Claude API error: " + JSON.stringify(data));
  return data.content[0].text.trim();
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const manualTopic: string | null = body.topic || null;

    const lastScores = await getLastScores();

    // Sujet varié si pas de sujet manuel
    let topic = manualTopic;
    if (!topic) {
      const date = new Date().toLocaleDateString("fr-FR");
      const themes = [
        "actualité réforme entrepreneur France loi fiscale nouveauté 2026",
        "Hong Kong société offshore fiscalité territoriale avantages concrets",
        "e-commerce Amazon FBA Shopify dropshipping stratégie rentabilité",
        "import export Chine fournisseurs Alibaba containers logistique",
        "expatriation Dubaï Portugal Thaïlande résidence fiscale nomade",
        "finance entrepreneur trésorerie gestion argent investissement",
        "création société France SASU EURL SAS choix statut juridique",
        "mindset entrepreneur discipline habitudes succès développement personnel",
        "business physique franchise boutique commerce local international",
        "voyage digital nomad eSIM connexion productivité déplacement",
        "intelligence artificielle Claude ChatGPT outils IA productivité entrepreneur",
        "nouveaux outils tech tendances business automatisation 2026",
        "business Chine sourcing négociation fournisseurs qualité",
        "fiscalité optimisation légale holding dividendes structure",
        "banque néobanque Airwallex Wise paiements internationaux frais",
        "immobilier investissement étranger patrimoine international",
        "développement personnel croissance entrepreneur motivation",
        "tendances business digital 2026 opportunités marché",
        "réseaux sociaux LinkedIn TikTok Instagram stratégie entrepreneur",
        "actualité grands entrepreneurs succès leçons business",
        "nouvelles réformes sociales fiscales impact entrepreneur France",
        "startup levée de fonds investisseur business model scalable",
        "freelance indépendant revenus multiples liberté financière"
      ];
      const rand = Math.floor(Math.random() * themes.length);
      topic = await callClaude(
        [{ role: "user", content: `Date: ${date}. Thème: "${themes[rand]}". Propose UN sujet d'article ORIGINAL et CONCRET pour Start Business World. Ces sujets ont déjà été traités — évite-les absolument: ${lastScores}. Réponds UNIQUEMENT avec le titre du sujet.` }],
        "Tu es rédacteur en chef de Start Business World. Tu proposes des sujets originaux, jamais répétitifs, toujours concrets et utiles pour des entrepreneurs francophones.",
        120
      );
    }

    // Générer l'article
    const raw = await callClaude(
      [{ role: "user", content: `Sujet: "${topic}"\n\nScores précédents — fais MIEUX:\n${lastScores}` }],
      `Tu es le meilleur rédacteur web francophone pour des entrepreneurs. Tu écris pour Start Business World (SBW).

TON OBLIGATOIRE:
Parle comme un pote qui s'y connaît — direct, cash, sans blabla. Pas de langage corporatif, pas de "il convient de noter que". Comme si tu expliquais ça à un ami autour d'un café. Naturel, familier mais pro. Tu dis "t'as", "c'est", "tu vas", "ça marche", "honnêtement", "concrètement". Tu utilises des exemples de la vraie vie.

STRUCTURE OBLIGATOIRE:
- 2-3 phrases d'accroche SANS titre (commence par une douleur ou une opportunité concrète)
- 4 à 5 sections ## bien espacées
- Des listes - pour les points clés
- Des callouts > pour les conseils importants
- Données chiffrées avec l'année 2026
- 900-1100 mots
- Termine par un appel à l'action naturel

FORMAT MARKDOWN STRICT (JAMAIS de HTML):
## Titre section
### Sous-section
- élément liste
> conseil clé
Paragraphes séparés par ligne vide

AMÉLIORATION: Analyse les scores précédents et fais mieux sur SEO, copywriting et engagement.

CATÉGORIES: Hong Kong | Fiscalité | Création société | E-commerce | Import-Export | Finance | Expatriation | Business Chine | Mindset | Outils | Actualité

RÉPONDS UNIQUEMENT EN JSON VALIDE (sauts de ligne = \\n):
{"title":"Titre accrocheur SEO","deck":"Résumé 150 chars","slug":"url-tirets-seo","category":"catégorie","tags":["tag1","tag2","tag3"],"meta_title":"Meta 55-60 chars","meta_description":"Meta 150-155 chars avec CTA","content":"accroche\\n\\n## Titre\\n\\ncontenu...","tools":["outil1"],"seo_score":85,"copy_score":80,"engagement_score":78,"seo_recommendations":"3 points précis pour le prochain article"}`,
      3000
    );

    const clean = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const article = JSON.parse(clean);

    // Nettoyer markdown
    let content: string = article.content || "";
    content = content.replace(/^(#{2,3})([^ \n])/gm, "$1 $2");
    content = content.replace(/([^\n])\n(#{2,3} )/g, "$1\n\n$2");
    content = content.replace(/(#{2,3} [^\n]+)\n([^\n#>-])/g, "$1\n\n$2");

    // Images Unsplash
    const kw1 = (article.tags?.[0] || topic || "business").slice(0, 40);
    const kw2 = (article.category || "entrepreneur").slice(0, 30);
    const [imgCover, imgMid] = await Promise.all([
      fetchImage(kw1),
      fetchImage(kw2 + " business professional")
    ]);

    // Assembler contenu final
    const paragraphs = content.split("\n\n").filter((p: string) => p.trim());
    const mid = Math.floor(paragraphs.length / 2);
    const ctaBlock = getCTAs(article.category);

    const parts: string[] = [];
    if (imgCover) parts.push(`[IMAGE:${imgCover}|${article.title}]`);
    parts.push(...paragraphs.slice(0, mid));
    if (imgMid) parts.push(`[IMAGE:${imgMid}|${article.category}]`);
    parts.push(ctaBlock);
    parts.push(...paragraphs.slice(mid));
    parts.push("");
    parts.push(CLUB_BLOCK);

    const contentFinal = parts.join("\n\n");

    // Publier
    const { data, error } = await sb.from("articles").insert({
      title: article.title,
      deck: article.deck,
      slug: article.slug || article.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80),
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

    if (error) throw new Error("Supabase: " + error.message);

    return new Response(
      JSON.stringify({ success: true, article: data, topic }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Error:", String(err));
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
