import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://jukkbhcgriohapmlmdfo.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_aEXip-ChEGGAzZzGexKdjQ_YbLzRHOh';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = selector => document.querySelector(selector);
const state = { session: null, users: [], classes: [] };
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const date = value => value ? new Date(value).toLocaleDateString('cs-CZ') : '—';

async function callAdmin(action, values = {}) {
  const { data, error } = await supabase.functions.invoke('admin-api', { body: { action, ...values } });
  if (error) {
    let details = error.message || 'Požadavek selhal.';
    try { if (error.context) details = (await error.context.json()).error || details; } catch {}
    throw new Error(details);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
function showToast(message, error = false) {
  const node = $('#toast'); node.textContent = message; node.classList.toggle('error', error); node.classList.add('visible');
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => node.classList.remove('visible'), 4000);
}

async function loadOverview() {
  $('#status').textContent = 'Načítám přehled…';
  const data = await callAdmin('overview');
  state.users = data.users || [];
  state.classes = data.classes || [];
  renderOverview();
  $('#status').textContent = '';
}
function renderOverview() {
  const ownerEmail = new Map(state.users.map(user => [user.id, user.email || '(bez e-mailu)']));
  $('#admin-stats').innerHTML = `<article class="stat-card"><strong>${state.users.length}</strong><span>uživatelů</span></article><article class="stat-card"><strong>${state.classes.length}</strong><span>tříd</span></article><article class="stat-card"><strong>${state.users.filter(user => user.role === 'admin').length}</strong><span>administrátorů</span></article>`;
  $('#user-summary').textContent = `${state.users.length} účtů`;
  $('#users-body').innerHTML = state.users.map(user => `<tr><td>${esc(user.email || '(bez e-mailu)')}</td><td><select class="role-select" data-user-id="${esc(user.id)}" aria-label="Role uživatele ${esc(user.email || '')}"><option value="teacher" ${user.role === 'teacher' ? 'selected' : ''}>Učitel</option><option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrátor</option></select></td><td>${date(user.created_at)}</td><td><button class="button button-soft reset-user" data-user-id="${esc(user.id)}">Poslat odkaz na heslo</button></td></tr>`).join('') || '<tr><td colspan="4">Žádní uživatelé.</td></tr>';
  $('#classes-body').innerHTML = state.classes.map(room => `<tr><td>${esc(room.name)}</td><td>${esc(ownerEmail.get(room.user_id) || room.user_id)}</td><td>${room.rows} × ${room.desks_per_row} lavic</td><td>${date(room.created_at)}</td><td><button class="button button-danger delete-room" data-class-id="${esc(room.id)}" data-name="${esc(room.name)}">Smazat třídu</button></td></tr>`).join('') || '<tr><td colspan="5">Zatím nejsou vytvořené žádné třídy.</td></tr>';
  $('#admin-content').hidden = false;
  document.querySelectorAll('.role-select').forEach(select => select.addEventListener('change', async () => {
    const user = state.users.find(item => item.id === select.dataset.userId);
    const previousRole = user?.role;
    select.disabled = true;
    try {
      await callAdmin('set-role', { userId: select.dataset.userId, role: select.value });
      if (user) user.role = select.value;
      showToast('Role byla změněna.');
      renderOverview();
    } catch (error) {
      select.value = previousRole || 'teacher'; showToast(error.message, true);
    } finally { select.disabled = false; }
  }));
  document.querySelectorAll('.reset-user').forEach(button => button.addEventListener('click', async () => {
    button.disabled = true;
    try { const result = await callAdmin('send-password-reset', { userId: button.dataset.userId }); showToast(result.message); }
    catch (error) { showToast(error.message, true); }
    finally { button.disabled = false; }
  }));
  document.querySelectorAll('.delete-room').forEach(button => button.addEventListener('click', async () => {
    if (!confirm(`Smazat třídu „${button.dataset.name}“ včetně seznamu žáků?`)) return;
    button.disabled = true;
    try { await callAdmin('delete-class', { classId: button.dataset.classId }); await loadOverview(); showToast('Třída byla smazána.'); }
    catch (error) { showToast(error.message, true); button.disabled = false; }
  }));
}

$('#invite-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]'); button.disabled = true;
  try {
    const result = await callAdmin('invite-user', { email: $('#invite-email').value.trim(), role: $('#invite-role').value });
    $('#invite-form').reset(); showToast(result.message); await loadOverview();
  } catch (error) { showToast(error.message, true); }
  finally { button.disabled = false; }
});
$('#refresh').addEventListener('click', () => loadOverview().catch(error => showToast(error.message, true)));
$('#sign-out').addEventListener('click', async () => { await supabase.auth.signOut(); location.href = '../'; });

supabase.auth.getSession().then(async ({ data, error }) => {
  if (error) throw error;
  if (!data.session) { location.href = '../'; return; }
  state.session = data.session;
  $('#admin-email').textContent = data.session.user.email || '';
  try { await loadOverview(); }
  catch (error) { $('#status').textContent = error.message; $('#status').classList.add('error'); }
}).catch(error => { $('#status').textContent = error.message || 'Přístup se nepodařilo ověřit.'; $('#status').classList.add('error'); });
