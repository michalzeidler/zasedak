import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { addAccountMenu } from './account-menu.js';

const supabase = createClient(
  'https://jukkbhcgriohapmlmdfo.supabase.co',
  'sb_publishable_aEXip-ChEGGAzZzGexKdjQ_YbLzRHOh'
);
const $ = selector => document.querySelector(selector);
const page = document.body.dataset.page;
const status = $('#page-status');
const content = $('#directory-content');

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
}
function showError(message) {
  status.textContent = message;
  status.classList.add('error');
}

async function init() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) {
    window.location.replace('../');
    return;
  }
  if ($('#user-email')) $('#user-email').textContent = sessionData.session.user.email || '';
  addAccountMenu(supabase);

  if (page === 'students') {
    const { data, error } = await supabase
      .from('classes')
      .select('id,name,students(id,name,seat_index)')
      .order('created_at');
    if (error) throw error;
    const classes = data || [];
    if (!classes.length) {
      content.innerHTML = '<div class="directory-empty">Zatím nemáte žádné učebny ani žáky. Nejdříve přidejte třídu a seznam žáků v aplikaci.</div>';
    } else {
      const sortedClasses = classes.map(room => ({
        ...room,
        students: [...(room.students || [])].sort((a, b) => a.name.localeCompare(b.name, 'cs'))
      }));
      content.innerHTML = `<div class="student-class-tiles" aria-label="Vaše třídy">${sortedClasses.map(room => `<button type="button" class="student-class-tile" data-class-id="${escapeHtml(room.id)}" aria-pressed="false"><span class="student-class-tile-icon" aria-hidden="true">▦</span><span class="student-class-tile-name">${escapeHtml(room.name)}</span><span class="student-class-tile-count">${room.students.length} ${room.students.length === 1 ? 'žák' : room.students.length >= 2 && room.students.length <= 4 ? 'žáci' : 'žáků'}</span></button>`).join('')}</div><section id="student-class-detail" class="student-class-detail" hidden aria-live="polite"></section>`;

      const detail = $('#student-class-detail');
      content.querySelectorAll('.student-class-tile').forEach(tile => {
        tile.addEventListener('click', () => {
          const room = sortedClasses.find(item => item.id === tile.dataset.classId);
          content.querySelectorAll('.student-class-tile').forEach(button => {
            const selected = button === tile;
            button.classList.toggle('selected', selected);
            button.setAttribute('aria-pressed', String(selected));
          });
          detail.hidden = false;
          detail.innerHTML = `<div class="student-table-heading"><div><div class="eyebrow">SEZNAM TŘÍDY</div><h2>${escapeHtml(room.name)}</h2></div><button type="button" class="student-table-back">Zpět na třídy</button></div>${room.students.length ? `<div class="student-table-scroll"><table class="student-rules-table"><thead><tr><th scope="col">Jméno žáka</th><th scope="col">Nemá sedět s</th></tr></thead><tbody>${room.students.map(student => {
            const storageKey = `zasedak-not-with:${room.id}:${student.id}`;
            let selectedIds = [];
            try { selectedIds = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch (_) {}
            const selectedNames = room.students.filter(other => selectedIds.includes(other.id)).map(other => other.name);
            return `<tr><th scope="row">${escapeHtml(student.name)}</th><td><button type="button" class="student-rule-picker" data-student-id="${escapeHtml(student.id)}" data-storage-key="${escapeHtml(storageKey)}"><span class="student-rule-value">${selectedNames.length ? escapeHtml(selectedNames.join(', ')) : 'Vybrat žáky'}</span><span class="student-rule-chevron" aria-hidden="true">⌄</span></button></td></tr>`;
          }).join('')}</tbody></table></div><div id="student-rule-popover" class="student-rule-popover" hidden></div>` : '<div class="directory-empty">V této třídě zatím nejsou žádní žáci.</div>'}`;

          detail.querySelector('.student-table-back').addEventListener('click', () => {
            detail.hidden = true;
            content.querySelectorAll('.student-class-tile').forEach(button => {
              button.classList.remove('selected');
              button.setAttribute('aria-pressed', 'false');
            });
          });

          const popover = detail.querySelector('#student-rule-popover');
          detail.querySelectorAll('.student-rule-picker').forEach(picker => {
            picker.addEventListener('click', event => {
              event.stopPropagation();
              const currentStudentId = picker.dataset.studentId;
              let selectedIds = [];
              try { selectedIds = JSON.parse(localStorage.getItem(picker.dataset.storageKey) || '[]'); } catch (_) {}

              const rect = picker.getBoundingRect();
              popover.innerHTML = `<div class="student-rule-popover-title">Nemá sedět s</div><div class="student-rule-options">${room.students.filter(other => other.id !== currentStudentId).map(other => `<label class="student-rule-option"><input type="checkbox" value="${escapeHtml(other.id)}" ${selectedIds.includes(other.id) ? 'checked' : ''}><span>${escapeHtml(other.name)}</span></label>`).join('') || '<span class="student-rule-empty">Ve třídě není další žák.</span>'}</div><button type="button" class="student-rule-done">Hotovo</button>`;
              popover.hidden = false;
              popover.style.top = `${rect.bottom + window.scrollY + 8}px`;
              popover.style.left = `${Math.min(rect.left + window.scrollX, window.innerWidth - 270)}px`;

              popover.querySelectorAll('input').forEach(input => {
                input.addEventListener('change', () => {
                  const checkedIds = [...popover.querySelectorAll('input:checked')].map(item => item.value);
                  localStorage.setItem(picker.dataset.storageKey, JSON.stringify(checkedIds));
                  const names = room.students.filter(other => checkedIds.includes(other.id)).map(other => other.name);
                  picker.querySelector('.student-rule-value').textContent = names.length ? names.join(', ') : 'Vybrat žáky';
                });
              });
              popover.querySelector('.student-rule-done').addEventListener('click', () => { popover.hidden = true; });
            });
          });
          detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
      document.addEventListener('click', event => {
        const popover = $('#student-rule-popover');
        if (popover && !popover.hidden && !popover.contains(event.target) && !event.target.closest('.student-rule-picker')) popover.hidden = true;
      });
    }
  } else {
    const { data, error } = await supabase
      .from('classes')
      .select('id,name,rows,desks_per_row,students(count)')
      .order('created_at');
    if (error) throw error;
    const rooms = data || [];
    if (!rooms.length) {
      content.innerHTML = '<div class="directory-empty">Zatím nemáte žádné učebny. Přidejte první třídu v aplikaci.</div>';
    } else {
      content.innerHTML = rooms.map(room => {
        const studentCount = room.students?.[0]?.count || 0;
        const capacity = room.rows * room.desks_per_row * 2;
        return `<article class="directory-card classroom-card"><div class="classroom-card-header"><div><h2>${escapeHtml(room.name)}</h2><p class="directory-card-subtitle">Učebna a zasedací pořádek</p></div><span class="classroom-capacity">${studentCount} / ${capacity} míst</span></div><div class="classroom-details"><span>${room.rows} řad</span><span>·</span><span>${room.desks_per_row} lavic v řadě</span></div><a class="classroom-open" href="../?class=${encodeURIComponent(room.id)}">Otevřít učebnu</a></article>`;
      }).join('');
    }
  }
  status.textContent = '';
}

init().catch(error => showError(error.message || 'Stránku se nepodařilo načíst.'));
