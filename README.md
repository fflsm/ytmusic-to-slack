# YouTube Music to Slack Status

A Chrome extension (Manifest V3) that sets your Slack status to the track you are playing on music.youtube.com.

## How it works

- `content.js` runs on music.youtube.com. Every 5 seconds, and on play/pause, it reads the track from the Media Session API (or the player bar) and sends it to the background worker.
- `background.js` calls the Slack Web API only when the track changes, plus a refresh every 5 minutes.
- Each status expires after 10 minutes. If the browser closes, the status clears on its own.
- When you pause, the status clears after a delay (30 seconds by default). It also clears when you close the YouTube Music tab.
- It does not overwrite a status you set by hand (for example "In a meeting"). It clears a status only if the text is the one it set.

## 1. Create a Slack app and get a user token

1. Go to https://api.slack.com/apps and click **Create New App** > **From scratch**. Select your workspace.
2. Open **OAuth & Permissions**. Under **User Token Scopes**, add:
   - `users.profile:read`
   - `users.profile:write`
3. Click **Install to Workspace** and approve. Some workspaces need an admin to approve the app.
4. Copy the **User OAuth Token** (it starts with `xoxp-`).

Keep this token secret. It can change your profile.

## 2. Load the extension

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. Click the extension icon to open the settings. Paste the token, click **Save**, then **Test token**.

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
- `missing_scope`: add the two scopes above, then reinstall the app to get a new token.
