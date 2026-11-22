import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabase = createClient('https://jukkbhcgriohapmlmdfo.supabase.co', 'sb_publishable_aEXip-ChEGGAzZzGexKdjQ_YbLzRHOh');
const form = document.querySelector('#reset-form');
const message = document.querySelector('#reset-message');

const { data, error } = await supabase.auth.getSession();
if (error || !data.session) {
  message.textContent = 'Odkaz není platný nebo vypršel. Požádejte administrátora o nový.';
} else {
  message.textContent = '';
  form.hidden = false;
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = document.querySelector('#save-password'); button.disabled = true;
  message.textContent = 'Ukládám nové heslo…';
  const { error: updateError } = await supabase.auth.updateUser({ password: document.querySelector('#new-password').value });
  if (updateError) {
    message.textContent = updateError.message;
    button.disabled = false;
    return;
  }
  message.textContent = 'Heslo bylo změněno. Přesměrovávám do aplikace…';
  setTimeout(() => location.href = '../', 1200);
});
