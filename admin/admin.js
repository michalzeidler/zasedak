import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://jukkbhcgriohapmlmdfo.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_aEXip-ChEGGAzZzGexKdjQ_YbLzRHOh';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = selector => document.querySelector(selector);
const state = { session: null, users: [], classes: [], selectedClass: null };
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
  state.users = data.users || []; state.classes = data.classes || [];
  renderOverview(); $('#status').textContent = '';
}
function renderOverview() {
  const ownerEmail = new Map(state.users.map(user => [user.id, user.email || '(bez e-mailu)']));
  $('#admin-stats').innerHTML = `<article class="stat-card"><strong>${state.users.length}</strong><span>uživatelů</span></article><article class="stat-card"><strong>${state.classes.length}</strong><span>tříd</span></article><article class="stat-card"><strong>${state.users.filter(user => user.role === 'admin').length}</strong><span>administrátorů</span></article>`;
  $('#user-summary').textContent = `${state.users.length} účtů`;
  $('#users-body').innerHTML = state.users.map(user => `<tr><td>${esc(user.email || '(bez e-mailu)')}</td><td><select class="role-select" data-user-id="${esc(user.id)}" aria-label="Role uživatele ${esc(user.email || '')}"><option value="teacher" ${user.role === 'teacher' ? 'selected' : ''}>Učitel</option><option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrátor</option></select></td><td>${date(user.created_at)}</td><td><button class="button button-soft reset-user" data-user-id="${esc(user.id)}">Poslat obnovu hesla</button> <button class="button button-danger delete-user" data-user-id="${esc(user.id)}" data-email="${esc(user.email || '')}">Smazat uživatele</button></td></tr>`).join('') || '<tr><td colspan="4">Žádní uživatelé.</td></tr>';
  $('#classes-body').innerHTML = state.classes.map(room => `<tr><td><button class="class-link" data-class-id="${esc(room.id)}">${esc(room.name)}</button></td><td>${esc(ownerEmail.get(room.user_id) || room.user_id)}</td><td>${room.rows} × ${room.desks_per_row} lavic</td><td>${date(room.created_at)}</td><td><button class="button button-soft open-class" data-class-id="${esc(room.id)}">Otevřít</button> <button class="button button-danger delete-room" data-class-id="${esc(room.id)}" data-name="${esc(room.name)}">Smazat</button></td></tr>`).join('') || '<tr><td colspan="5">Zatím nejsou vytvořené žádné třídy.</td></tr>';
  $('#admin-content').hidden = false;
  bindOverviewActions();
}
function bindOverviewActions() {
  document.querySelectorAll('.role-select').forEach(select => select.addEventListener('change', async () => {
    const user = state.users.find(item => item.id === select.dataset.userId); const previousRole = user?.role; select.disabled = true;
    try { await callAdmin('set-role', { userId: select.dataset.userId, role: select.value }); if (user) user.role = select.value; showToast('Role byla změněna.'); renderOverview(); }
    catch (error) { select.value = previousRole || 'teacher'; showToast(error.message, true); } finally { select.disabled = false; }
  }));
  document.querySelectorAll('.reset-user').forEach(button => button.addEventListener('click', async () => {
    button.disabled = true; try { const result = await callAdmin('send-password-reset', { userId: button.dataset.userId }); showToast(result.message); } catch (error) { showToast(error.message, true); } finally { button.disabled = false; }
  }));
  document.querySelectorAll('.delete-user').forEach(button => button.addEventListener('click', async () => {
    if (!confirm(`Smazat uživatele ${button.dataset.email || ''}? Budou odstraněny i všechny jeho třídy.`)) return;
    button.disabled = true; try { await callAdmin('delete-user', { userId: button.dataset.userId }); await loadOverview(); showToast('Uživatel byl smazán.'); } catch (error) { showToast(error.message, true); button.disabled = false; }
  }));
  document.querySelectorAll('.delete-room').forEach(button => button.addEventListener('click', async () => {
    if (!confirm(`Smazat třídu „${button.dataset.name}“ včetně seznamu žáků?`)) return;
    button.disabled = true; try { await callAdmin('delete-class', { classId: button.dataset.classId }); await loadOverview(); showToast('Třída byla smazána.'); } catch (error) { showToast(error.message, true); button.disabled = false; }
  }));
  document.querySelectorAll('.open-class,.class-link').forEach(button => button.addEventListener('click', () => openClassEditor(button.dataset.classId)));
}
async function openClassEditor(classId) {
  try {
    const data = await callAdmin('get-class', { classId }); state.selectedClass = data;
    $('#dialog-title').textContent = data.name; $('#edit-class-name').value = data.name;
    $('#edit-class-rows').value = String(data.rows); $('#edit-class-desks').value = String(data.desks_per_row);
    $('#edit-students').value = (data.students || []).map(student => student.name).join('\n');
    renderSeatPreview(); $('#class-dialog').showModal();
  } catch (error) { showToast(error.message, true); }
}
function renderSeatPreview() {
  const room = state.selectedClass; if (!room) return;
  const students = [...(room.students || [])].sort((a,b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const rows = Number($('#edit-class-rows').value); const desks = Number($('#edit-class-desks').value);
  room.rows = rows; room.desks_per_row = desks;
  const capacity = rows * desks * 2;
  $('#preview-summary').textContent = `${students.length} žáků · ${capacity} míst`;
  let html = '';
  for (let row = 0; row < rows; row++) {
    html += '<div class="preview-row">';
    for (let desk = 0; desk < desks; desk++) {
      html += '<div class="preview-desk">';
      for (let side = 0; side < 2; side++) {
        const index = (row * desks + desk) * 2 + side;
        const student = students.find(item => item.seat_index === index);
        html += `<div class="preview-seat ${student ? 'filled' : ''}">${student ? esc(student.name) : 'prázdné'}</div>`;
      }
      html += '</div>';
    }
    html += '</div>';
  }
  $('#seat-preview').innerHTML = html;
}
$('#edit-class-rows').addEventListener('change', renderSeatPreview);
$('#edit-class-desks').addEventListener('change', renderSeatPreview);
$('#edit-students').addEventListener('input', () => {
  if (!state.selectedClass) return;
  const names = $('#edit-students').value.split(/\r?\n/).map(name => name.trim()).filter(Boolean);
  state.selectedClass.students = names.map((name, index) => ({ id: state.selectedClass.students[index]?.id, name, seat_index: state.selectedClass.students[index]?.seat_index ?? null, sort_order: index }));
  renderSeatPreview();
});
$('#save-class-editor').addEventListener('click', async event => {
  const button = event.currentTarget; button.disabled = true;
  try {
    const names = $('#edit-students').value.split(/\r?\n/).map(name => name.trim().slice(0,80)).filter(Boolean);
    if (names.length > 100) throw new Error('Do jedné třídy lze přidat nejvýše 100 žáků.');
    await callAdmin('update-class', { classId: state.selectedClass.id, name: $('#edit-class-name').value.trim() || 'Nová třída', rows: Number($('#edit-class-rows').value), desks_per_row: Number($('#edit-class-desks').value), names });
    await loadOverview(); $('#class-dialog').close(); showToast('Třída byla upravena.');
  } catch (error) { showToast(error.message, true); } finally { button.disabled = false; }
});

$('#invite-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.currentTarget.querySelector('button[type="submit"]'); button.disabled = true;
  try { const result = await callAdmin('invite-user', { email: $('#invite-email').value.trim(), role: $('#invite-role').value }); $('#invite-form').reset(); showToast(result.message); await loadOverview(); }
  catch (error) { showToast(error.message, true); } finally { button.disabled = false; }
});
$('#refresh').addEventListener('click', () => loadOverview().catch(error => showToast(error.message, true)));
$('#sign-out').addEventListener('click', async () => { await supabase.auth.signOut(); location.href = '../'; });
supabase.auth.getSession().then(async ({ data, error }) => {
  if (error) throw error; if (!data.session) { location.href = '../'; return; }
  state.session = data.session; $('#admin-email').textContent = data.session.user.email || '';
  try { await loadOverview(); } catch (error) { $('#status').textContent = error.message; $('#status').classList.add('error'); }
}).catch(error => { $('#status').textContent = error.message || 'Přístup se nepodařilo ověřit.'; $('#status').classList.add('error'); });
