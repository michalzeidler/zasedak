import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  'https://jukkbhcgriohapmlmdfo.supabase.co',
  'sb_publishable_aEXip-ChEGGAzZzGexKdjQ_YbLzRHOh'
);
const $ = selector => document.querySelector(selector);
const page = document.body.dataset.page;
const status = $('#page-status');
const content = $('#directory-content');

function esc(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
}

function showError(message) {
  if (!status) return;
  status.textContent = message;
  status.classList.add('error');
}

function showToast(message, isError = false) {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 3500);
}

function addMenu() {
  const email = $('#user-email');
  const host = $('.topbar-right') || $('.directory-user-area');
  if (!email || !host || $('#user-menu')) return;

  const style = document.createElement('style');
  style.textContent = `.user-menu{position:relative}.user-menu-trigger{display:flex;align-items:center;gap:9px;min-height:38px;padding:8px 11px;border:1px solid var(--line,#e9ebe6);border-radius:12px;background:#fff;color:var(--ink,#202a35);cursor:pointer}.user-menu-panel{position:absolute;z-index:40;top:calc(100% + 8px);right:0;width:220px;padding:7px;border:1px solid var(--line,#e9ebe6);border-radius:14px;background:#fff;box-shadow:0 14px 36px #202a351f}.user-menu-panel[hidden]{display:none}.user-menu-link,.user-menu-action{display:flex;width:100%;align-items:center;padding:11px 12px;border:0;border-radius:9px;background:transparent;color:var(--ink,#202a35);font:500 14px var(--font,'DM Sans',sans-serif);text-decoration:none;cursor:pointer}.user-menu-link:hover,.user-menu-action:hover{background:#f4f7f3}`;
  document.head.append(style);

  const wrapper = document.createElement('div');
  wrapper.className = 'user-menu';
  wrapper.id = 'user-menu';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'user-menu-trigger';
  trigger.setAttribute('aria-expanded', 'false');
  trigger.append(email);

  const panel = document.createElement('nav');
  panel.className = 'user-menu-panel';
  panel.hidden = true;
  const base = `${window.location.origin}/zasedak/`;
  panel.innerHTML = `<a class="user-menu-link" href="${base}">Zasedáky</a><a class="user-menu-link" href="${base}seznamy/">Seznam žáků</a><a class="user-menu-link" href="${base}ucebny/">Učebny</a><a class="user-menu-link" href="${base}admin/" data-admin-link hidden>Admin</a><button type="button" class="user-menu-action" data-sign-out>Odhlásit se</button>`;
  wrapper.append(trigger, panel);
  host.append(wrapper);

  trigger.addEventListener('click', () => {
    const open = trigger.getAttribute('aria-expanded') === 'true';
    trigger.setAttribute('aria-expanded', String(!open));
    panel.hidden = open;
  });
  document.addEventListener('click', event => { if (!wrapper.contains(event.target)) panel.hidden = true; });
  panel.addEventListener('click', async event => {
    if (event.target.closest('[data-sign-out]')) {
      const { error } = await supabase.auth.signOut();
      if (error) showToast(error.message, true);
      else window.location.replace('../');
    }
  });

  supabase.from('profiles').select('role').maybeSingle().then(({ data, error }) => {
    const admin = panel.querySelector('[data-admin-link]');
    if (admin) admin.hidden = Boolean(error) || data?.role !== 'admin';
  });
}

async function init() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) {
    window.location.replace('../');
    return;
  }

  const email = $('#user-email');
  if (email) email.textContent = sessionData.session.user.email || '';
  addMenu();

  if (page === 'students') {
    await renderStudents();
  } else {
    await renderClassrooms();
  }
  if (status) status.textContent = '';
}

