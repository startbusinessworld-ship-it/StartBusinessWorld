// SBW Membre Auth — protection des pages membres + gestion upgrade
// Inclure sur toutes les pages membres : <script src="sbw-membre-auth.js"></script>
//
// Pour définir le plan minimum requis sur une page :
// <script>var SBW_REQUIRED_PLAN = 'pro'</script>  (avant ce script)
// Plans par ordre : intro < basic < pro < business
;(function() {
  var SUPABASE_URL = 'https://grwimhqsthcmfwblwdwg.supabase.co'
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyd2ltaHFzdGhjbWZ3Ymx3ZHdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0OTA5NDIsImV4cCI6MjA5MDA2Njk0Mn0.faK7rX_1OElj5g28NJyAkhucvJIX1R8scopOZ8TRKXc'
  var PLANS_PAYANTS = ['inscrit', 'intro', 'basic', 'pro', 'business']
  var PLAN_LEVELS = { 'inscrit': 2, 'intro': 2, 'basic': 2, 'pro': 3, 'business': 4 }
  var PLAN_PRICES = { 'basic': '29', 'pro': '79', 'business': '149' }

  function getPlanLevel(plan) {
    return PLAN_LEVELS[plan] || 0
  }

  function showUpgradeModal(requiredPlan, currentPlan) {
    var price = PLAN_PRICES[requiredPlan] || '79'
    var planName = requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)

    var overlay = document.createElement('div')
    overlay.id = 'sbw-upgrade-modal'
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1.5rem'

    overlay.innerHTML = '<div style="background:#fff;border-radius:12px;padding:2.5rem;max-width:420px;width:100%;text-align:center">'
      + '<div style="font-size:2.5rem;margin-bottom:1rem">🔒</div>'
      + '<div style="font-family:Georgia,serif;font-size:1.3rem;margin-bottom:0.5rem">Contenu réservé au plan ' + planName + '</div>'
      + '<div style="font-size:0.85rem;color:#888;line-height:1.7;margin-bottom:1.5rem">'
      + 'Cette section est accessible à partir du plan ' + planName + '. Upgrade ton abonnement pour y accéder immédiatement.'
      + '</div>'
      + '<button id="sbw-upgrade-btn" style="width:100%;background:#A67C3A;color:#fff;border:none;padding:1rem;border-radius:7px;font-size:0.9rem;font-weight:500;cursor:pointer;font-family:sans-serif;margin-bottom:0.8rem">'
      + 'Passer au plan ' + planName + ' — ' + price + '€/mois →'
      + '</button>'
      + '<button id="sbw-upgrade-back" style="width:100%;background:transparent;color:#888;border:0.5px solid #ddd;padding:0.8rem;border-radius:7px;font-size:0.82rem;cursor:pointer;font-family:sans-serif">'
      + 'Retour au dashboard'
      + '</button>'
      + '<div style="font-size:0.68rem;color:#aaa;margin-top:0.8rem">Sans engagement · Prorata calculé automatiquement</div>'
      + '</div>'

    document.body.appendChild(overlay)

    document.getElementById('sbw-upgrade-btn').onclick = async function() {
      this.textContent = 'Chargement...'
      this.disabled = true
      try {
        var sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        var sess = await sb.auth.getSession()
        if (!sess.data.session) { window.location.href = 'client-login.html'; return }
        var res = await fetch(SUPABASE_URL + '/functions/v1/upgrade-plan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + sess.data.session.access_token
          },
          body: JSON.stringify({ plan: requiredPlan })
        })
        var data = await res.json()
        if (data.url) {
          window.location.href = data.url
        } else if (data.success) {
          window.location.reload()
        } else {
          alert('Erreur: ' + (data.error || 'Échec'))
          this.textContent = 'Réessayer'
          this.disabled = false
        }
      } catch(e) {
        alert('Erreur: ' + e.message)
        this.textContent = 'Réessayer'
        this.disabled = false
      }
    }

    document.getElementById('sbw-upgrade-back').onclick = function() {
      window.location.href = 'client-dashboard.html'
    }

    overlay.onclick = function(e) {
      if (e.target === overlay) window.location.href = 'client-dashboard.html'
    }
  }

  async function checkAuth() {
    var sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    var s = await sb.auth.getSession()

    if (!s.data.session) {
      window.location.href = 'client-login.html'
      return false
    }

    var userId = s.data.session.user.id

    // Vérifier si admin
    var { data: userData } = await sb.from('users').select('role').eq('id', userId).single()
    if (userData?.role === 'admin') return true

    // Vérifier plan
    var { data: member } = await sb.from('members').select('plan').eq('id', userId).single()
    var currentPlan = member?.plan || null

    if (!member || !PLANS_PAYANTS.includes(currentPlan)) {
      // Pas de plan payant du tout → sync Stripe puis re-check
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
          var { data: refreshed } = await sb.from('members').select('plan').eq('id', userId).single()
          currentPlan = refreshed?.plan || null
        }
      } catch(e) {}

      if (!PLANS_PAYANTS.includes(currentPlan)) {
        // Créer le membre avec plan basic s'il n'existe pas
        try {
          await sb.from('members').upsert({
            id: userId,
            email: s.data.session.user.email,
            plan: 'basic',
            created_at: new Date().toISOString()
          }, { onConflict: 'id' })
        } catch(e) {}
        // Recharger la page pour prendre en compte le nouveau plan
        window.location.reload()
        return false
      }
    }

    // Vérifier le plan minimum requis pour cette page
    var requiredPlan = window.SBW_REQUIRED_PLAN || null
    if (requiredPlan && getPlanLevel(currentPlan) < getPlanLevel(requiredPlan)) {
      showUpgradeModal(requiredPlan, currentPlan)
      return false
    }

    return true
  }

  // Exposer globalement
  window.SBW_checkAuth = checkAuth
  window.SBW_showUpgradeModal = showUpgradeModal

  // Auto-check au chargement
  document.addEventListener('DOMContentLoaded', function() {
    checkAuth()
  })
})()
