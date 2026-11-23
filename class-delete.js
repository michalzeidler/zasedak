import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  'https://jukkbhcgriohapmlmdfo.supabase.co',
  'sb_publishable_aEXip-ChEGGAzZzGexKdjQ_YbLzRHOh'
);
const classList = document.querySelector('#class-list');

function addDeleteButtons() {
  const classes = [...classList.querySelectorAll('.class-item')];
  for (const item of classes) {
    if (item.parentElement.classList.contains('class-item-row')) continue;
    const row = document.createElement('div');
    row.className = 'class-item-row';
    item.before(row);
    row.append(item);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'class-delete-button';
    remove.setAttribute('aria-label', `Smazat třídu ${item.querySelector('.class-item-name')?.textContent || ''}`);
    remove.title = 'Smazat třídu';
    remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg>';
    row.append(remove);
    remove.addEventListener('click', async event => {
      event.stopPropagation();
      if (classes.length <= 1) {
        window.alert('Poslední třídu nelze smazat.');
        return;
      }
      const name = item.querySelector('.class-item-name')?.textContent || 'tuto třídu';
      if (!window.confirm(`Opravdu smazat třídu „${name}“ včetně žáků a zasedacího pořádku?`)) return;
      remove.disabled = true;
      const { error } = await supabase.from('classes').delete().eq('id', item.dataset.id);
      if (error) {
        window.alert(`Třídu se nepodařilo smazat: ${error.message}`);
        remove.disabled = false;
        return;
      }
      window.location.reload();
    });
  }
}

new MutationObserver(addDeleteButtons).observe(classList, { childList: true });
addDeleteButtons();
