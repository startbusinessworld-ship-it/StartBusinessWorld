// SBW Membre Auth — protection des pages membres
// Inclure sur toutes les pages membres : <script src="sbw-membre-auth.js"></script>
;(function() {
  var SUPABASE_URL = 'https://grwimhqsthcmfwblwdwg.supabase.co'
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyd2ltaHFzdGhjbWZ3Ymx3ZHdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0OTA5NDIsImV4cCI6MjA5MDA2Njk0Mn0.faK7rX_1OElj5g28NJyAkhucvJIX1R8scopOZ8TRKXc'
  var PLANS_PAYANTS = ['intro', 'basic', 'pro', 'business']

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
    if (!member || !PLANS_PAYANTS.includes(member.plan)) {
      window.location.href = 'plans.html'
      return false
    }
    
    return true
  }

  // Exposer globalement
  window.SBW_checkAuth = checkAuth
  
  // Auto-check au chargement
  document.addEventListener('DOMContentLoaded', function() {
    checkAuth()
  })
})()
