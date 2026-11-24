import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

$('#page-sign-out').addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut();
  if (error) showError(error.message);
  else window.location.href = '../';
});

async function init() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) {
    window.location.replace('../');
    return;
  }

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
      content.innerHTML = classes.map(room => {
        const students = [...(room.students || [])].sort((a, b) => a.name.localeCompare(b.name, 'cs'));
        return `<article class="directory-card"><h2>${escapeHtml(room.name)}</h2><p class="directory-card-subtitle">${students.length} ${students.length === 1 ? 'žák' : students.length >= 2 && students.length <= 4 ? 'žáci' : 'žáků'}</p>${students.length ? `<div class="directory-student-list">${students.map(student => `<span class="directory-student">${escapeHtml(student.name)}</span>`).join('')}</div>` : '<div class="directory-empty">V této třídě zatím nejsou žádní žáci.</div>'}</article>`;
      }).join('');
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
