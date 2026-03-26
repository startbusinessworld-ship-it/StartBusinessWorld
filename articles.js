// =============================================
// START BUSINESS WORLD — Base de données articles
// =============================================
// Pour ajouter un article :
// 1. Copie un objet existant dans le tableau
// 2. Remplis tous les champs
// 3. Sauvegarde — le site se met à jour automatiquement
// =============================================

const SBW_ARTICLES = [
  {
    id: "sourcing-chine-2026",
    titre: "Sourcer en Chine sans se faire arnaquer : le guide complet 2026",
    slug: "article-sourcing-chine.html",
    categorie: "Business Chine",
    tags: ["Import-Export", "Sourcing", "Alibaba"],
    description: "Alibaba, Yiwu, agents sourcing, contrôle qualité, incoterms — tout ce qu'il faut savoir avant de passer sa première commande import.",
    date: "15 mars 2026",
    lecture: "18 min",
    youtube_id: "REMPLACE_PAR_TON_ID",   // ex: "dQw4w9WgXcQ"
    featured: true,                        // true = article mis en avant sur la home
    outils: ["Airwallex", "Wise"],
    contenu: `
      <p>Quand j'ai passé ma première commande en Chine, j'ai failli perdre 4 000€...</p>
      <!-- Ton contenu HTML ici -->
    `
  },
  {
    id: "hong-kong-vs-france",
    titre: "Société Hong Kong vs France : comparatif honnête",
    slug: "article-hong-kong-france.html",
    categorie: "Fiscalité",
    tags: ["Création société", "Hong Kong", "Optimisation fiscale"],
    description: "Ce que personne ne te dit vraiment sur les avantages et inconvénients de créer sa société à Hong Kong plutôt qu'en France.",
    date: "10 mars 2026",
    lecture: "12 min",
    youtube_id: null,                      // null = pas de vidéo pour cet article
    featured: false,
    outils: ["LegalPlace", "Airwallex"],
    contenu: `
      <p>La question revient tout le temps dans le Club SBW : Hong Kong ou France ?...</p>
    `
  },
  {
    id: "dubai-2026",
    titre: "S'expatrier à Dubai en 2026 : visa, résidence fiscale, coût de vie réel",
    slug: "article-dubai-2026.html",
    categorie: "Expatriation",
    tags: ["Dubai", "Résidence fiscale", "Visa"],
    description: "Les vrais chiffres sur le coût de la vie à Dubai, les démarches pour le visa entrepreneur et comment obtenir la résidence fiscale.",
    date: "5 mars 2026",
    lecture: "10 min",
    youtube_id: "REMPLACE_PAR_TON_ID",
    featured: false,
    outils: ["Wise", "Airwallex"],
    contenu: `
      <p>Dubai attire de plus en plus d'entrepreneurs français...</p>
    `
  },
  {
    id: "amazon-fba-2026",
    titre: "Amazon FBA en 2026 : toujours rentable ?",
    slug: "article-amazon-fba.html",
    categorie: "E-commerce",
    tags: ["Amazon", "FBA", "E-commerce"],
    description: "Le marché Amazon FBA est-il saturé en 2026 ? Chiffres réels, niches rentables et stratégies pour se différencier.",
    date: "1 mars 2026",
    lecture: "9 min",
    youtube_id: null,
    featured: false,
    outils: ["Shopify", "Airwallex"],
    contenu: `
      <p>Amazon FBA a bien changé depuis 2020...</p>
    `
  },
  {
    id: "erreurs-mindset",
    titre: "Les 7 erreurs mentales qui tuent ton business avant même de démarrer",
    slug: "article-erreurs-mindset.html",
    categorie: "Mindset",
    tags: ["Mindset", "Entrepreneuriat", "Psychologie"],
    description: "Les croyances limitantes les plus courantes chez les entrepreneurs débutants — et comment les dépasser concrètement.",
    date: "25 février 2026",
    lecture: "7 min",
    youtube_id: null,
    featured: false,
    outils: [],
    contenu: `
      <p>Avant même d'avoir lancé leur business, beaucoup d'entrepreneurs sabotent leurs chances...</p>
    `
  }
];

// =============================================
// NE PAS MODIFIER EN DESSOUS DE CETTE LIGNE
// =============================================

// Récupère un article par son ID
function getArticle(id) {
  return SBW_ARTICLES.find(a => a.id === id) || null;
}

// Récupère les articles par catégorie
function getArticlesByCategorie(categorie) {
  return SBW_ARTICLES.filter(a => a.categorie === categorie);
}

// Récupère l'article featured
function getFeaturedArticle() {
  return SBW_ARTICLES.find(a => a.featured) || SBW_ARTICLES[0];
}

// Récupère les articles récents (sans le featured)
function getRecentArticles(limit = 4) {
  return SBW_ARTICLES.filter(a => !a.featured).slice(0, limit);
}

// Récupère les articles liés (même catégorie, différent ID)
function getRelatedArticles(currentId, limit = 3) {
  const current = getArticle(currentId);
  if (!current) return SBW_ARTICLES.slice(0, limit);
  return SBW_ARTICLES
    .filter(a => a.id !== currentId && a.categorie === current.categorie)
    .concat(SBW_ARTICLES.filter(a => a.id !== currentId && a.categorie !== current.categorie))
    .slice(0, limit);
}
