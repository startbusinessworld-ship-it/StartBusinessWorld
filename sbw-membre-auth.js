// SBW Membre Auth — protection des pages membres
// Inclure sur toutes les pages membres : <script src="sbw-membre-auth.js"></script>
;(function() {
  var SUPABASE_URL = 'https://grwimhqsthcmfwblwdwg.supabase.co'
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyd2ltaHFzdGhjbWZ3Ymx3ZHdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0OTA5NDIsImV4cCI6MjA5MDA2Njk0Mn0.faK7rX_1OElj5g28NJyAkhucvJIX1R8scopOZ8TRKXc'
  // Plans avec accès payant actif (mensuel, annuel + legacy pro/business)
  var PLANS_PAIDS = ['pro', 'business', 'mensuel', 'annuel']

  async function checkAuth() {
    var sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    var s = await sb.auth.getSession()

    if (!s.data.session) {
      window.location.href = 'client-login.html'
      return false
    }

    var userId = s.data.session.user.id
    var userEmail = s.data.session.user.email

    // Admin → accès total
    var { data: userData } = await sb.from('users').select('role').eq('id', userId).maybeSingle()
    if (userData?.role === 'admin') return true

    // Vérifier plan
    var { data: member } = await sb.from('members').select('plan').eq('id', userId).maybeSingle()
    var currentPlan = member?.plan || null

    // Si pas de plan payé → sync Stripe pour vérifier si abo actif
    if (!PLANS_PAIDS.includes(currentPlan)) {
      try {
        var syncRes = await fetch(SUPABASE_URL + '/functions/v1/sync-subscription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + s.data.session.access_token
          }
        })
        var sync = await syncRes.json()
        if (sync.synced) {
          var { data: refreshed } = await sb.from('members').select('plan').eq('id', userId).maybeSingle()
          currentPlan = refreshed?.plan || null
        }
      } catch(e) {}

      if (!PLANS_PAIDS.includes(currentPlan)) {
        // Créer un membre "inscrit" s'il n'existe pas, puis rediriger vers club pour s'abonner
        if (!member) {
          try {
            await sb.from('members').upsert({
              id: userId,
              email: userEmail,
              plan: 'inscrit',
              created_at: new Date().toISOString()
            }, { onConflict: 'id' })
          } catch(e) {}
        }
        window.location.href = 'club.html'
        return false
      }
    }

    return true
  }

  // Fonction legacy gardée pour compatibilité — redirige simplement vers club.html
  function showUpgradeModal() {
    window.location.href = 'club.html'
  }

  window.SBW_checkAuth = checkAuth
  window.SBW_showUpgradeModal = showUpgradeModal

  // Auto-check au chargement
  document.addEventListener('DOMContentLoaded', function() {
    checkAuth()
  })
})()
