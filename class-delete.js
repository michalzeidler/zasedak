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

function addAccountMenu() {
  const topbarRight = document.querySelector('.topbar-right');
  const email = document.querySelector('#user-email');
  if (!topbarRight || !email || document.querySelector('#user-menu')) return;

  const style = document.createElement('style');
  style.textContent = `
    .user-menu{position:relative;display:flex;align-items:center}
    .user-menu-trigger{display:flex;align-items:center;gap:10px;max-width:min(340px,42vw);padding:8px 11px;border:1px solid var(--line,#e9ebe6);border-radius:12px;background:#fff;color:var(--ink,#202a35);font:600 13px var(--font,'DM Sans',sans-serif);cursor:pointer}
    .user-menu-trigger:hover,.user-menu-trigger[aria-expanded="true"]{border-color:#cbd8ce;background:#fbfcfa}
    .user-menu-trigger:focus-visible,.user-menu-link:focus-visible,.user-menu-action:focus-visible{outline:3px solid #a9cbb5;outline-offset:2px}
    .user-menu-trigger #user-email{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .user-menu-chevron{width:8px;height:8px;flex:none;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg) translateY(-2px);transition:transform .15s ease}
    .user-menu-trigger[aria-expanded="true"] .user-menu-chevron{transform:rotate(225deg) translate(-2px,-1px)}
    .user-menu-panel{position:absolute;z-index:20;top:calc(100% + 9px);right:0;width:220px;padding:7px;border:1px solid var(--line,#e9ebe6);border-radius:14px;background:#fff;box-shadow:0 14px 36px #202a351f}
    .user-menu-panel[hidden]{display:none}
    .user-menu-link,.user-menu-action{display:flex;width:100%;align-items:center;padding:11px 12px;border:0;border-radius:9px;background:transparent;color:var(--ink,#202a35);font:500 14px var(--font,'DM Sans',sans-serif);text-align:left;text-decoration:none;cursor:pointer}
    .user-menu-link:hover,.user-menu-action:hover{background:#f4f7f3;color:#32624f}
    .user-menu-action-danger{color:#a33e3e}
    .user-menu-action-danger:hover{background:#fff4f2;color:#8e3030}
    .user-menu-separator{height:1px;margin:5px 4px;background:var(--line,#e9ebe6)}
    .account-dialog{width:min(440px,calc(100% - 32px));padding:0;border:1px solid var(--line,#e9ebe6);border-radius:18px;color:var(--ink,#202a35);box-shadow:0 20px 60px #202a3530}
    .account-dialog::backdrop{background:#202a3555;backdrop-filter:blur(2px)}
    .account-dialog-content{padding:26px;font-family:var(--font,'DM Sans',sans-serif)}
    .account-dialog h2{margin:0 0 8px;font:700 22px var(--display,'Manrope',sans-serif)}
    .account-dialog p{color:var(--muted,#8a9297);font-size:14px;line-height:1.5}
    .account-dialog label{display:block;margin:20px 0 7px;font-size:13px;font-weight:600}
    .account-dialog input{width:100%;padding:12px;border:1px solid var(--line,#e9ebe6);border-radius:10px;font:inherit}
    .account-dialog-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:22px}
    .account-dialog-actions button{padding:10px 14px;border:1px solid var(--line,#e9ebe6);border-radius:10px;background:#fff;color:var(--ink,#202a35);font:600 13px var(--font,'DM Sans',sans-serif);cursor:pointer}
    .account-dialog-actions button[type="submit"]{border-color:#417a63;background:#417a63;color:#fff}
    @media(max-width:600px){.user-menu-trigger{max-width:48vw;padding:7px 9px;gap:8px}.user-menu-trigger #user-email{font-size:12px}.user-menu-panel{width:210px}}
  `;
  document.head.append(style);

  const wrapper = document.createElement('div');
  wrapper.className = 'user-menu';
  wrapper.id = 'user-menu';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'user-menu-trigger';
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', 'user-menu-panel');
  trigger.setAttribute('aria-label', 'Otevřít uživatelské menu');
  const chevron = document.createElement('span');
  chevron.className = 'user-menu-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  trigger.append(email, chevron);

  const panel = document.createElement('nav');
  panel.className = 'user-menu-panel';
  panel.id = 'user-menu-panel';
  panel.setAttribute('aria-label', 'Uživatelské menu');
  panel.hidden = true;
  panel.innerHTML = '<button type="button" class="user-menu-action" data-open-account>Můj účet</button><a class="user-menu-link" href="#student-names">Seznam žáků</a><a class="user-menu-link" href="#class-list">Učebny</a><a class="user-menu-link" href="./admin/">Admin</a><span class="user-menu-separator" aria-hidden="true"></span><button type="button" class="user-menu-action user-menu-action-danger" data-sign-out>Odhlásit se</button>';
  wrapper.append(trigger, panel);
  topbarRight.append(wrapper);

  const dialog = document.createElement('dialog');
  dialog.className = 'account-dialog';
  dialog.setAttribute('aria-labelledby', 'account-dialog-title');
  dialog.innerHTML = `<form class="account-dialog-content" id="account-form"><h2 id="account-dialog-title">Můj účet</h2><p id="account-email"></p><label for="account-password">Nové heslo</label><input id="account-password" type="password" minlength="8" autocomplete="new-password" required placeholder="Alespoň 8 znaků"><div class="account-dialog-actions"><button type="button" data-close-account>Zavřít</button><button type="submit">Změnit heslo</button></div></form>`;
  document.body.append(dialog);

  function closeMenu() {
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  }
  trigger.addEventListener('click', () => {
    const isOpen = trigger.getAttribute('aria-expanded') === 'true';
    trigger.setAttribute('aria-expanded', String(!isOpen));
    panel.hidden = isOpen;
  });
  panel.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
    if (event.target.closest('[data-open-account]')) {
      closeMenu();
      document.querySelector('#account-email').textContent = email.textContent;
      dialog.showModal();
      document.querySelector('#account-password').focus();
    }
    if (event.target.closest('[data-sign-out]')) {
      closeMenu();
      supabase.auth.signOut().then(({ error }) => {
        if (error) {
          const toast = document.querySelector('#toast');
          if (toast) {
            toast.textContent = error.message;
            toast.classList.add('error', 'visible');
          }
          return;
        }
        window.location.reload();
      });
    }
  });
  document.addEventListener('click', event => {
    if (!wrapper.contains(event.target)) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      closeMenu();
      trigger.focus();
    }
  });
  dialog.querySelector('[data-close-account]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  dialog.querySelector('#account-form').addEventListener('submit', async event => {
    event.preventEventDefault();
    const submit = dialog.querySelector('[type="submit"]');
    const password = dialog.querySelector('#account-password').value;
    submit.disabled = true;
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      dialog.close();
      dialog.querySelector('#account-form').reset();
      const toast = document.querySelector('#toast');
      if (toast) {
        toast.textContent = 'Heslo bylo změněno.';
        toast.classList.remove('error');
        toast.classList.add('visible');
        window.setTimeout(() => toast.classList.remove('visible'), 2800);
      }
    } catch (error) {
      const toast = document.querySelector('#toast');
      if (toast) {
        toast.textContent = error.message || 'Heslo se nepodařilo změnit.';
        toast.classList.add('error', 'visible');
        window.setTimeout(() => toast.classList.remove('visible'), 4000);
      }
    } finally {
      submit.disabled = false;
    }
  });
}

new MutationObserver(addDeleteButtons).observe(classList, { childList: true });
addDeleteButtons();
addAccountMenu();
