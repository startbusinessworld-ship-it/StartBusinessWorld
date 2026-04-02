/**
 * SBW Admin Check
 * Vérifie si l'utilisateur connecté est admin.
 * Si oui, bypass toutes les restrictions de plan.
 * À inclure dans toutes les pages membres.
 */
(function() {
  const SUPABASE_URL = 'https://grwimhqsthcmfwblwdwg.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyd2ltaHFzdGhjbWZ3Ymx3ZHdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0OTA5NDIsImV4cCI6MjA5MDA2Njk0Mn0.faK7rX_1OElj5g28NJyAkhucvJIX1R8scopOZ8TRKXc';

  window.SBW_isAdmin = false;

  window.SBW_checkAdmin = async function(userId) {
    if (!userId) return false;
    try {
      const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data } = await sb.from('users').select('role').eq('id', userId).maybeSingle();
      window.SBW_isAdmin = data?.role === 'admin';
      return window.SBW_isAdmin;
    } catch(e) {
      return false;
    }
  };

  // Injecte un badge discret "Mode Admin" si admin
  window.SBW_showAdminBadge = function() {
    if (!window.SBW_isAdmin) return;
    var badge = document.createElement('div');
    badge.style.cssText = 'position:fixed;bottom:80px;right:16px;background:#0E0D0B;color:#A67C3A;font-size:.65rem;font-weight:600;padding:5px 12px;border-radius:20px;border:1px solid rgba(166,124,58,.3);z-index:9999;pointer-events:none;letter-spacing:.05em';
    badge.textContent = '⚡ Mode Admin';
    document.body.appendChild(badge);
  };
})();
