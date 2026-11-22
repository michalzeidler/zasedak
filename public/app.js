const $ = (selector) => document.querySelector(selector);
const state = { classes: [], activeClass: null, selectedId: null, saving: false, toastTimer: null };
const palette = ['#e9e4fa', '#fce9df', '#dff1e8', '#e3eff8', '#f9efce', '#f8e2eb', '#e9edda'];

async function api(url, options = {}) {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  if (!response.ok) {
    let message = 'Něco se nepovedlo. Zkuste to prosím znovu.';
    try { message = (await response.json()).error || message; } catch {}
    throw new Error(message);
  }
  return response.status === 204 ? null : response.json();
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
function showToast(message, isError = false) {
  const toast = $('#toast'); toast.textContent = message; toast.classList.toggle('error', isError); toast.classList.add('visible');
  clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => toast.classList.remove('visible'), 2800);
}
function setSaving(saving) {
  state.saving = saving;
  const label = $('#save-status'); label.classList.toggle('is-saving', saving);
  label.innerHTML = `<i></i> ${saving ? 'Ukládám…' : 'Uloženo'}`;
}
function seatCapacity() { return state.activeClass.rows * state.activeClass.desksPerRow * 2; }
function occupiedStudents() { return state.activeClass.students.filter(student => student.seatIndex !== null && student.seatIndex !== undefined); }
function render() {
  if (!state.activeClass) return;
  const room = state.activeClass; const occupied = occupiedStudents();
  $('#page-title').textContent = room.name; $('#breadcrumb-name').textContent = room.name;
  $('#class-name').value = room.name; $('#desk-number').textContent = room.desksPerRow;
  $('#student-count').textContent = room.students.length;
  $('#seat-count').textContent = Math.max(0, seatCapacity() - occupied.length);
  $('#assigned-count').textContent = occupied.length;
  $('#roster-count').textContent = room.students.length;
  $('#roster-subtitle').textContent = room.students.length ? `${occupied.length} z ${room.students.length} usazeno` : 'Přidejte děti do třídy';
  renderClasses(); renderSeats(); renderStudentList();
}
function renderClasses() {
  $('#class-list').innerHTML = state.classes.map(item => `<button class="class-item ${item.id === state.activeClass.id ? 'active' : ''}" data-class-id="${item.id}"><span class="class-icon">▦</span><span class="class-item-name">${escapeHtml(item.name)}</span><span class="class-item-count">${item.studentCount}</span></button>`).join('');
  document.querySelectorAll('.class-item').forEach(button => button.addEventListener('click', () => loadClass(Number(button.dataset.classId))));
}
function renderSeats() {
  const container = $('#desk-grid'); container.style.setProperty('--columns', state.activeClass.desksPerRow);
  const studentsBySeat = new Map(occupiedStudents().map(student => [student.seatIndex, student]));
  let html = '';
  for (let row = 0; row < state.activeClass.rows; row++) {
    html += `<div class="desk-row" aria-label="Řada ${row + 1}">`;
    for (let desk = 0; desk < state.activeClass.desksPerRow; desk++) {
      const firstSeat = (row * state.activeClass.desksPerRow + desk) * 2;
      html += `<div class="desk" aria-label="Lavice ${row + 1}-${desk + 1}"><div class="desk-top"><span class="desk-label">${String(desk + 1).padStart(2, '0')}</span><div class="desk-seats">${[0, 1].map(side => {
        const index = firstSeat + side; const student = studentsBySeat.get(index); const selected = student && state.selectedId === student.id;
        const color = student ? palette[(student.id - 1) % palette.length] : '';
        return `<button class="seat ${student ? 'occupied' : 'empty'} ${selected ? 'selected' : ''}" data-seat="${index}" data-student="${student ? student.id : ''}" ${student ? 'draggable="true"' : ''} style="${color ? `--student-color:${color}` : ''}" aria-label="${student ? escapeHtml(student.name) : 'Volné místo'}" title="${student ? escapeHtml(student.name) : 'Volné místo'}">${student ? `<span class="student-avatar">${escapeHtml(student.name.trim().charAt(0).toUpperCase())}</span><span class="seat-name">${escapeHtml(student.name)}</span>` : '<span class="seat-plus">＋</span>'}</button>`;
      }).join('')}</div></div><div class="desk-leg"></div></div>`;
    }
    html += '</div>';
  }
  container.innerHTML = html;
  container.querySelectorAll('.seat').forEach(seat => {
    seat.addEventListener('click', () => onSeatClick(seat));
    seat.addEventListener('dragstart', event => { const id = Number(seat.dataset.student); event.dataTransfer.setData('text/plain', String(id)); event.dataTransfer.effectAllowed = 'move'; state.selectedId = id; });
    seat.addEventListener('dragover', event => { event.preventDefault(); seat.classList.add('drag-over'); });
    seat.addEventListener('dragleave', () => seat.classList.remove('drag-over'));
    seat.addEventListener('drop', event => { event.preventDefault(); seat.classList.remove('drag-over'); moveStudent(Number(event.dataTransfer.getData('text/plain')), Number(seat.dataset.seat)); });
  });
}
function renderStudentList() {
  const sorted = [...state.activeClass.students].sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  $('#student-list').innerHTML = sorted.length ? sorted.map(student => {
    const seated = student.seatIndex !== null && student.seatIndex !== undefined;
    return `<button class="student-row ${seated ? 'seated' : ''} ${state.selectedId === student.id ? 'chosen' : ''}" data-student="${student.id}" draggable="true"><span class="student-avatar" style="--student-color:${palette[(student.id - 1) % palette.length]}">${escapeHtml(student.name.trim().charAt(0).toUpperCase())}</span><span class="student-row-name">${escapeHtml(student.name)}</span><span class="student-row-state">${seated ? 'Usazeno' : 'Volné'}</span></button>`;
  }).join('') : '<div class="empty-roster">Zatím tu nikdo není.<br>Jména přidejte výše.</div>';
  $('#student-list').querySelectorAll('.student-row').forEach(row => {
    row.addEventListener('click', () => { state.selectedId = state.selectedId === Number(row.dataset.student) ? null : Number(row.dataset.student); render(); });
    row.addEventListener('dragstart', event => { event.dataTransfer.setData('text/plain', row.dataset.student); event.dataTransfer.effectAllowed = 'move'; });
    row.addEventListener('dragover', event => event.preventDefault());
    row.addEventListener('drop', event => { event.preventDefault(); const id = Number(event.dataTransfer.getData('text/plain')); moveStudent(id, null); });
  });
}
function onSeatClick(button) {
  const occupant = button.dataset.student ? Number(button.dataset.student) : null;
  const seat = Number(button.dataset.seat);
  if (state.selectedId !== null) {
    moveStudent(state.selectedId, seat);
  } else if (occupant) {
    state.selectedId = occupant; render();
  }
}
async function moveStudent(studentId, seatIndex) {
  const student = state.activeClass.students.find(item => item.id === studentId);
  if (!student) return;
  const target = seatIndex === null ? null : Number(seatIndex);
  const other = target === null ? null : state.activeClass.students.find(item => item.seatIndex === target && item.id !== studentId);
  const previous = state.activeClass.students.map(item => ({ id: item.id, seatIndex: item.seatIndex }));
  student.seatIndex = target;
  if (other) other.seatIndex = previous.find(item => item.id === studentId).seatIndex ?? null;
  state.selectedId = null; render(); setSaving(true);
  try {
    await api(`/api/classes/${state.activeClass.id}/seating`, { method: 'PUT', body: JSON.stringify({ students: state.activeClass.students.map(item => ({ id: item.id, seatIndex: item.seatIndex })) }) });
    await refreshClasses(); setSaving(false);
  } catch (error) {
    for (const old of previous) { const item = state.activeClass.students.find(current => current.id === old.id); if (item) item.seatIndex = old.seatIndex; }
    render(); setSaving(false); showToast(error.message, true);
  }
}
async function refreshClasses() { state.classes = await api('/api/classes'); renderClasses(); }
async function loadClass(id) {
  try {
    state.activeClass = await api(`/api/classes/${id}`); state.selectedId = null;
    $('#student-names').value = state.activeClass.students.map(student => student.name).join('\n'); render();
  } catch (error) { showToast(error.message, true); }
}
async function updateRoom(changes) {
  try {
    setSaving(true);
    state.activeClass = await api(`/api/classes/${state.activeClass.id}`, { method: 'PUT', body: JSON.stringify({ name: state.activeClass.name, rows: state.activeClass.rows, desksPerRow: state.activeClass.desksPerRow, ...changes }) });
    await refreshClasses(); render(); setSaving(false);
  } catch (error) { setSaving(false); showToast(error.message, true); }
}
$('#add-class').addEventListener('click', async () => {
  try { const room = await api('/api/classes', { method: 'POST', body: JSON.stringify({ name: `Třída ${state.classes.length + 1}` }) }); await refreshClasses(); await loadClass(room.id); showToast('Nová třída je připravená.'); }
  catch (error) { showToast(error.message, true); }
});
$('#save-roster').addEventListener('click', async () => {
  const names = $('#student-names').value.split(/\r?\n/).map(name => name.trim()).filter(Boolean);
  if (names.length > 100) return showToast('Do jedné třídy lze přidat nejvýše 100 žáků.', true);
  try {
    setSaving(true);
    state.activeClass = await api(`/api/classes/${state.activeClass.id}/students`, { method: 'POST', body: JSON.stringify({ names }) });
    state.selectedId = null; await refreshClasses(); render(); setSaving(false); showToast('Seznam žáků byl uložen.');
  } catch (error) { setSaving(false); showToast(error.message, true); }
});
$('#class-name').addEventListener('change', () => updateRoom({ name: $('#class-name').value.trim() || 'Nová třída' }));
$('#less-desks').addEventListener('click', () => { if (state.activeClass.desksPerRow > 1) updateRoom({ desksPerRow: state.activeClass.desksPerRow - 1 }); });
$('#more-desks').addEventListener('click', () => { if (state.activeClass.desksPerRow < 8) updateRoom({ desksPerRow: state.activeClass.desksPerRow + 1 }); });
$('#randomize').addEventListener('click', async () => {
  const students = [...state.activeClass.students];
  if (students.length > seatCapacity()) return showToast('Ve třídě není dost míst pro všechny žáky.', true);
  for (let i = students.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [students[i], students[j]] = [students[j], students[i]]; }
  students.forEach((student, index) => { student.seatIndex = index; }); state.activeClass.students = students; render(); setSaving(true);
  try { await api(`/api/classes/${state.activeClass.id}/seating`, { method: 'PUT', body: JSON.stringify({ students: students.map(item => ({ id: item.id, seatIndex: item.seatIndex })) }) }); await refreshClasses(); setSaving(false); showToast('Žáci byli náhodně rozmístěni.'); }
  catch (error) { setSaving(false); showToast(error.message, true); }
});
$('#clear-seats').addEventListener('click', async () => {
  if (!occupiedStudents().length) return showToast('Všechna místa už jsou volná.');
  state.activeClass.students.forEach(student => { student.seatIndex = null; }); state.selectedId = null; render(); setSaving(true);
  try { await api(`/api/classes/${state.activeClass.id}/seating`, { method: 'PUT', body: JSON.stringify({ students: state.activeClass.students.map(item => ({ id: item.id, seatIndex: null })) }) }); await refreshClasses(); setSaving(false); showToast('Všechna místa jsou nyní volná.'); }
  catch (error) { setSaving(false); showToast(error.message, true); }
});
$('#delete-class').addEventListener('click', async () => {
  if (state.classes.length <= 1) return showToast('Poslední třídu nelze smazat.', true);
  if (!confirm(`Opravdu chcete smazat třídu „${state.activeClass.name}“ a její zasedací pořádek?`)) return;
  try { const oldId = state.activeClass.id; await api(`/api/classes/${oldId}`, { method: 'DELETE' }); await refreshClasses(); await loadClass(state.classes[0].id); showToast('Třída byla smazána.'); }
  catch (error) { showToast(error.message, true); }
});
(async function init() {
  try { await refreshClasses(); if (state.classes.length) await loadClass(state.classes[0].id); }
  catch (error) { $('#page-title').textContent = 'Aplikaci se nepodařilo načíst'; showToast(error.message, true); }
})();
