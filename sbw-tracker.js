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

})();
