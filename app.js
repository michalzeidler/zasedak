import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://jukkbhcgriohapmlmdfo.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_aEXip-ChEGGAzZzGexKdjQ_YbLzRHOh';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = selector => document.querySelector(selector);
const state = { classes: [], activeClass: null, selectedId: null, isSignUp: false, saving: false, toastTimer: null };
const palette = ['#e9e4fa', '#fce9df', '#dff1e8', '#e3eff8', '#f9efce', '#f8e2eb', '#e9edda'];
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
function toast(message, error = false) { const el = $('#toast'); el.textContent = message; el.classList.toggle('error', error); el.classList.add('visible'); clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => el.classList.remove('visible'), 3200); }
function setSaving(value) { state.saving = value; const el = $('#save-status'); el.classList.toggle('is-saving', value); el.innerHTML = `<i></i> ${value ? 'Ukládám…' : 'Uloženo'}`; }
function errorMessage(error) { return error?.message || 'Operaci se nepodařilo dokončit. Zkuste to znovu.'; }
function capacity() { return state.activeClass.rows * state.activeClass.desksPerRow * 2; }
function seated() { return state.activeClass.students.filter(s => s.seatIndex !== null && s.seatIndex !== undefined); }

$('#auth-toggle').addEventListener('click', () => {
  state.isSignUp = !state.isSignUp;
  $('#auth-title').textContent = state.isSignUp ? 'Vytvořit účet' : 'Přihlášení';
  $('#auth-submit').textContent = state.isSignUp ? 'Vytvořit účet' : 'Přihlásit se';
  $('#auth-switch-text').textContent = state.isSignUp ? 'Už účet máte?' : 'Ještě nemáte účet?';
  $('#auth-toggle').textContent = state.isSignUp ? 'Přihlásit se' : 'Vytvořit účet';
  $('#password').autocomplete = state.isSignUp ? 'new-password' : 'current-password';
  $('#auth-message').textContent = '';
});
$('#auth-form').addEventListener('submit', async event => {
  event.preventDefault(); const email = $('#email').value.trim(); const password = $('#password').value;
  $('#auth-submit').disabled = true; $('#auth-message').textContent = state.isSignUp ? 'Vytvářím účet…' : 'Přihlašuji…';
  try {
    const result = state.isSignUp ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    if (state.isSignUp && !result.data.session) {
      $('#auth-message').textContent = 'Účet je vytvořený. Potvrďte registraci odkazem v e-mailu a potom se přihlaste.';
      return;
    }
    $('#auth-message').textContent = '';
    if (result.data.session) await showApp(result.data.user);
  } catch (error) { $('#auth-message').textContent = errorMessage(error); }
  finally { $('#auth-submit').disabled = false; }
});
$('#sign-out').addEventListener('click', async () => { const { error } = await supabase.auth.signOut(); if (error) toast(error.message, true); });
supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) showApp(session.user);
  else { $('#app-view').hidden = true; $('#auth-view').hidden = false; state.activeClass = null; state.classes = []; }
});

