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
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── PEXELS — VRAIES PHOTOS ─────────────────────────────────────────────────
const PEXELS_KEY = "PJHsWYbRdhFUIGqzplsRV4m7xAGmGMbRiLcTiDfClEdD1leyqx9rFy5r";

async function searchPhoto(query: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape&size=medium`,
      { headers: { Authorization: PEXELS_KEY }, signal: AbortSignal.timeout(6000) }
    );
    const data = await res.json();
    if (data.photos?.length > 0) {
      const idx = Math.floor(Math.random() * Math.min(3, data.photos.length));
      return data.photos[idx].src.large;
    }
    return null;
  } catch { return null; }
}

// Termes de recherche photo par catégorie (en anglais, spécifiques)
const CAT_PHOTO_QUERIES: Record<string, string[]> = {
  "Création de société": ["business registration office", "entrepreneur signing documents", "startup team meeting"],
  "Business Chine": ["china trade shipping containers", "chinese factory manufacturing", "canton fair exhibition"],
  "Fiscalité": ["tax documents calculator", "accountant working laptop", "financial planning office"],
  "Outils": ["laptop productivity tools", "digital workspace setup", "software dashboard screen"],
  "E-commerce": ["online shopping packages", "ecommerce warehouse shipping", "shopify store laptop"],
  "Expatriation": ["passport travel abroad", "digital nomad working cafe", "expat city skyline"],
  "Finance": ["business finance charts", "bank transfer international", "money investment growth"],
  "Import-Export": ["cargo ship port containers", "customs clearance documents", "freight logistics warehouse"],
  "Mindset": ["entrepreneur motivation success", "morning routine productive", "focus determination work"],
  "Actualité": ["business news newspaper", "stock market trading", "economy global trends"],
};

// ─── COVER SVG GENERATOR ─────────────────────────────────────────────────────
const CAT_EMOJI: Record<string, string> = {
  "Création de société": "🏢",
  "Business Chine": "🇨🇳",
  "Fiscalité": "🏛️",
  "Outils": "🛠️",
  "E-commerce": "📦",
  "Expatriation": "✈️",
  "Finance": "💰",
  "Import-Export": "🔗",
  "Mindset": "🧠",
  "Actualité": "📰",
};

const CAT_COLORS: Record<string, string> = {
  "Création de société": "#4A7FD4",
  "Business Chine": "#D4534A",
  "Fiscalité": "#A67C3A",
  "Outils": "#5B8C3E",
  "E-commerce": "#D49A4A",
  "Expatriation": "#4ABCD4",
  "Finance": "#A67C3A",
  "Import-Export": "#7A4AD4",
  "Mindset": "#D44A8C",
  "Actualité": "#4A7FD4",
};

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current && (current + " " + word).length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + " " + word : word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3); // max 3 lignes
}

function generateCoverSVG(title: string, category: string, deck: string): string {
  const emoji = CAT_EMOJI[category] || "📄";
  const accent = CAT_COLORS[category] || "#A67C3A";

  // Découper le titre en lignes (max ~22 chars par ligne pour rester dans le cadre)
  const lines = wrapText(title, 22);
  const lineCount = lines.length;

  // Adapter la taille de police
  const fontSize = lineCount >= 3 ? 58 : lineCount === 2 ? 68 : title.length > 20 ? 72 : 90;
  const lineHeight = fontSize * 1.25;

  // Position Y de départ pour centrer les lignes de titre
  const titleBlockHeight = lineCount * lineHeight;
  const titleStartY = 320 - titleBlockHeight / 2 + fontSize;

  // Tronquer le deck
  const shortDeck = deck.length > 80 ? deck.substring(0, 77) + "..." : deck;
  const deckY = titleStartY + (lineCount - 1) * lineHeight + 70;

  const titleLines = lines.map((line, i) => {
    const color = i === lineCount - 1 && lineCount > 1 ? accent : "white";
    const y = titleStartY + i * lineHeight;
    return `<text x="700" y="${y}" text-anchor="middle" font-family="Georgia, serif" font-size="${fontSize}" font-weight="700" fill="${color}">${escXml(line)}</text>`;
  }).join("\n  ");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 788" width="1400" height="788">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#0e1630"/>
      <stop offset="100%" stop-color="#080c18"/>
    </radialGradient>
  </defs>
  <rect width="1400" height="788" fill="url(#bg)"/>
  <rect width="1400" height="788" fill="black" opacity="0.2"/>
  <text x="700" y="80" text-anchor="middle" font-family="sans-serif" font-size="18" font-weight="400" letter-spacing="10" fill="rgba(255,255,255,0.45)">START BUSINESS WORLD</text>
  <text x="700" y="160" text-anchor="middle" font-size="60">${emoji}</text>
  ${titleLines}
  <text x="700" y="${Math.min(deckY, 680)}" text-anchor="middle" font-family="sans-serif" font-size="22" font-weight="300" fill="rgba(255,255,255,0.45)">${escXml(shortDeck)}</text>
  <rect x="650" y="${Math.min(deckY + 30, 720)}" width="100" height="3" rx="1.5" fill="${accent}" opacity="0.6"/>
</svg>`;

  return svg;
}

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
  club:      "https://www.startbusinessworld.com/client-login.html",
};

