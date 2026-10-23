const DEFAULTS = {
  token: '',
  emoji: ':headphones:',
  template: 'Listening To: {title} — {artist}',
  enabled: true,
  clearDelaySec: 30,
  overwriteExisting: false,
};

const $ = (id) => document.getElementById(id);
const msg = (text) => { $('msg').textContent = text; };

async function load() {
  const s = { ...DEFAULTS, ...(await chrome.storage.local.get([...Object.keys(DEFAULTS), 'lastError'])) };
  for (const key of Object.keys(DEFAULTS)) {
    const el = $(key);
    if (el.type === 'checkbox') el.checked = s[key];
    else el.value = s[key];
  }
  $('error').textContent = s.lastError ? `Last error: ${s.lastError}` : '';
  await showAccount();
}

async function showAccount() {
  const { token } = await chrome.storage.local.get('token');
  $('token').value = token || '';
  $('signout').hidden = !token;
  if (!token) {
    $('account').textContent = 'Not signed in.';
    return;
  }
  const r = await chrome.runtime.sendMessage({ type: 'test' });
  $('account').textContent = r.ok
    ? `Signed in as ${r.user} in ${r.team}.`
    : `Token does not work: ${r.error}. Sign in again.`;
}

$('signin').addEventListener('click', async () => {
  msg('Signing in…');
  const r = await chrome.runtime.sendMessage({ type: 'signin' });
  msg(r.ok ? '' : `Sign-in failed: ${r.error}`);
  await showAccount();
});

$('signout').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'signout' });
  msg('Signed out.');
  await showAccount();
});

chrome.runtime.sendMessage({ type: 'redirect' }).then((r) => { $('redirect').textContent = r.url; });

$('save').addEventListener('click', async () => {
  await chrome.storage.local.set({
    token: $('token').value.trim(),
    emoji: $('emoji').value.trim(),
    template: $('template').value,
    enabled: $('enabled').checked,
    clearDelaySec: Math.max(0, Number($('clearDelaySec').value) || 0),
    overwriteExisting: $('overwriteExisting').checked,
    lastError: '',
  });
  $('error').textContent = '';
  msg('Saved.');
  await showAccount();
});

$('clear').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'clear' });
  msg('Cleared (if the status was set by this extension).');
});

load();
