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

// ─── CTA par catégorie ───────────────────────────────────────────────────────
const CTA_MAP: Record<string, string> = {
  "Hong Kong": `
<div class="article-cta cta-hk">
  <div class="cta-label">Partenaire recommandé</div>
  <h3>Créer ta société à Hong Kong</h3>
  <p>Luminos Corp accompagne les entrepreneurs francophones dans la création et la gestion de sociétés à Hong Kong. Création en 7 jours, 100% en ligne.</p>
  <a href="https://www.startbusinessworld.com/hong-kong" class="cta-btn">Démarrer ma création →</a>
</div>
<div class="article-cta cta-airwallex">
  <div class="cta-label">Banking recommandé</div>
  <h3>Ouvre ton compte Airwallex</h3>
  <p>La meilleure solution bancaire pour ta société Hong Kong — multi-devises, Stripe compatible, zéro frais cachés.</p>
  <a href="https://www.airwallex.com/fr" class="cta-btn">Ouvrir mon compte →</a>
</div>`,
  "Création société": `
<div class="article-cta cta-legalplace">
  <div class="cta-label">Partenaire recommandé</div>
  <h3>Créer ta société avec LegalPlace</h3>
  <p>Création de SASU, EURL ou SAS en ligne — rapide, simple, garanti sans rejet du greffe.</p>
  <a href="https://www.legalplace.fr" class="cta-btn">Utiliser le code SBW15 (-15%) →</a>
</div>`,
  "E-commerce": `
<div class="article-cta cta-shopify">
  <div class="cta-label">Outil recommandé</div>
  <h3>Lance ta boutique Shopify</h3>
  <p>La plateforme e-commerce la plus utilisée au monde. Essai gratuit 3 mois avec notre lien affilié.</p>
  <a href="https://shopify.pxf.io/gOP9jv" class="cta-btn">Essayer Shopify gratuitement →</a>
</div>`,
  "Finance": `
<div class="article-cta cta-airwallex">
  <div class="cta-label">Outil recommandé</div>
  <h3>Gère tes finances avec Airwallex</h3>
  <p>Multi-devises, cartes équipe, virements internationaux à frais réduits. La solution des entrepreneurs globaux.</p>
  <a href="https://www.airwallex.com/fr" class="cta-btn">Découvrir Airwallex →</a>
</div>`,
  "Import-Export": `
<div class="article-cta cta-hk">
  <div class="cta-label">Structurer ton activité</div>
  <h3>Société Hong Kong pour l'import-export</h3>
  <p>Une structure à Hong Kong te donne un accès privilégié aux fournisseurs asiatiques et une fiscalité optimisée sur tes marges.</p>
  <a href="https://www.startbusinessworld.com/hong-kong" class="cta-btn">En savoir plus →</a>
</div>`,
};

const CTA_CLUB = `
<div class="article-cta cta-club">
  <div class="cta-label">Rejoins la communauté</div>
  <h3>Club Start Business World</h3>
  <p>Formations complètes, outils exclusifs, communauté d'entrepreneurs et accompagnement — tout ce qu'il te faut pour lancer et scaler ton business international.</p>
  <a href="https://www.startbusinessworld.com/club" class="cta-btn cta-btn-gold">Rejoindre le Club SBW →</a>
</div>`;

// ─── Récupérer les scores des derniers articles ───────────────────────────────
async function getLastArticlesScores(): Promise<string> {
  const { data } = await sb
    .from("articles")
    .select("title, seo_score, copy_score, engagement_score, seo_recommendations")
    .eq("generated_by_ai", true)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!data || data.length === 0) return "Aucun article précédent. C'est le premier.";

  return data.map((a, i) =>
    `Article ${i + 1}: "${a.title}" — SEO: ${a.seo_score}/100, Copy: ${a.copy_score}/100, Engagement: ${a.engagement_score}/100. Points à améliorer: ${a.seo_recommendations || "aucun"}`
  ).join("\n");
}

// ─── Générer un sujet si non fourni ──────────────────────────────────────────
async function generateTopic(): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `Tu es le rédacteur en chef de Start Business World (SBW), un média francophone sur l'entrepreneuriat international.

Propose UN sujet d'article de blog pertinent pour aujourd'hui (${new Date().toLocaleDateString("fr-FR")}) parmi ces thématiques : Hong Kong, fiscalité internationale, création de société, e-commerce, import-export depuis la Chine, expatriation, finance d'entrepreneur, mindset.

Critères :
- Sujet concret, actionnable, recherché sur Google en 2026
- Angle original — pas un sujet déjà 100 fois traité
- Pertinent pour un entrepreneur francophone

Réponds UNIQUEMENT avec le sujet, sans explication. Ex: "Comment ouvrir un compte bancaire pro à Hong Kong depuis la France en 2026"`
      }]
    })
  });
  const data = await res.json();
  return data.content[0].text.trim();
}

