// SBW Tracker — tracker de visites + sync progression formations
;(function() {
  'use strict'

  var SUPABASE_URL = 'https://grwimhqsthcmfwblwdwg.supabase.co'
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyd2ltaHFzdGhjbWZ3Ymx3ZHdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0OTA5NDIsImV4cCI6MjA5MDA2Njk0Mn0.faK7rX_1OElj5g28NJyAkhucvJIX1R8scopOZ8TRKXc'

  // Ne pas tracker les pages admin
  if (window.location.pathname.indexOf('admin') !== -1) return

  function getDevice() {
    var w = window.innerWidth
    if (w < 768) return 'mobile'
    if (w < 1024) return 'tablet'
    return 'desktop'
  }

  function getPage() {
    var p = window.location.pathname.replace(/\/$/, '') || '/'
    return p.split('/').pop().replace('.html', '') || 'index'
  }

  function track() {
    fetch(SUPABASE_URL + '/rest/v1/page_views', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        page: getPage(),
        referrer: document.referrer ? (function() { try { return new URL(document.referrer).hostname } catch(e) { return null } })() : null,
        device: getDevice()
      })
    }).catch(function() {})
  }

  // ═══ SYNC PROGRESSION FORMATIONS ═══
  // Pousse toutes les clés sbw_tracker__* vers Supabase pour que l'admin puisse voir la progression
  async function syncProgress() {
    try {
      // Récupérer la session
      if (!window.supabase) return
      var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      var s = await sb.auth.getSession()
      if (!s.data.session) return
      var userId = s.data.session.user.id

      // Parcourir localStorage
      var keys = []
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i)
        if (k && k.indexOf('sbw_tracker__') === 0) keys.push(k)
      }
      if (!keys.length) return

      // Upsert chaque formation
      for (var j = 0; j < keys.length; j++) {
        var key = keys[j]
        var formationKey = key.replace('sbw_tracker__', '')
        var data = {}
        try { data = JSON.parse(localStorage.getItem(key) || '{}') } catch(e) {}
        await sb.from('formation_progress').upsert({
          user_id: userId,
          formation_key: formationKey,
          progress: data,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,formation_key' })
      }
    } catch(e) {}
  }

  // Tracker après 1 seconde pour éviter les bounces instantanés
  setTimeout(track, 1000)

  // Sync progression après 3s (laisse le temps à la page de se charger)
  // + toutes les 60s pour capturer les progressions en cours
  setTimeout(syncProgress, 3000)
  setInterval(syncProgress, 60000)

  // Sync avant de quitter la page
  window.addEventListener('beforeunload', syncProgress)
})()
