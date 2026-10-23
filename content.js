// Runs on music.youtube.com. Reads the current track and play state and
// reports it to the background worker, which decides whether to call Slack.

const POLL_MS = 5000;

function readTrack() {
  const video = document.querySelector('video');
  const playing = !!video && !video.paused && !video.ended;

  // YouTube Music publishes track info through the Media Session API.
  const meta = navigator.mediaSession && navigator.mediaSession.metadata;
  let title = (meta && meta.title) || '';
  let artist = (meta && meta.artist) || '';

  // Fallback: scrape the player bar. The byline reads "Artist • Album • Year".
  if (!title) {
    const bar = document.querySelector('ytmusic-player-bar');
    title = bar?.querySelector('.title')?.textContent.trim() || '';
    artist = bar?.querySelector('.byline')?.textContent.split('•')[0].trim() || '';
  }

  return { playing: playing && !!title, title, artist };
}

let timer = null;

function report() {
  // After the extension is reloaded, this orphaned script loses its runtime.
  if (!chrome.runtime?.id) {
    clearInterval(timer);
    return;
  }
  chrome.runtime.sendMessage({ type: 'track', ...readTrack() }).catch(() => {});
}

timer = setInterval(report, POLL_MS);

// Media events do not bubble, so listen in the capture phase for quick updates.
for (const evt of ['play', 'pause', 'ended', 'loadedmetadata']) {
  document.addEventListener(evt, () => setTimeout(report, 500), true);
}

report();