// ─── Générer l'article complet ────────────────────────────────────────────────
async function generateArticleContent(topic: string, lastScores: string): Promise<{
  title: string; deck: string; slug: string; category: string; tags: string[];
  content: string; meta_title: string; meta_description: string;
  seo_score: number; copy_score: number; engagement_score: number;
  seo_recommendations: string; tools: string[];
}> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: `Tu es le meilleur rédacteur de contenu web francophone. Tu maîtrises le copywriting comme Eugène Schwartz — tu accroches, tu maintiens l'attention, tu pousses à l'action. Tu écris pour Start Business World (SBW), un média d'entrepreneuriat international pour francophones.

SCORES DES DERNIERS ARTICLES (apprends-en et fais mieux) :
${lastScores}

RÈGLES ABSOLUES :
1. TON : Direct, sans bullshit, entre entrepreneurs. Phrases courtes. Impact immédiat. Données chiffrées avec l'année 2026.
2. STRUCTURE : Accroche sans titre (2-3 phrases qui accrochent), minimum 4 sections ##, callouts > pour les conseils clés, conclusion avec appel à l'action.
3. SEO : Mot-clé principal dans le titre H1, dans les 100 premiers mots, dans 2-3 sous-titres H2, densité 1-2%.
4. COPYWRITING EUGÈNE SCHWARTZ : Commence par la douleur ou le désir du lecteur. Amplifie. Présente la solution. Preuve. Action.
5. LONGUEUR : 1000-1500 mots.
6. PRÉCISIONS FACTUELLES : Hong Kong = fiscalité territoriale, 0% sur revenus étrangers, 8.25%/16.5% local. Société HK ≠ résidence fiscale. Exportateur ≠ usine.

RÉPONDS UNIQUEMENT EN JSON VALIDE (pas de markdown autour) :
{
  "title": "titre SEO optimisé",
  "deck": "résumé 150 chars max pour Google",
  "slug": "url-optimisee-seo",
  "category": "une seule parmi: Hong Kong|Fiscalité|Création société|E-commerce|Import-Export|Expatriation|Finance|Mindset|Business Chine",
  "tags": ["tag1", "tag2", "tag3"],
  "meta_title": "Meta titre 60 chars max",
  "meta_description": "Meta description 155 chars max avec mot-clé",
  "content": "HTML complet de l'article avec h2, h3, p, ul, blockquote pour les callouts",
  "tools": ["outil mentionné parmi: Airwallex|Wise|LegalPlace|Shopify|Amazon FBA"],
  "seo_score": 0,
  "copy_score": 0,
  "engagement_score": 0,
  "seo_recommendations": "ce qui pourrait être amélioré SEO"
}`,
      messages: [{
        role: "user",
        content: `Rédige un article complet sur : "${topic}"\n\nNote toi-même honnêtement après rédaction (SEO /100, Copy /100, Engagement /100) et donne des recommandations pour faire mieux au prochain article.`
      }]
    })
  });

  const data = await res.json();
  const text = data.content[0].text.trim();
  const clean = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(clean);
}

// ─── Injecter les CTA dans le contenu HTML ───────────────────────────────────
function injectCTAs(content: string, category: string, tools: string[]): string {
  const ctaCategory = CTA_MAP[category] || "";

  // Insérer CTA catégorie au 2/3 de l'article
  const paragraphs = content.split("</p>");
  const insertAt = Math.floor(paragraphs.length * 0.65);
  if (insertAt > 0 && ctaCategory) {
    paragraphs.splice(insertAt, 0, ctaCategory);
  }
  let result = paragraphs.join("</p>");

  // CTA Club toujours en fin
  result += CTA_CLUB;

  return result;
}

// ─── Handler principal ────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json() : {};
    const manualTopic: string | null = body.topic || null;

    // 1. Récupérer les scores passés
    const lastScores = await getLastArticlesScores();

    // 2. Sujet : manuel ou auto-généré
    const topic = manualTopic || await generateTopic();

    // 3. Générer l'article
    const article = await generateArticleContent(topic, lastScores);

    // 4. Injecter les CTA
    const contentWithCTA = injectCTAs(article.content, article.category, article.tools);

    // 5. Insérer dans Supabase
    const { data, error } = await sb.from("articles").insert({
      title: article.title,
      deck: article.deck,
      slug: article.slug,
      category: article.category,
      tags: article.tags,
      content: contentWithCTA,
      meta_title: article.meta_title,
      meta_description: article.meta_description,
      tools: article.tools,
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

    return new Response(JSON.stringify({ success: true, article: data, topic }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
