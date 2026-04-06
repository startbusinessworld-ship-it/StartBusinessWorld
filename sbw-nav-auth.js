// SBW Nav Auth — affiche connexion/déconnexion dans la navbar sur toutes les pages
;(function() {
  var SUPABASE_URL = 'https://grwimhqsthcmfwblwdwg.supabase.co'
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyd2ltaHFzdGhjbWZ3Ymx3ZHdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0OTA5NDIsImV4cCI6MjA5MDA2Njk0Mn0.faK7rX_1OElj5g28NJyAkhucvJIX1R8scopOZ8TRKXc'

  var style = document.createElement('style')
  style.textContent = `
    .sbw-auth-btn {
      display:inline-flex;align-items:center;gap:8px;
      padding:6px 14px;border-radius:7px;
      font-family:"DM Sans",sans-serif;font-size:.78rem;font-weight:500;
      cursor:pointer;border:none;transition:all .15s;text-decoration:none;
    }
    .sbw-auth-login {
      background:rgba(166,124,58,.15);color:#A67C3A;
      border:0.5px solid rgba(166,124,58,.3);
    }
    .sbw-auth-login:hover { background:rgba(166,124,58,.25); }
    .sbw-auth-user {
      background:rgba(255,255,255,.06);color:rgba(240,237,228,.8);
      border:0.5px solid rgba(255,255,255,.1);
    }
    .sbw-auth-user:hover { background:rgba(255,255,255,.1); }
    .sbw-auth-avatar {
      width:22px;height:22px;border-radius:50%;
      background:#A67C3A;color:#fff;
      display:inline-flex;align-items:center;justify-content:center;
      font-size:.62rem;font-weight:700;flex-shrink:0;
    }
    .sbw-auth-logout {
      background:none;color:rgba(240,237,228,.35);
      border:0.5px solid rgba(255,255,255,.08);
      padding:6px 10px;border-radius:7px;
      font-family:"DM Sans",sans-serif;font-size:.72rem;
      cursor:pointer;transition:all .15s;
    }
    .sbw-auth-logout:hover { color:#F0EDE4;border-color:rgba(255,255,255,.2); }
    .sbw-auth-wrap { display:inline-flex;align-items:center;gap:6px; }
  `
  document.head.appendChild(style)

  async function init() {
    var sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    var { data: { session } } = await sb.auth.getSession()

    // Trouver tous les conteneurs nav-auth dans la page
    var containers = document.querySelectorAll('[data-sbw-auth]')
    if (!containers.length) return

    containers.forEach(function(container) {
      if (!session) {
        // Non connecté → bouton Se connecter
        container.innerHTML = '<a href="client-login.html?mode=login" class="sbw-auth-btn sbw-auth-login">Se connecter →</a>'
      } else {
        // Connecté → avatar + nom + bouton déconnexion
        var user = session.user
        var name = user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0]
        var initials = name.split(' ').map(function(n){ return n[0] }).join('').toUpperCase().slice(0,2)
        var plansPayants = ['intro', 'basic', 'pro', 'business']

        // Vérifier plan pour le lien dashboard
        sb.from('members').select('plan').eq('id', user.id).single().then(function(res) {
          var member = res.data
          var isAdmin = false
          sb.from('users').select('role').eq('id', user.id).single().then(function(r) {
            isAdmin = r.data?.role === 'admin'
            var dashUrl = (isAdmin || (member && plansPayants.includes(member.plan)))
              ? 'client-dashboard.html'
              : 'plans.html'

            container.innerHTML =
              '<div class="sbw-auth-wrap">' +
                '<a href="' + dashUrl + '" class="sbw-auth-btn sbw-auth-user">' +
                  '<span class="sbw-auth-avatar">' + initials + '</span>' +
                  name.split(' ')[0] +
                '</a>' +
                '<button class="sbw-auth-logout" onclick="window.SBW_logout()">⏻</button>' +
              '</div>'
          })
        })
      }
    })

    // Fonction globale de déconnexion
    window.SBW_logout = async function() {
      await sb.auth.signOut()
      window.location.href = 'client-login.html'
    }
  }

  // Attendre que supabase soit chargé
  if (window.supabase) {
    init()
  } else {
    window.addEventListener('load', init)
  }
})()
