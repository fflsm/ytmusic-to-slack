# YouTube Music to Slack Status

A Chrome extension (Manifest V3) that sets your Slack status to the track you are playing on music.youtube.com.

## How it works

- `content.js` runs on music.youtube.com. Every 5 seconds, and on play/pause, it reads the track from the Media Session API (or the player bar) and sends it to the background worker.
- `background.js` calls the Slack Web API only when the track changes, plus a refresh every 5 minutes.
- Each status expires after 10 minutes. If the browser closes, the status clears on its own.
- When you pause, the status clears after a delay (30 seconds by default). It also clears when you close the YouTube Music tab.
- It does not overwrite a status you set by hand (for example "In a meeting"). It clears a status only if the text is the one it set.

## Sign-in

Each person clicks **Sign in with Slack** on the settings page. The extension then gets that person's own user token. Never share a token: it acts as the person who approved it.

The `key` in `manifest.json` pins the extension ID to `epolhkpcoojggdeighlaoipnlppndiob` on every install. Slack needs this, because it only sends people back to a redirect URL registered in advance. The matching private key is `ytmusic-slack-status.pem` in the parent folder. You need it only to pack a `.crx`. Do not put it inside this folder.

## 1. Set up the Slack app (one time, by the owner)

1. Go to https://api.slack.com/apps and click **Create New App** > **From scratch**. Select your workspace.
2. Open **OAuth & Permissions**.
   - Under **Redirect URLs**, add `https://epolhkpcoojggdeighlaoipnlppndiob.chromiumapp.org/slack` and click **Save URLs**.
   - Under **User Token Scopes**, add `users.profile:read` and `users.profile:write`.
3. If your workspace needs admin approval for apps, request it now.
4. Open **Basic Information**. Copy `config.example.js` to `config.js`, and paste in the **Client ID** and **Client Secret**.

`config.js` holds the client secret. Share the extension inside the organisation only, and do not commit `config.js` (it is in `.gitignore`).

## 2. Install the extension (each person)

1. Get a copy of this folder, including `config.js`.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the folder.
4. Click the extension icon, then click **Sign in with Slack** and approve.

To push it to everyone without Developer mode, ask IT to install it through Chrome policy (Google Admin or Intune).

## 3. Use it

Play something on https://music.youtube.com. Your Slack status changes in a few seconds.

## Settings

| Setting | Default | Notes |
|---|---|---|
| Status text | `{title} — {artist}` | Slack keeps the first 100 characters. |
| Status emoji | `:headphones:` | Any emoji code from your workspace. |
| Clear after pause | 30 s | |
| Overwrite a status I set by hand | off | |

## Troubleshooting

- Errors from Slack show at the bottom of the settings page.
- For more detail, open `chrome://extensions` and click **service worker** on this extension to see its console.
- `missing_scope`: add the two scopes above, then sign out and sign in again.
- `bad_redirect_uri` or `redirect_uri_mismatch`: the redirect URL in the Slack app must match the one shown under **Advanced** on the settings page exactly.
- `config.js is missing`: copy `config.example.js` to `config.js` and fill it in.
