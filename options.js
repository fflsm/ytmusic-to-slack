const DEFAULTS = {
  token: '',
  emoji: ':headphones:',
  template: '{title} — {artist}',
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
}

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
});

$('test').addEventListener('click', async () => {
  msg('Testing…');
  const r = await chrome.runtime.sendMessage({ type: 'test' });
  msg(r.ok ? `Connected as ${r.user} in ${r.team}.` : `Failed: ${r.error}`);
});

$('clear').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'clear' });
  msg('Cleared (if the status was set by this extension).');
});

load();