async function showApp(user) {
  $('#auth-view').hidden = true; $('#app-view').hidden = false; $('#user-email').textContent = user.email || '';
  try {
    await loadClasses();
    if (!state.classes.length) {
      const { data, error } = await supabase.from('classes').insert({ name: 'Moje třída', rows: 4, desks_per_row: 5 }).select().single();
      if (error) throw error;
      await loadClasses(); await loadClass(data.id);
    } else {
      const savedId = localStorage.getItem('zasedak.activeClass');
      await loadClass(state.classes.some(c => c.id === savedId) ? savedId : state.classes[0].id);
    }
  } catch (error) { toast(`${errorMessage(error)} Zkontrolujte, že jste v Supabase spustil(a) soubor supabase/schema.sql.`, true); }
}
async function loadClasses() {
  const { data, error } = await supabase.from('classes').select('id,name,rows,desks_per_row,students(count)').order('created_at');
  if (error) throw error;
  state.classes = data.map(c => ({ id:c.id, name:c.name, rows:c.rows, desksPerRow:c.desks_per_row, studentCount:c.students?.[0]?.count || 0 }));
  renderClasses();
}
async function loadClass(id) {
  const { data: room, error } = await supabase.from('classes').select('id,name,rows,desks_per_row').eq('id', id).single();
  if (error) throw error;
  const { data: students, error: studentError } = await supabase.from('students').select('id,name,seat_index,sort_order').eq('class_id', id).order('sort_order');
  if (studentError) throw studentError;
  state.activeClass = { id:room.id, name:room.name, rows:room.rows, desksPerRow:room.desks_per_row, students:students.map(s => ({ id:s.id, name:s.name, seatIndex:s.seat_index, sortOrder:s.sort_order })) };
  state.selectedId = null; localStorage.setItem('zasedak.activeClass', id); $('#student-names').value = state.activeClass.students.map(s => s.name).join('\n'); render();
}
function render() {
  if (!state.activeClass) return;
  const room = state.activeClass, inSeats = seated();
  $('#page-title').textContent = room.name; $('#breadcrumb-name').textContent = room.name; $('#class-name').value = room.name;
  $('#student-count').textContent = room.students.length; $('#seat-count').textContent = Math.max(0, capacity() - inSeats.length); $('#assigned-count').textContent = inSeats.length;
  $('#roster-count').textContent = room.students.length; $('#roster-subtitle').textContent = room.students.length ? `${inSeats.length} z ${room.students.length} usazeno` : 'Přidejte děti do třídy'; $('#desk-number').textContent = room.desksPerRow;
  renderClasses(); renderSeats(); renderStudentList();
}
function renderClasses() {
  if (!state.activeClass) return;
  $('#class-list').innerHTML = state.classes.map(c => `<button class="class-item ${c.id === state.activeClass.id ? 'active' : ''}" data-id="${c.id}"><span>▦</span><span class="class-item-name">${esc(c.name)}</span><small>${c.studentCount}</small></button>`).join('');
  document.querySelectorAll('.class-item').forEach(button => button.addEventListener('click', () => loadClass(button.dataset.id).catch(e => toast(errorMessage(e), true))));
}
function renderSeats() {
  const grid = $('#desk-grid'); grid.style.setProperty('--columns', state.activeClass.desksPerRow);
  const bySeat = new Map(seated().map(s => [s.seatIndex, s])); let html = '';
  for (let row = 0; row < state.activeClass.rows; row++) {
    html += `<div class="desk-row" aria-label="Řada ${row + 1}">`;
    for (let desk = 0; desk < state.activeClass.desksPerRow; desk++) {
      const start = (row * state.activeClass.desksPerRow + desk) * 2;
      html += `<div class="desk"><div class="desk-top"><span class="desk-label">${String(desk + 1).padStart(2, '0')}</span><div class="desk-seats">${[0,1].map(side => {
        const index = start + side, student = bySeat.get(index), selected = student && state.selectedId === student.id;
        return `<button class="seat ${student ? 'occupied' : 'empty'} ${selected ? 'selected' : ''}" data-seat="${index}" data-student="${student?.id || ''}" ${student ? 'draggable="true"' : ''} style="${student ? `--student-color:${palette[student.id.charCodeAt(0) % palette.length]}` : ''}" aria-label="${student ? esc(student.name) : 'Volné místo'}">${student ? `<span class="student-avatar">${esc(student.name.trim()[0]?.toUpperCase() || '?')}</span><span class="seat-name">${esc(student.name)}</span>` : '<span class="seat-plus">＋</span>'}</button>`;
      }).join('')}</div></div><div class="desk-leg"></div></div>`;
    }
    html += '</div>';
  }
  grid.innerHTML = html;
  grid.querySelectorAll('.seat').forEach(seat => {
    seat.addEventListener('click', () => { const occupant = seat.dataset.student; if (state.selectedId) moveStudent(state.selectedId, Number(seat.dataset.seat)); else if (occupant) { state.selectedId = occupant; render(); } });
    seat.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', seat.dataset.student); e.dataTransfer.effectAllowed = 'move'; });
    seat.addEventListener('dragover', e => { e.preventDefault(); seat.classList.add('drag-over'); }); seat.addEventListener('dragleave', () => seat.classList.remove('drag-over'));
    seat.addEventListener('drop', e => { e.preventDefault(); seat.classList.remove('drag-over'); moveStudent(e.dataTransfer.getData('text/plain'), Number(seat.dataset.seat)); });
  });
}
function renderStudentList() {
  const sorted = [...state.activeClass.students].sort((a,b) => a.name.localeCompare(b.name, 'cs'));
  $('#student-list').innerHTML = sorted.length ? sorted.map(s => {
    const hasSeat = s.seatIndex !== null && s.seatIndex !== undefined;
    return `<button class="student-row ${hasSeat ? 'seated' : ''} ${state.selectedId === s.id ? 'chosen' : ''}" data-id="${s.id}" draggable="true"><span class="student-avatar" style="--student-color:${palette[s.id.charCodeAt(0) % palette.length]}">${esc(s.name.trim()[0]?.toUpperCase() || '?')}</span><span class="student-row-name">${esc(s.name)}</span><span class="student-row-state">${hasSeat ? 'Usazeno' : 'Volný'}</span></button>`;
  }).join('') : '<div class="empty-roster">Zatím tu nikdo není.<br>Jména přidejte výše.</div>';
  $('#student-list').querySelectorAll('.student-row').forEach(row => {
    row.addEventListener('click', () => { state.selectedId = state.selectedId === row.dataset.id ? null : row.dataset.id; render(); });
    row.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', row.dataset.id); e.dataTransfer.effectAllowed = 'move'; });
    row.addEventListener('dragover', e => e.preventDefault()); row.addEventListener('drop', e => { e.preventDefault(); moveStudent(e.dataTransfer.getData('text/plain'), null); });
  });
}
async function saveSeats() {
  const { error } = await supabase.from('students').upsert(state.activeClass.students.map(s => ({ id:s.id, class_id:state.activeClass.id, name:s.name, seat_index:s.seatIndex, sort_order:s.sortOrder || 0 })));
  if (error) throw error;
}
async function moveStudent(studentId, seatIndex) {
  const student = state.activeClass.students.find(s => s.id === studentId); if (!student) return;
  const before = state.activeClass.students.map(s => ({ id:s.id, seatIndex:s.seatIndex }));
  const target = seatIndex === null ? null : Number(seatIndex);
  const other = target === null ? null : state.activeClass.students.find(s => s.seatIndex === target && s.id !== studentId);
  student.seatIndex = target; if (other) other.seatIndex = before.find(s => s.id === studentId).seatIndex ?? null;
  state.selectedId = null; render(); setSaving(true);
  try { await saveSeats(); await loadClasses(); setSaving(false); }
  catch (error) { before.forEach(old => { const s = state.activeClass.students.find(x => x.id === old.id); if (s) s.seatIndex = old.seatIndex; }); render(); setSaving(false); toast(errorMessage(error), true); }
}
$('#add-class').addEventListener('click', async () => {
  const name = prompt('Název nové třídy:', `Třída ${state.classes.length + 1}`); if (!name?.trim()) return;
  const { data, error } = await supabase.from('classes').insert({ name:name.trim().slice(0,80), rows:4, desks_per_row:5 }).select('id').single();
  if (error) return toast(errorMessage(error), true);
  try { await loadClasses(); await loadClass(data.id); toast('Nová třída je připravená.'); } catch (e) { toast(errorMessage(e), true); }
});
$('#save-roster').addEventListener('click', async () => {
  const names = $('#student-names').value.split(/\r?\n/).map(x => x.trim().slice(0,80)).filter(Boolean);
  if (names.length > 100) return toast('Do jedné třídy lze přidat nejvýše 100 žáků.', true);
  setSaving(true);
  try {
    const existing = new Map();
    state.activeClass.students.forEach(s => { const key = s.name.toLocaleLowerCase('cs'); if (!existing.has(key)) existing.set(key, []); existing.get(key).push(s); });
    const kept = [];
    for (let i=0; i<names.length; i++) {
      const name = names[i], old = existing.get(name.toLocaleLowerCase('cs'))?.shift();
      if (old) { const { error } = await supabase.from('students').update({ name, sort_order:i }).eq('id', old.id); if (error) throw error; kept.push(old.id); }
      else { const { data, error } = await supabase.from('students').insert({ class_id:state.activeClass.id, name, sort_order:i }).select('id').single(); if (error) throw error; kept.push(data.id); }
    }
    const removeIds = state.activeClass.students.map(s => s.id).filter(id => !kept.includes(id));
    if (removeIds.length) { const { error } = await supabase.from('students').delete().in('id', removeIds); if (error) throw error; }
    await loadClass(state.activeClass.id); await loadClasses(); setSaving(false); toast('Seznam žáků byl uložen.');
  } catch (error) { setSaving(false); toast(errorMessage(error), true); }
});
async function updateRoom(changes) {
  setSaving(true);
  const payload = { name:state.activeClass.name, rows:state.activeClass.rows, desks_per_row:state.activeClass.desksPerRow, ...changes };
  const { error } = await supabase.from('classes').update(payload).eq('id', state.activeClass.id);
  if (error) { setSaving(false); return toast(errorMessage(error), true); }
  try { await loadClass(state.activeClass.id); await loadClasses(); setSaving(false); } catch (e) { setSaving(false); toast(errorMessage(e), true); }
}
$('#class-name').addEventListener('change', () => updateRoom({ name:$('#class-name').value.trim() || 'Nová třída' }));
$('#less-desks').addEventListener('click', () => { if (state.activeClass.desksPerRow > 1) updateRoom({ desks_per_row:state.activeClass.desksPerRow - 1 }); });
$('#more-desks').addEventListener('click', () => { if (state.activeClass.desksPerRow < 8) updateRoom({ desks_per_row:state.activeClass.desksPerRow + 1 }); });
$('#randomize').addEventListener('click', async () => {
  const students = state.activeClass.students; if (students.length > capacity()) return toast('Ve třídě není dost míst pro všechny žáky.', true);
  const previous = students.map(s => ({ id:s.id, seatIndex:s.seatIndex }));
  const shuffled = [...students]; for (let i=shuffled.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]; }
  students.forEach(s => s.seatIndex = null); shuffled.forEach((s,i) => s.seatIndex = i); render(); setSaving(true);
  try { await saveSeats(); await loadClasses(); setSaving(false); toast('Žáci byli náhodně rozmístěni.'); }
  catch (e) { previous.forEach(old => { const s=students.find(x=>x.id===old.id); if(s) s.seatIndex=old.seatIndex; }); render(); setSaving(false); toast(errorMessage(e),true); }
});
$('#clear-seats').addEventListener('click', async () => {
  if (!seated().length) return toast('Všechna místa už jsou volná.');
  const previous=state.activeClass.students.map(s=>({id:s.id,seatIndex:s.seatIndex})); state.activeClass.students.forEach(s=>s.seatIndex=null); state.selectedId=null; render(); setSaving(true);
  try { await saveSeats(); await loadClasses(); setSaving(false); toast('Všechna místa jsou nyní volná.'); }
  catch(e) { previous.forEach(old=>{const s=state.activeClass.students.find(x=>x.id===old.id);if(s)s.seatIndex=old.seatIndex;});render();setSaving(false);toast(errorMessage(e),true); }
});
$('#delete-class').addEventListener('click', async () => {
  if (state.classes.length <= 1) return toast('Poslední třídu nelze smazat.', true);
  if (!confirm(`Opravdu smazat třídu „${state.activeClass.name}“ a její zasedací pořádek?`)) return;
  const { error }=await supabase.from('classes').delete().eq('id',state.activeClass.id); if(error)return toast(errorMessage(error),true);
  localStorage.removeItem('zasedak.activeClass'); try { await loadClasses(); await loadClass(state.classes[0].id); toast('Třída byla smazána.'); } catch(e) { toast(errorMessage(e),true); }
});

const confirmationParams = new URLSearchParams(window.location.search);
const hasConfirmationHash = window.location.hash.includes('type=email_confirmation') || window.location.hash.includes('type=signup');

supabase.auth.getSession().then(({data,error}) => {
  if (error) { $('#auth-message').textContent = error.message; return; }
  if (data.session) {
    showApp(data.session.user);
  } else if (confirmationParams.has('confirmation') || hasConfirmationHash) {
    $('#auth-message').textContent = 'E-mail byl potvrzen. Účet byl úspěšně vytvořen — nyní se můžete přihlásit.';
  }

  if (hasConfirmationHash || confirmationParams.has('confirmation')) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});