// ─── CTA FORMAT [OUTIL:Nom|Description|URL|LogoURL] ─────────────────────────
const LOGOS: Record<string, string> = {
  luminos:   "https://luminoscorp.com/favicon.ico",
  airwallex: "https://www.airwallex.com/favicon.ico",
  legalplace:"https://www.legalplace.fr/favicon.ico",
  shopify:   "https://cdn.shopify.com/shopifycloud/web/assets/v1/favicon-default.ico",
  wix:       "https://www.wix.com/favicon.ico",
  wise:      "https://wise.com/favicon.ico",
  xtransfer: "https://www.xtransfer.cn/favicon.ico",
  pingpong:  "https://www.pingpongx.com/favicon.ico",
  airalo:    "https://www.airalo.com/favicon.ico",
  capcut:    "https://www.capcut.com/favicon.ico",
  udemy:     "https://www.udemy.com/staticx/udemy/images/v7/favicon.ico",
  kiwi:      "https://www.kiwi.com/favicon.ico",
  club:      "https://startbusinessworld-ship-it.github.io/StartBusinessWorld/favicon.svg",
};

const CTA: Record<string, string> = {
  luminos:   `[OUTIL:Luminos Corp — Société Hong Kong|Création en 7 jours, 100% en ligne|${LINKS.luminos}|${LOGOS.luminos}]`,
  airwallex: `[OUTIL:Airwallex — Compte multi-devises|Compatible Stripe, PayPal, zéro frais cachés|${LINKS.airwallex}|${LOGOS.airwallex}]`,
  legalplace:`[OUTIL:LegalPlace — Créer sa société|SASU EURL SAS. Code SBW15 pour -15%|${LINKS.legalplace}|${LOGOS.legalplace}]`,
  shopify:   `[OUTIL:Shopify — Boutique e-commerce|Plateforme n°1. Essai gratuit 3 mois|${LINKS.shopify}|${LOGOS.shopify}]`,
  wix:       `[OUTIL:Wix — Site professionnel no-code|Simple, rapide, efficace|${LINKS.wix}|${LOGOS.wix}]`,
  wise:      `[OUTIL:Wise Business — Virements internationaux|Frais bas, multi-devises, transparent|${LINKS.wise}|${LOGOS.wise}]`,
  xtransfer: `[OUTIL:XTransfer — Paiements Chine|La référence pour payer tes fournisseurs chinois|${LINKS.xtransfer}|${LOGOS.xtransfer}]`,
  pingpong:  `[OUTIL:PingPong — Encaisser à l'international|Idéal Amazon FBA et ventes en ligne|${LINKS.pingpong}|${LOGOS.pingpong}]`,
  airalo:    `[OUTIL:Airalo — eSIM de voyage|Reste connecté partout dans le monde|${LINKS.airalo}|${LOGOS.airalo}]`,
  capcut:    `[OUTIL:CapCut — Montage vidéo|Reels, Shorts, TikTok — simple et pro|${LINKS.capcut}|${LOGOS.capcut}]`,
  udemy:     `[OUTIL:Udemy — Formations en ligne|Des milliers de cours pour monter en compétences|${LINKS.udemy}|${LOGOS.udemy}]`,
  kiwi:      `[OUTIL:Kiwi.com — Vols pas chers|Les meilleurs prix pour voyager partout|${LINKS.kiwi}|${LOGOS.kiwi}]`,
  club:      `[OUTIL:Club Start Business World|Formations + outils + communauté d'entrepreneurs|${LINKS.club}|${LOGOS.club}]`,
};