async function renderStudents() {
  const { data: rooms, error: roomError } = await supabase
    .from('classes')
    .select('id,name')
    .order('created_at');
  if (roomError) throw roomError;

  const { data: students, error: studentError } = await supabase
    .from('students')
    .select('id,class_id,name,sort_order')
    .order('sort_order');
  if (studentError) throw studentError;

  const studentsByClass = new Map();
  for (const student of students || []) {
    if (!studentsByClass.has(student.class_id)) studentsByClass.set(student.class_id, []);
    studentsByClass.get(student.class_id).push(student);
  }

  const classRows = (rooms || []).map(room => ({
    ...room,
    students: (studentsByClass.get(room.id) || []).sort((a, b) => a.name.localeCompare(b.name, 'cs'))
  }));

  if (!classRows.length) {
    content.innerHTML = '<div class="directory-empty">Zatím nemáte žádné učebny ani žáky.</div>';
    return;
  }

  content.innerHTML = `<div class="student-class-tiles">${classRows.map(room => `<button type="button" class="student-class-tile" data-class-id="${esc(room.id)}"><span class="student-class-tile-icon">▦</span><span class="student-class-tile-name">${esc(room.name)}</span><span class="student-class-tile-count">${room.students.length} žáků</span></button>`).join('')}</div><section id="student-class-detail" class="student-class-detail" hidden></section>`;

  const detail = $('#student-class-detail');
  content.querySelectorAll('.student-class-tile').forEach(tile => {
    tile.addEventListener('click', async () => {
      const room = classRows.find(item => item.id === tile.dataset.classId);
      if (!room) return;

      content.querySelectorAll('.student-class-tile').forEach(button => button.classList.toggle('selected', button === tile));

      const { data: rules, error: ruleError } = await supabase
        .from('student_seating_exclusions')
        .select('student_id,excluded_student_id')
        .eq('class_id', room.id);

      if (ruleError) {
        showError(ruleError.message);
        return;
      }

      const ruleMap = new Map();
      for (const rule of rules || []) {
        if (!ruleMap.has(rule.student_id)) ruleMap.set(rule.student_id, new Set());
        ruleMap.get(rule.student_id).add(rule.excluded_student_id);
      }

      detail.hidden = false;
      detail.innerHTML = `<div class="student-table-heading"><div><div class="eyebrow">SEZNAM TŘÍDY</div><h2>${esc(room.name)}</h2></div><button type="button" class="student-table-back">Zpět na třídy</button></div>${room.students.length ? `<div class="student-table-scroll"><table class="student-rules-table"><thead><tr><th>Jméno žáka</th><th>Nemá sedět s</th></tr></thead><tbody>${room.students.map(student => { const selected = ruleMap.get(student.id) || new Set(); const names = room.students.filter(other => other.id !== student.id && selected.has(other.id)).map(other => other.name); return `<tr><th>${esc(student.name)}</th><td><button type="button" class="student-rule-picker" data-student-id="${esc(student.id)}"><span class="student-rule-value">${names.length ? esc(names.join(', ')) : 'Vybrat žáky'}</span><span>⌄</span></button></td></tr>`; }).join('')}</tbody></table></div><div id="student-rule-popover" class="student-rule-popover" hidden></div>` : '<div class="directory-empty">V této třídě zatím nejsou žádní žáci.</div>'}`;

      detail.querySelector('.student-table-back').addEventListener('click', () => {
        detail.hidden = true;
        content.querySelectorAll('.student-class-tile').forEach(button => button.classList.remove('selected'));
      });

      const popover = $('#student-rule-popover');
      detail.querySelectorAll('.student-rule-picker').forEach(picker => {
        picker.addEventListener('click', event => {
          event.stopPropagation();
          const currentId = picker.dataset.studentId;
          const eligible = room.students.filter(other => other.id !== currentId);
          const selected = ruleMap.get(currentId) || new Set();
          popover.innerHTML = `<div class="student-rule-popover-title">Nemá sedět s</div><div class="student-rule-options">${eligible.map(other => `<label class="student-rule-option"><input type="checkbox" value="${esc(other.id)}" ${selected.has(other.id) ? 'checked' : ''}><span>${esc(other.name)}</span></label>`).join('')}</div><button type="button" class="student-rule-done">Hotovo</button>`;
          const rect = picker.getBoundingClientRect();
          popover.hidden = false;
          popover.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - 272))}px`;
          popover.style.top = `${Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 280))}px`;

          popover.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', async () => {
              input.disabled = true;
              const result = input.checked
                ? await supabase.from('student_seating_exclusions').upsert({ class_id:room.id, student_id:currentId, excluded_student_id:input.value }, { onConflict:'class_id,student_id,excluded_student_id' })
                : await supabase.from('student_seating_exclusions').delete().eq('class_id', room.id).eq('student_id', currentId).eq('excluded_student_id', input.value);
              input.disabled = false;
              if (result.error) {
                input.checked = !input.checked;
                showToast(result.error.message, true);
                return;
              }
              if (input.checked) selected.add(input.value);
              else selected.delete(input.value);
              ruleMap.set(currentId, selected);
              const names = eligible.filter(other => selected.has(other.id)).map(other => other.name);
              picker.querySelector('.student-rule-value').textContent = names.length ? names.join(', ') : 'Vybrat žáky';
              showToast('Pravidlo bylo uloženo.');
            });
          });
          popover.querySelector('.student-rule-done').addEventListener('click', () => popover.hidden = true);
        });
      });

      detail.scrollIntoView({ behavior:'smooth', block:'start' });
    });
  });

  document.addEventListener('click', event => {
    const popover = $('#student-rule-popover');
    if (popover && !popover.hidden && !popover.contains(event.target) && !event.target.closest('.student-rule-picker')) popover.hidden = true;
  });
}

async function renderClassrooms() {
  const { data: rooms, error } = await supabase
    .from('classes')
    .select('id,name,rows,desks_per_row')
    .order('created_at');
  if (error) throw error;

  const { data: students, error: studentError } = await supabase
    .from('students')
    .select('class_id');
  if (studentError) throw studentError;

  const counts = new Map();
  for (const student of students || []) counts.set(student.class_id, (counts.get(student.class_id) || 0) + 1);

  content.innerHTML = (rooms || []).length
    ? rooms.map(room => `<article class="directory-card classroom-card"><div class="classroom-card-header"><div><h2>${esc(room.name)}</h2><p>Učebna a zasedací pořádek</p></div><span>${counts.get(room.id) || 0} / ${room.rows * room.desks_per_row * 2} míst</span></div><div>${room.rows} řad · ${room.desks_per_row} lavic v řadě</div><a class="classroom-open" href="../?class=${encodeURIComponent(room.id)}">Otevřít učebnu</a></article>`).join('')
    : '<div class="directory-empty">Zatím nemáte žádné učebny.</div>';
}

init().catch(error => showError(error.message || 'Stránku se nepodařilo načíst.'));
