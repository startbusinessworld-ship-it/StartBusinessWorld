// SBW Tracker — tracker de visites léger
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
        referrer: document.referrer ? new URL(document.referrer).hostname : null,
        device: getDevice()
      })
    }).catch(function() {})
  }

  // Tracker après 1 seconde pour éviter les bounces instantanés
  setTimeout(track, 1000)
})()