const CLUB_BLOCK = `> T'as aimé cet article ? Dans le Club SBW tu vas encore plus loin — formations complètes, outils exclusifs, et une communauté d'entrepreneurs qui bougent vraiment.

${CTA.club}`;

// ─── CTA PAR CATÉGORIE (Luminos toujours présent) ───────────────────────────
function getCTAs(cat: string): string {
  const map: Record<string, string[]> = {
    "Création de société": [CTA.luminos, CTA.legalplace, CTA.airwallex],
    "Business Chine":      [CTA.luminos, CTA.xtransfer, CTA.airwallex],
    "Fiscalité":           [CTA.luminos, CTA.legalplace],
    "Outils":              [CTA.luminos, CTA.capcut, CTA.shopify],
    "E-commerce":          [CTA.luminos, CTA.shopify, CTA.airwallex],
    "Expatriation":        [CTA.luminos, CTA.airwallex, CTA.airalo],
    "Finance":             [CTA.luminos, CTA.airwallex, CTA.wise],
    "Import-Export":       [CTA.luminos, CTA.xtransfer, CTA.airwallex],
    "Mindset":             [CTA.luminos, CTA.capcut, CTA.udemy],
    "Actualité":           [CTA.luminos, CTA.airwallex, CTA.legalplace],
  };
  return (map[cat] || [CTA.luminos, CTA.legalplace]).join("\n\n");
}

// ─── ORDRE SÉQUENTIEL DES CATÉGORIES ────────────────────────────────────────
const CATEGORY_ORDER = [
  "Création de société",
  "Business Chine",
  "Fiscalité",
  "Outils",
  "E-commerce",
  "Expatriation",
  "Finance",
  "Import-Export",
  "Mindset",
  "Actualité",
];

// ─── SOURCES WEB ─────────────────────────────────────────────────────────────
async function fetchSourceContent(topic: string, category?: string): Promise<string> {
  const sites = [
    { name: "Le Coin des Entrepreneurs", url: `https://www.lecoindesentrepreneurs.fr/?s=${encodeURIComponent(topic)}` },
    { name: "Shopify Blog FR", url: `https://www.shopify.com/fr/blog/search?q=${encodeURIComponent(topic)}` },
  ];

  // Sources spécifiques par catégorie
  if (category === "Actualité") {
    sites.unshift(
      { name: "BFM Business", url: `https://www.bfmtv.com/economie/` },
      { name: "BFM Entreprises", url: `https://www.bfmtv.com/economie/entreprises/` },
    );
  } else if (category === "Création de société") {
    sites.unshift(
      { name: "Service Public Entreprendre", url: `https://entreprendre.service-public.fr/vosdroits/N16178` },
      { name: "Le Coin des Entrepreneurs — Création", url: `https://www.lecoindesentrepreneurs.fr/?s=${encodeURIComponent(topic)}` },
      { name: "Luminos Corp", url: `https://www.luminoscorp.com/` },
    );
  } else if (category === "Fiscalité") {
    sites.unshift(
      { name: "Service Public Fiscalité", url: `https://entreprendre.service-public.fr/vosdroits/N13442` },
      { name: "Le Coin des Entrepreneurs — Fiscalité", url: `https://www.lecoindesentrepreneurs.fr/?s=${encodeURIComponent(topic)}` },
      { name: "Luminos Corp", url: `https://www.luminoscorp.com/` },
    );
  }

  try {
    const results = await Promise.allSettled(
      sites.map(site =>
        fetch(site.url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SBWBot/1.0)" },
          redirect: "follow",
          signal: AbortSignal.timeout(8000),
        }).then(async (res) => {
          if (!res.ok) return "";
          const html = await res.text();
          const text = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/&[a-z]+;/gi, " ")
            .replace(/\s+/g, " ")
            .trim();
          return `[Source: ${site.name}]\n${text.substring(0, 2000)}`;
        })
      )
    );

    return results
      .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled" && r.value.length > 100)
      .map(r => r.value)
      .join("\n\n---\n\n")
      .substring(0, 4000);
  } catch (e) {
    console.log("Erreur fetch sources:", e);
    return "";
  }
}

