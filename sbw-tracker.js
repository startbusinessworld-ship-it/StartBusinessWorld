/**
 * SBW Tracker — Suivi de progression universel
 * Ajoute <script src="/sbw-tracker.js"></script> dans toute formation SBW
 * La progression est stockée dans localStorage et lue par membre-formations.html
 */
(function () {
  // Clé basée sur le nom du fichier HTML (ex: "sbw_shopify_module_complet_3")
  var filename = window.location.pathname.split('/').pop().replace('.html', '');
  var STORAGE_KEY = 'sbw_tracker__' + filename;

  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) { return {}; }
  }

  function save(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  var SBWTracker = {
    STORAGE_KEY: STORAGE_KEY,

    /**
     * Initialiser le tracker
     * @param {number} totalLessons - nombre total de leçons dans la formation
     */
    init: function (totalLessons) {
      var data = load();
      if (!data._total || data._total !== totalLessons) {
        data._total = totalLessons;
        data._updated = Date.now();
        save(data);
      }
      console.log('[SBW Tracker] Initialisé pour "' + filename + '" — ' + totalLessons + ' leçons');
    },

    /**
     * Marquer une leçon comme terminée
     * @param {number} lessonIndex - index de la leçon (0-based)
     */
    markDone: function (lessonIndex) {
      var data = load();
      if (!data[lessonIndex]) {
        data[lessonIndex] = true;
        data._updated = Date.now();
        save(data);
        // Dispatch event pour que la formation puisse réagir
        window.dispatchEvent(new CustomEvent('sbw:lesson-done', { detail: { index: lessonIndex } }));
        console.log('[SBW Tracker] Leçon ' + lessonIndex + ' terminée ✓');
      }
    },

    /**
     * Marquer une leçon par pourcentage (pour les formats slide)
     * @param {number} lessonIndex - index de la leçon
     * @param {number} pct - pourcentage de complétion (0-100)
     * @param {number} threshold - seuil pour considérer comme terminée (défaut: 80)
     */
    markProgress: function (lessonIndex, pct, threshold) {
      if (pct >= (threshold || 80)) {
        SBWTracker.markDone(lessonIndex);
      }
    },

    /**
     * Obtenir la progression actuelle
     */
    getProgress: function () {
      var data = load();
      var total = data._total || 0;
      var done = Object.keys(data).filter(function (k) {
        return k !== '_total' && k !== '_updated' && data[k] === true;
      }).length;
      return {
        done: done,
        total: total,
        pct: total > 0 ? Math.round(done / total * 100) : 0,
        raw: data
      };
    },

    /**
     * Réinitialiser la progression (pour tests)
     */
    reset: function () {
      localStorage.removeItem(STORAGE_KEY);
      console.log('[SBW Tracker] Progression réinitialisée');
    }
  };

  window.SBWTracker = SBWTracker;

  /**
   * ─── FONCTIONS GLOBALES (utilisées par dashboard et prestige) ───
   */

  /**
   * Agrège la progression de TOUTES les formations depuis localStorage
   * Retourne { totalDone, totalLessons, pct, byFormation }
   */
  window.SBW_getAllFormationsProgress = function() {
    var totalDone = 0;
    var totalLessons = 0;
    var byFormation = {};

    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (!key || !key.startsWith('sbw_tracker__')) continue;
      try {
        var data = JSON.parse(localStorage.getItem(key) || '{}');
        var total = data._total || 0;
        var done = Object.keys(data).filter(function(k) {
          return k !== '_total' && k !== '_updated' && data[k] === true;
        }).length;
        totalDone += done;
        totalLessons += total;
        // Normalise la clé : tirets et underscores sont équivalents
        var normalKey = key.replace('sbw_tracker__', '').replace(/_/g, '-');
        byFormation[normalKey] = {
          done: done, total: total,
          pct: total > 0 ? Math.round(done / total * 100) : 0
        };
      } catch(e) {}
    }

    return {
      totalDone: totalDone,
      totalLessons: totalLessons,
      pct: totalLessons > 0 ? Math.round(totalDone / totalLessons * 100) : 0,
      byFormation: byFormation
    };
  };

  /**
   * Nombre d'articles lus (stocké comme nombre entier)
   */
  window.SBW_getArticlesRead = function(userId) {
    try { return parseInt(localStorage.getItem('sbw_articles_' + userId) || '0'); } catch(e) { return 0; }
  };

  /**
   * Marquer un article comme lu et incrémenter le compteur
   */
  window.SBW_markArticleRead = function(userId) {
    try {
      var count = parseInt(localStorage.getItem('sbw_articles_' + userId) || '0');
      localStorage.setItem('sbw_articles_' + userId, String(count + 1));
    } catch(e) {}
  };

  /**
   * Streak (jours consécutifs de connexion)
   */
  window.SBW_getStreak = function(userId) {
    try {
      var data = JSON.parse(localStorage.getItem('sbw_streak_' + userId) || '{"count":0}');
      var lastDate = data.lastDate ? new Date(data.lastDate) : null;
      var today = new Date();
      today.setHours(0,0,0,0);
      if (lastDate) {
        var diffDays = Math.round((today - lastDate) / 86400000);
        if (diffDays === 1) {
          // Jour consécutif
          data.count = (data.count || 0) + 1;
          data.lastDate = today.toISOString();
          localStorage.setItem('sbw_streak_' + userId, JSON.stringify(data));
        } else if (diffDays > 1) {
          // Streak cassé
          data.count = 1;
          data.lastDate = today.toISOString();
          localStorage.setItem('sbw_streak_' + userId, JSON.stringify(data));
        }
        // diffDays === 0 = déjà connecté aujourd'hui, on ne change rien
      } else {
        data = { count: 1, lastDate: today.toISOString() };
        localStorage.setItem('sbw_streak_' + userId, JSON.stringify(data));
      }
      return data.count || 0;
    } catch(e) { return 0; }
  };

  /**
   * Calcule le XP total d'un utilisateur
   * @param {string} userId - ID Supabase de l'utilisateur
   * @param {number} msgCount - nombre de messages envoyés (depuis Supabase)
   * @param {number} filleuls - nombre de filleuls (depuis Supabase)
   */
  window.SBW_calcXP = function(userId, msgCount, filleuls) {
    var prog = SBW_getAllFormationsProgress();
    var articlesRead = SBW_getArticlesRead(userId);
    var streak = SBW_getStreak(userId);
    return (prog.totalDone * 10) + (msgCount * 2) + (articlesRead * 5) + (streak * 15) + ((filleuls || 0) * 50);
  };

})();
