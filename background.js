// Service worker. Receives track reports from content.js and keeps the
// Slack status in sync, without overwriting a status the user set by hand.

// Defines SLACK_CLIENT_ID and SLACK_CLIENT_SECRET. See config.example.js.
try {
  importScripts('config.js');
} catch (e) {
  console.warn('config.js not found. Sign in with Slack is unavailable.');
}

const USER_SCOPES = 'users.profile:read,users.profile:write';

const DEFAULTS = {
  token: '',
  emoji: ':headphones:',
  template: '{title} — {artist}',
  enabled: true,
  clearDelaySec: 30,
  overwriteExisting: false,
};

const SLACK_TEXT_MAX = 100;
// Statuses expire on their own, so a closed browser does not leave a stale track.
const EXPIRY_SEC = 10 * 60;
const REFRESH_MS = 5 * 60 * 1000;

// Service workers are stopped when idle, so runtime state lives in session storage.
async function getState() {
  const { state } = await chrome.storage.session.get('state');
  return state || { statusText: null, setAt: 0, tabId: null, pausedSince: null };
}

async function saveState(state) {
  await chrome.storage.session.set({ state });
}

async function getSettings() {
  return { ...DEFAULTS, ...(await chrome.storage.local.get(Object.keys(DEFAULTS))) };
}

async function recordError(err) {
  console.error(err);
  await chrome.storage.local.set({ lastError: `${new Date().toLocaleString()}: ${err.message}` });
}

async function slack(method, token, body) {
  const init = { headers: { Authorization: `Bearer ${token}` } };
  if (body) {
    init.method = 'POST';
    init.headers['Content-Type'] = 'application/json; charset=utf-8';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`https://slack.com/api/${method}`, init);
  const data = await res.json();
  if (!data.ok) throw new Error(`${method}: ${data.error || `HTTP ${res.status}`}`);
  return data;
}

// Runs Slack's OAuth flow and stores the signed-in person's own user token.
async function signIn() {
  if (typeof SLACK_CLIENT_ID === 'undefined' || typeof SLACK_CLIENT_SECRET === 'undefined') {
    throw new Error('config.js is missing. Copy config.example.js to config.js and fill it in.');
  }
  const redirectUri = chrome.identity.getRedirectURL('slack');
  const state = crypto.randomUUID();
  const authUrl = 'https://slack.com/oauth/v2/authorize?' + new URLSearchParams({
    client_id: SLACK_CLIENT_ID,
    user_scope: USER_SCOPES,
    redirect_uri: redirectUri,
    state,
  });

  const result = new URL(await chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }));
  if (result.searchParams.get('error')) throw new Error(`Slack sign-in: ${result.searchParams.get('error')}`);
  if (result.searchParams.get('state') !== state) throw new Error('Slack sign-in: state mismatch');

  const res = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
      code: result.searchParams.get('code'),
      redirect_uri: redirectUri,
    }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`oauth.v2.access: ${data.error}`);

  const token = data.authed_user?.access_token;
  if (!token) throw new Error('oauth.v2.access: no user token returned');
  await chrome.storage.local.set({ token, lastError: '' });
  const who = await slack('auth.test', token);
  return { user: who.user, team: who.team };
}

async function signOut() {
  const { token } = await getSettings();
  if (!token) return;
  const state = await getState();
  await clearStatus({ token }, state).catch(() => {});
  await saveState(state);
  await slack('auth.revoke', token).catch(() => {});
  await chrome.storage.local.set({ token: '' });
}

async function currentStatusText(token) {
  const { profile } = await slack('users.profile.get', token);
  return profile.status_text || '';
}

function formatStatus(template, { title, artist }) {
  const text = template
    .replaceAll('{title}', title)
    .replaceAll('{artist}', artist)
    .trim();
  return text.length > SLACK_TEXT_MAX ? `${text.slice(0, SLACK_TEXT_MAX - 1)}…` : text;
}

async function setStatus(settings, state, text, tabId) {
  const current = await currentStatusText(settings.token);
  const isOurs = current === '' || current === state.statusText;
  if (!isOurs && !settings.overwriteExisting) {
    // The user set a status by hand. Leave it alone until they clear it.
    state.statusText = null;
    return;
  }
  await slack('users.profile.set', settings.token, {
    profile: {
      status_text: text,
      status_emoji: settings.emoji,
      status_expiration: Math.floor(Date.now() / 1000) + EXPIRY_SEC,
    },
  });
  Object.assign(state, { statusText: text, setAt: Date.now(), tabId, pausedSince: null });
}

async function clearStatus(settings, state) {
  if (!state.statusText) return;
  if ((await currentStatusText(settings.token)) === state.statusText) {
    await slack('users.profile.set', settings.token, {
      profile: { status_text: '', status_emoji: '', status_expiration: 0 },
    });
  }
  Object.assign(state, { statusText: null, setAt: 0, tabId: null, pausedSince: null });
}

async function onTrack(track, tabId) {
  const settings = await getSettings();
  if (!settings.token) return;
  const state = await getState();

  if (!settings.enabled) {
    await clearStatus(settings, state);
  } else if (track.playing) {
    const text = formatStatus(settings.template, track);
    const stale = Date.now() - state.setAt > REFRESH_MS;
    if (text !== state.statusText || stale) {
      await setStatus(settings, state, text, tabId);
    } else {
      state.pausedSince = null;
    }
  } else if (state.statusText) {
    // Wait before clearing, so a short pause or track change does not flicker.
    state.pausedSince ??= Date.now();
    if (Date.now() - state.pausedSince > settings.clearDelaySec * 1000) {
      await clearStatus(settings, state);
    }
  }
  await saveState(state);
}

// Run Slack updates one at a time, so overlapping reports cannot race.
let queue = Promise.resolve();
function enqueue(fn) {
  queue = queue.then(fn).catch(recordError);
  return queue;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'track') {
    enqueue(() => onTrack(msg, sender.tab?.id ?? null));
  } else if (msg.type === 'test') {
    getSettings()
      .then((s) => slack('auth.test', s.token))
      .then((r) => sendResponse({ ok: true, user: r.user, team: r.team }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  } else if (msg.type === 'signin') {
    signIn()
      .then((r) => sendResponse({ ok: true, ...r }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  } else if (msg.type === 'signout') {
    enqueue(signOut).then(() => sendResponse({ ok: true }));
    return true;
  } else if (msg.type === 'redirect') {
    sendResponse({ url: chrome.identity.getRedirectURL('slack') });
  } else if (msg.type === 'clear') {
    enqueue(async () => {
      const state = await getState();
      await clearStatus(await getSettings(), state);
      await saveState(state);
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  enqueue(async () => {
    const state = await getState();
    if (state.tabId !== tabId) return;
    await clearStatus(await getSettings(), state);
    await saveState(state);
  });
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
