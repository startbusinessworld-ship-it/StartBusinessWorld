// =============================================
// SBW ADMIN — auth.js
// Inclure ce fichier dans toutes les pages admin
// =============================================

const SUPABASE_URL = 'https://grwimhqsthcmfwblwdwg.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyd2ltaHFzdGhjbWZ3Ymx3ZHdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0OTA5NDIsImV4cCI6MjA5MDA2Njk0Mn0.faK7rX_1OElj5g28NJyAkhucvJIX1R8scopOZ8TRKXc'

const { createClient } = supabase
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Rôles et leurs accès
const ROLE_ACCESS = {
  admin:  ['dashboard', 'articles', 'newsletter', 'members', 'revenue', 'affiliation', 'settings', 'team'],
  writer: ['articles'],
  contributor: ['articles', 'newsletter'],
  editor: ['newsletter']
}

// Page actuelle (définie dans chaque page HTML)
// ex: <script>const PAGE_ID = 'dashboard'</script>

async function initAuth() {
  const { data: { session } } = await sb.auth.getSession()

  if (!session) {
    window.location.href = 'admin-login.html'
    return null
  }

  const { data: profile } = await sb
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single()

  if (!profile) {
    await sb.auth.signOut()
    window.location.href = 'admin-login.html'
    return null
  }

  // Vérifie l'accès à la page actuelle
  if (typeof PAGE_ID !== 'undefined') {
    const allowed = ROLE_ACCESS[profile.role] || []
    if (!allowed.includes(PAGE_ID)) {
      window.location.href = getDefaultPage(profile.role)
      return null
    }
  }

  // Injecte les infos utilisateur dans la nav
  renderUserNav(profile)

  // Affiche/cache les nav items selon le rôle
  renderSidebarByRole(profile.role)

  return profile
}

function getDefaultPage(role) {
  if (role === 'admin')  return 'admin-dashboard.html'
  if (role === 'writer') return 'admin-articles.html'
  if (role === 'editor') return 'admin-newsletter.html'
  if (role === 'contributor') return 'admin-articles.html'
  return 'admin-login.html'
}

function renderUserNav(profile) {
  const el = document.getElementById('userInfo')
  if (!el) return
  const initials = profile.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)
    : profile.email.slice(0,2).toUpperCase()

  el.innerHTML = '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-top:0.5px solid rgba(255,255,255,0.08)">' +
    '<div style="width:28px;height:28px;border-radius:50%;background:rgba(166,124,58,0.2);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:500;color:#A67C3A;flex-shrink:0">' + initials + '</div>' +
    '<div style="min-width:0;flex:1">' +
      '<div style="font-size:12px;font-weight:500;color:#F0EDE4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (profile.full_name || profile.email) + '</div>' +
      '<div style="font-size:10px;color:rgba(240,237,228,0.4);text-transform:capitalize">' + profile.role + '</div>' +
    '</div>' +
    '<button onclick="handleLogout()" style="background:none;border:none;cursor:pointer;color:rgba(240,237,228,0.3);font-size:12px;padding:2px" title="Déconnexion">&#9167;</button>' +
  '</div>'
}

function renderSidebarByRole(role) {
  const allowed = ROLE_ACCESS[role] || []
  document.querySelectorAll('[data-access]').forEach(el => {
    const required = el.getAttribute('data-access')
    if (!allowed.includes(required)) {
      el.style.display = 'none'
    }
  })
}

async function handleLogout() {
  await sb.auth.signOut()
  window.location.href = 'admin-login.html'
}
