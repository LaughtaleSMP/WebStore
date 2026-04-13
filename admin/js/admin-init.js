// ==================== SUPABASE ====================
const SUPABASE_URL = 'https://jlxtnbnrirxhwuyqjlzw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_03NmsAMGsfN63vFBmrgw9A_nB9uVVdq';

// createClient dengan format object tunggal (menghindari deprecated warning)
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: {},
  },
});
window._adminSb = sb;

// ==================== STATE ====================
let currentUser = null;
let currentRole = null;
let configData  = {};
let waAdmins    = { main: [], gem: [] };
let waAddingFor = null;

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });

  const { data: { session } } = await sb.auth.getSession();
  if (session) await afterLogin(session.user);

  ['cfg-status_api_provider','cfg-status_refresh_interval','cfg-status_custom_url'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input',  updateStatusPreview);
    if (el) el.addEventListener('change', updateStatusPreview);
  });

  ['cfg-server_ip','cfg-server_type','cfg-server_name'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateServerPreview);
    if (el) el.addEventListener('change', updateServerPreview);
  });

  fetchLiveStatus();
});