// ─── HISTORIQUE DES DERNIERS ARTICLES ────────────────────────────────────────
async function getRecentArticles(): Promise<{ scores: string; categories: string[]; titles: string[] }> {
  try {
    const { data } = await sb.from("articles")
      .select("title,category,seo_score,copy_score,engagement_score,seo_recommendations")
      .eq("generated_by_ai", true)
      .order("created_at", { ascending: false })
      .limit(15);
    if (!data || data.length === 0) return { scores: "Premier article.", categories: [], titles: [] };
    const scores = data.slice(0, 5).map((a, i) =>
      `#${i+1} "${a.title}" SEO:${a.seo_score} Copy:${a.copy_score} Eng:${a.engagement_score} — Améliorer: ${a.seo_recommendations || "rien"}`
    ).join(" || ");
    const categories = data.map(a => a.category).filter(Boolean);
    const titles = data.map(a => a.title).filter(Boolean);
    return { scores, categories, titles };
  } catch { return { scores: "Pas d'historique.", categories: [], titles: [] }; }
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

    const { scores: lastScores, categories: recentCats, titles: recentTitles } = await getRecentArticles();

    // Sujet varié si pas de sujet manuel
    let topic = manualTopic;
    let chosenCat = "";
    if (!topic) {
      const date = new Date().toLocaleDateString("fr-FR");
      const allThemes: Record<string, string[]> = {
        "Création de société":["SASU vs EURL choix statut 2026", "créer société en ligne étapes concrètes", "capital social minimum comment choisir", "auto-entrepreneur ou société avantages"],
        "Business Chine":    ["foire de Canton guide pratique", "sourcing Chine qualité contrôle", "importer de Chine étapes fournisseurs", "négocier fournisseurs Alibaba astuces"],
        "Fiscalité":         ["optimisation fiscale légale holding France", "réforme fiscale 2026 impact entrepreneur", "TVA intracommunautaire e-commerce", "impôts micro-entreprise simulation"],
        "Outils":            ["meilleurs outils IA entrepreneur 2026", "automatiser son business no-code", "CapCut montage vidéo réseaux sociaux", "outils gratuits lancer business"],
        "E-commerce":        ["Amazon FBA lancer en 2026 stratégie", "Shopify créer boutique guide débutant", "dropshipping opportunité 2026", "vendre en ligne sans stock"],
        "Expatriation":      ["s'expatrier à Dubaï entrepreneur guide", "résidence fiscale Portugal NHR 2026", "digital nomad visa pays comparatif", "vivre à Bali entrepreneur"],
        "Finance":           ["trésorerie entrepreneur gestion cash flow", "paiements internationaux comparatif", "ouvrir compte pro en ligne", "investir premiers revenus entrepreneur"],
        "Import-Export":     ["logistique maritime container prix 2026", "payer fournisseurs chinois méthodes sûres", "douane import France procédure", "trouver fournisseur fiable étranger"],
        "Mindset":           ["routine entrepreneur productivité", "syndrome imposteur surmonter entrepreneur", "habitudes succès entrepreneurs", "gérer le stress quand on entreprend"],
        "Actualité":         ["tendances business 2026 opportunités", "nouvelles lois entrepreneur France 2026", "success story entrepreneur francophone", "IA impact business 2026 opportunités"],
      };

      // Rotation séquentielle : prendre la catégorie suivante dans l'ordre
      const lastCat = recentCats.length > 0 ? recentCats[0] : null;
      const lastIdx = lastCat ? CATEGORY_ORDER.indexOf(lastCat) : -1;
      const nextIdx = (lastIdx + 1) % CATEGORY_ORDER.length;
      chosenCat = CATEGORY_ORDER[nextIdx];
      const catThemes = allThemes[chosenCat] || ["business entrepreneur"];
      const chosenTheme = catThemes[Math.floor(Math.random() * catThemes.length)];

      const titlesStr = recentTitles.length > 0
        ? `\n\nATTENTION — ces articles EXISTENT DÉJÀ, ne répète AUCUN de ces sujets:\n${recentTitles.map(t => `- "${t}"`).join("\n")}`
        : "";

      topic = await callClaude(
        [{ role: "user", content: `Date: ${date}. Catégorie imposée: "${chosenCat}". Angle: "${chosenTheme}".\n\nPropose UN sujet d'article ORIGINAL et CONCRET pour Start Business World. Le sujet doit être DIFFÉRENT de tout ce qui a déjà été publié.${titlesStr}\n\nRéponds UNIQUEMENT avec le titre du sujet, rien d'autre.` }],
        "Tu es rédacteur en chef de Start Business World. Tu proposes des sujets originaux, jamais répétitifs, toujours concrets et utiles pour des entrepreneurs francophones. Tu dois OBLIGATOIREMENT respecter la catégorie imposée.",
        120
      );
    }

    // Récupérer du contenu source pour enrichir l'article
    const sourceContent = await fetchSourceContent(topic, chosenCat);
    const actuNote = chosenCat === "Actualité"
      ? "\n\nCATÉGORIE ACTUALITÉ: Les sources ci-dessous viennent de BFM Business. Choisis une actualité économique récente et pertinente pour les entrepreneurs, puis rédige un article qui explique simplement cette actu et son impact concret pour quelqu'un qui lance son business. N'oublie pas de mentionner Hong Kong comme opportunité."
      : "";
    const sourceContext = sourceContent
      ? `\n\nINFORMATIONS SOURCES (utilise ces données factuelles pour enrichir l'article, reformule avec tes propres mots):${actuNote}\n${sourceContent}`
      : "";

    // Générer l'article
    const raw = await callClaude(
      [{ role: "user", content: `Sujet: "${topic}"\n\nScores précédents — fais MIEUX:\n${lastScores}${sourceContext}` }],
      `Tu es rédacteur pour Start Business World (SBW). Tu écris pour des gens qui se lancent dans le business — souvent sans diplôme ni formation. Ton but: qu'ils comprennent TOUT du premier coup.

INSPIRATION (adapte ce style):
- entreprendre.service-public.fr : démarches expliquées simplement, étape par étape
- lecoindesentrepreneurs.fr : jargon toujours expliqué en langage simple juste après
- shopify.com/blog : guides pratiques orientés action, bénéfice d'abord
- business.amazon.com : résultats concrets, témoignages, chiffres réels

TON OBLIGATOIRE:
- Parle comme un grand frère qui s'y connaît. Direct, simple, bienveillant et OPTIMISTE.
- Phrases courtes. Pas de mots compliqués. Si tu utilises un terme technique, explique-le tout de suite entre parenthèses.
- Tu dis "t'as", "c'est pas compliqué", "en gros", "concrètement", "du coup".
- Pas de langage corporate. Pas de "il convient de", "force est de constater", "en définitive".
- Donne des exemples concrets de la vraie vie (avec des chiffres quand c'est possible).
- Le lecteur doit se dire "ah ok c'est simple en fait" et "c'est possible pour moi" après chaque paragraphe.
- TOUJOURS encourageant et positif. Montre que c'est faisable, que d'autres y arrivent, que le lecteur peut le faire aussi.

ÉTAT D'ESPRIT OBLIGATOIRE:
- NE FAIS JAMAIS PEUR au lecteur. Pas de ton alarmiste, pas de "attention danger", pas de "si tu fais pas ça tu vas échouer".
- Présente les obstacles comme des étapes normales, pas des murs. "C'est un passage obligé mais rien de compliqué."
- Quand tu parles de risques ou d'erreurs, enchaîne immédiatement avec la solution simple.
- Donne envie d'entreprendre. Le lecteur doit finir l'article motivé, pas stressé.
- Utilise des formulations positives : "Tu peux" au lieu de "Tu dois", "C'est accessible" au lieu de "C'est pas si dur".

HONG KONG — TOUJOURS MENTIONNER:
- Quel que soit le sujet, mentionne Hong Kong comme option intéressante pour les entrepreneurs (fiscalité territoriale, création rapide, accès au marché asiatique).
- Intègre-le naturellement dans l'article : un paragraphe, un callout, ou une comparaison.
- Par exemple : si tu parles de créer une société → mentionne que Hong Kong est une alternative sérieuse. Si tu parles de fiscalité → compare avec le système territorial de HK. Si tu parles d'e-commerce → mentionne que HK permet de vendre en Asie facilement.
- Ne force pas si le sujet est vraiment éloigné (mindset pur), mais glisse au moins une phrase sur HK comme opportunité.

STRUCTURE OBLIGATOIRE:
- 2-3 phrases d'accroche SANS titre (commence par une opportunité concrète ou une bonne nouvelle pour l'entrepreneur)
- 4 à 5 sections ## bien espacées avec des titres clairs et simples
- Des listes - pour les étapes et points clés
- Des callouts > pour les conseils importants (formulés comme un conseil d'ami)
- Données chiffrées récentes (2026)
- 900-1100 mots
- Termine par un appel à l'action naturel et encourageant

INTERDICTIONS ABSOLUES:
- JAMAIS de hashtags (#entrepreneur, #business, #ecommerce, etc.) — NI dans le titre, NI dans le contenu, NI à la fin
- JAMAIS de titre avec un seul # (utilise ## pour les sections et ### pour les sous-sections)
- JAMAIS de emojis dans le texte
- JAMAIS de HTML, uniquement du Markdown
- JAMAIS de phrases creuses ou de remplissage
- JAMAIS de ton condescendant ou professoral
- JAMAIS de ton alarmiste ou anxiogène
- JAMAIS de "tu risques de", "attention", "méfie-toi", "c'est compliqué"

FORMAT MARKDOWN STRICT:
## Titre section
### Sous-section
- élément liste
> conseil d'ami
Paragraphes séparés par ligne vide

CATÉGORIES (utilise EXACTEMENT un de ces noms, sans emoji):
Création de société | Business Chine | Fiscalité | Outils | E-commerce | Expatriation | Finance | Import-Export | Mindset | Actualité

RÉPONDS UNIQUEMENT EN JSON VALIDE (sauts de ligne = \\n):
{"title":"Titre accrocheur et simple","deck":"Résumé 150 chars en langage simple","slug":"url-en-tirets","category":"catégorie","tags":["tag1","tag2","tag3"],"meta_title":"Meta 55-60 chars","meta_description":"Meta 150-155 chars","content":"accroche\\n\\n## Titre\\n\\ncontenu...","tools":["outil1"],"seo_score":85,"copy_score":80,"engagement_score":78,"seo_recommendations":"3 points précis pour le prochain article"}`,
      3000
    );

    const clean = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const article = JSON.parse(clean);

    // Fonction pour supprimer les hashtags partout
    function stripHashtags(str: string): string {
      return str
        .replace(/\s*#[A-Za-zÀ-ÿ0-9]\S*/g, "")  // #mot (avec accents, chiffres)
        .replace(/^#+\s*/gm, (m, offset) => {      // ## markdown headers → garder seulement dans content
          return m;
        })
        .trim();
    }

    // Nettoyer le titre (enlever # markdown, hashtags, guillemets, **)
    article.title = (article.title || "")
      .replace(/^#+\s*/, "")
      .replace(/\*\*/g, "")
      .replace(/\s*#[A-Za-zÀ-ÿ0-9]\S*/g, "")
      .replace(/^["'«»]+|["'«»]+$/g, "")
      .trim();

    // Nettoyer le deck aussi
    article.deck = (article.deck || "")
      .replace(/\s*#[A-Za-zÀ-ÿ0-9]\S*/g, "")
      .replace(/\*\*/g, "")
      .trim();

    // Nettoyer markdown du contenu
    let content: string = article.content || "";

    // Normaliser les sauts de ligne (\\n littéral → vrai \n)
    content = content.replace(/\\n/g, "\n");

    // Traiter ligne par ligne pour un nettoyage fiable
    const cleanLines: string[] = [];
    for (const line of content.split("\n")) {
      let l = line;
      // Convertir # Titre (h1) en ## Titre
      if (/^# [^#]/.test(l.trim())) {
        l = "#" + l.trim();
      }
      // Supprimer les lignes qui ne sont que des hashtags (#entrepreneur #business)
      if (/^(#[A-Za-zÀ-ÿ0-9]\S*[\s,]*)+$/.test(l.trim()) && !/^#{2,3} /.test(l.trim())) {
        continue; // skip cette ligne
      }
      // Supprimer les hashtags en fin/milieu de ligne
      l = l.replace(/ #[A-Za-zÀ-ÿ0-9]\S*/g, "");
      // Supprimer les hashtags en début de ligne qui ne sont pas des headers markdown
      l = l.replace(/^#([^# \n])/gm, "$1");
      cleanLines.push(l);
    }
    content = cleanLines.join("\n");

    // Fixer le formatage markdown
    content = content.replace(/^(#{2,3})([^ \n])/gm, "$1 $2");
    content = content.replace(/([^\n])\n(#{2,3} )/g, "$1\n\n$2");
    content = content.replace(/(#{2,3} [^\n]+)\n([^\n#>-])/g, "$1\n\n$2");

    // Générer cover SVG
    const coverSVG = generateCoverSVG(article.title, article.category, article.deck || "");
    const coverDataUri = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(coverSVG)));

    // Chercher 2 photos Pexels pertinentes pour la catégorie
    const photoQueries = CAT_PHOTO_QUERIES[article.category] || ["business entrepreneur professional"];
    const q1 = photoQueries[Math.floor(Math.random() * photoQueries.length)];
    const q2 = photoQueries[Math.floor(Math.random() * photoQueries.length)];
    const [photo1, photo2] = await Promise.all([searchPhoto(q1), searchPhoto(q2)]);

    // Assembler contenu final avec photos réparties
    const paragraphs = content.split("\n\n").filter((p: string) => p.trim());
    const ctaBlock = getCTAs(article.category);
    const totalP = paragraphs.length;
    const photo1Pos = Math.floor(totalP * 0.3);
    const ctaPos = Math.floor(totalP * 0.55);
    const photo2Pos = Math.floor(totalP * 0.75);

    const parts: string[] = [];
    parts.push(`[IMAGE:${coverDataUri}|${article.title}]`);

    for (let i = 0; i < totalP; i++) {
      parts.push(paragraphs[i]);
      if (i === photo1Pos && photo1) {
        parts.push(`[IMAGE:${photo1}|${article.category}]`);
      }
      if (i === ctaPos) {
        parts.push(ctaBlock);
      }
      if (i === photo2Pos && photo2) {
        parts.push(`[IMAGE:${photo2}|${article.title}]`);
      }
    }
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
