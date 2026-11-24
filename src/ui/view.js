import { Origin, Severity } from '../core/constants.js';
import { AudioStatus } from '../audio/AudioAlertService.js';
import { STATUS_LABEL, el, formatTime, originBadge } from './dom.js';

const SOUND_LABEL = {
  none: 'Visual only',
  played: 'Siren played',
  warning: 'Warning tone played',
  chime: 'Chime played',
  muted: 'Muted — no sound',
  locked: 'Blocked — sound not enabled',
  'already-playing': 'Merged into alarm in progress',
  'volume-zero': 'Volume 0 — no sound',
  offline: 'No sound — recorded while offline',
  unsupported: 'Audio unsupported',
  error: 'Playback error',
};

const AUDIO_INDICATOR = {
  [AudioStatus.ENABLED]: ['Sound alerts: ON', 'ok'],
  [AudioStatus.MUTED]: ['Sound alerts: MUTED', 'warn'],
  [AudioStatus.LOCKED]: ['Sound alerts: NOT ENABLED', 'bad'],
  [AudioStatus.UNSUPPORTED]: ['Sound alerts: UNSUPPORTED', 'bad'],
};

const offlineBadge = (entry) =>
  entry.offline ? el('span', { className: 'badge badge-offline', text: 'RECORDED OFFLINE' }) : null;

const INFO_TOAST_MS = 12_000;
const INFO_BATCH_MS = 1_500;
const INFO_BATCH_MAX_INDIVIDUAL = 3;
const MAX_TOASTS = 5;

export function createView(root = document) {
  const $ = (id) => root.getElementById(id);
  const toasts = $('toasts');
  let infoBatch = [];
  let infoTimer = null;
  let checkpoint = false; // gate mode: unknown alerts stay on screen, individually, with actions

  function setCheckpoint(enabled) {
    checkpoint = enabled;
  }

  function renderAudio(audio) {
    const [label, tone] = AUDIO_INDICATOR[audio.status];
    const indicator = $('audio-indicator');
    indicator.textContent = label;
    indicator.dataset.tone = tone;

    $('unlock-banner').hidden = !audio.needsActivation;
    $('unlock-text').textContent = audio.needsReactivation
      ? 'The page was reloaded — the browser requires you to re-enable sound alerts.'
      : 'Your browser blocks sound until you interact with the page. Verified-unauthorized alarms will be silent until you enable sound.';

    const mute = $('btn-mute');
    mute.textContent = audio.muted ? 'Unmute' : 'Mute';
    mute.setAttribute('aria-pressed', String(audio.muted));
    mute.disabled = !audio.supported;
    // No test-siren control is exposed in the operations console. Audio status is
    // still shown here so operators know whether real alerts can be heard.

    const pct = Math.round(audio.volume * 100);
    $('volume').value = String(pct);
    $('volume-out').textContent = `${pct}%`;
  }

  function setAudioMessage(text) {
    $('audio-msg').textContent = text;
  }

  function flashUnlockBanner() {
    const banner = $('unlock-banner');
    banner.classList.remove('flash');
    void banner.offsetWidth; // restart the animation
    banner.classList.add('flash');
  }

  function toastFields(entry) {
    const rows = [
      ['Device', entry.deviceIdMasked],
      ['Protocol', entry.protocol],
      ['Sensor', entry.sensorId],
      ['Last observed', formatTime(entry.lastSeen)],
      ['Status', STATUS_LABEL[entry.status] ?? entry.status],
      ['Reason', entry.reason],
      ['Sound', SOUND_LABEL[entry.sound] ?? entry.sound],
    ];
    if (entry.offline) {
      const where = entry.offline === 'sensor' ? 'stored on the sensor' : 'held by the server (app was closed)';
      rows.push(['Recorded', `${where}; first seen ${formatTime(entry.firstSeen)}${entry.timeApprox ? ' (time unknown — before a sensor restart)' : ''}`]);
    }
    if (entry.repeats) rows.push(['Repeats', `${entry.repeats} (suppressed by cooldown)`]);
    const dl = el('dl');
    for (const [k, v] of rows) dl.append(el('dt', { text: k }), el('dd', { text: v }));
    return dl;
  }

  function mountToast(toast, { persistent }) {
    const close = el('button', { className: 'toast-close', text: '×', attrs: { 'aria-label': 'Dismiss notification' } });
    close.addEventListener('click', () => toast.remove());
    toast.querySelector('.toast-head').append(close);
    toasts.prepend(toast);
    while (toasts.children.length > MAX_TOASTS) {
      // Evict the oldest non-critical notice first; unauthorized alerts are kept longest.
      const oldest = [...toasts.children].reverse().find((t) => !t.classList.contains('toast-high')) ?? toasts.lastElementChild;
      oldest.remove();
    }
    if (!persistent) setTimeout(() => toast.remove(), INFO_TOAST_MS);
  }

  function renderToast(entry) {
    const high = entry.severity === Severity.HIGH;
    const rule = entry.severity === Severity.RULE;
    const toast = el('div', {
      className: `toast ${high ? 'toast-high' : rule ? 'toast-rule' : 'toast-info'} ${entry.origin === Origin.DEMO ? 'toast-demo' : ''}`,
      attrs: { role: high ? 'alert' : 'status', 'data-key': entry.alertKey },
    });
    const gate = checkpoint && !high && !rule;
    const base = high
      ? 'Unauthorized device detected'
      : rule
        ? `Rule alert: ${entry.ruleName}`
        : gate
          ? 'Unknown device at the gate — not authorized'
          : 'Unknown device — review';
    const title = el('strong', { text: entry.offline ? `${base} (while offline)` : base });
    toast.append(el('div', { className: 'toast-head' }, [originBadge(entry.origin), offlineBadge(entry), title]), toastFields(entry));
    // A live notification may hand an observation to the controlled registry
    // workflow, but cannot change the registry from the alert itself.
    if (!high && !rule && !entry.offline && entry.origin === Origin.LIVE) {
      const action = el('button', { className: 'btn btn-sm', text: 'Review in Device Registry', attrs: { type: 'button', 'data-toast-action': 'review-registry', 'data-key': entry.key } });
      toast.append(
        el('div', { className: 'toast-actions' }, [action]),
      );
    }
    toasts.querySelector(`[data-key="${CSS.escape(entry.alertKey)}"]`)?.remove();
    mountToast(toast, { persistent: high || gate });
  }

  // Many unknowns at once (e.g. the first scan of a busy area) collapse into one summary notice.
  function renderSummaryToast(batch) {
    const origins = new Set(batch.map((e) => e.origin));
    const demo = origins.size === 1 && origins.has(Origin.DEMO);
    const rules = batch.filter((e) => e.severity === Severity.RULE).length;
    const toast = el('div', { className: `toast ${rules ? 'toast-rule' : 'toast-info'} ${demo ? 'toast-demo' : ''}`, attrs: { role: 'status' } });
    const what = rules === batch.length ? 'rule alerts' : rules ? 'alerts (rules + unknown devices)' : 'new unknown devices';
    const title = el('strong', { text: `${batch.length} ${what} — see Alert history` });
    const dl = el('dl');
    for (const e of batch.slice(0, 5)) {
      const prefix = e.ruleName ? `${e.ruleName} · ` : '';
      dl.append(el('dt', { text: e.deviceIdMasked }), el('dd', { text: `${prefix}${e.protocol} · ${e.sensorId} · ${formatTime(e.lastSeen)}` }));
    }
    if (batch.length > 5) dl.append(el('dt', { text: '…' }), el('dd', { text: `${batch.length - 5} more` }));
    toast.append(el('div', { className: 'toast-head' }, [originBadge(demo ? Origin.DEMO : Origin.LIVE), title]), dl);
    mountToast(toast, { persistent: false });
  }

  function flushInfoBatch() {
    const batch = infoBatch;
    infoBatch = [];
    infoTimer = null;
    if (batch.length <= INFO_BATCH_MAX_INDIVIDUAL) batch.forEach(renderToast);
    else renderSummaryToast(batch);
  }

  function showToast(entry) {
    if (entry.severity === Severity.HIGH) return renderToast(entry);
    if (checkpoint && entry.severity === Severity.INFO) return renderToast(entry); // every gate alert needs a decision
    infoBatch.push(entry);
    infoTimer ??= setTimeout(flushInfoBatch, INFO_BATCH_MS);
  }

  function updateToast(entry) {
    if (!entry) return;
    const toast = toasts.querySelector(`[data-key="${CSS.escape(entry.alertKey)}"]`);
    toast?.querySelector('dl')?.replaceWith(toastFields(entry));
  }

  function renderHistory(entries) {
    const body = $('history-body');
    body.replaceChildren(
      ...entries.map((e) =>
        el('tr', { className: `row-${e.severity} ${e.origin === Origin.DEMO ? 'row-demo' : ''}` }, [
          el('td', { text: formatTime(e.lastSeen) }),
          el('td', {}, [originBadge(e.origin), offlineBadge(e)]),
          el('td', { text: e.ruleName ? `Rule: ${e.ruleName}` : (STATUS_LABEL[e.status] ?? e.status) }),
          el('td', { className: 'mono', text: e.deviceIdMasked }),
          el('td', { text: e.protocol }),
          el('td', { text: e.sensorId }),
          el('td', { text: e.reason }),
          el('td', { text: SOUND_LABEL[e.sound] ?? e.sound }),
          el('td', { text: String(e.repeats) }),
        ]),
      ),
    );
    $('history-empty').hidden = entries.length > 0;
  }

  function renderDemo(enabled) {
    $('demo-banner').hidden = !enabled;
    document.body.classList.toggle('demo-on', enabled);
  }

  function renderLiveStatus(status) {
    const node = $('live-status');
    node.textContent = status;
    node.dataset.tone = status === 'connected' ? 'ok' : status === 'disconnected' ? 'idle' : 'warn';
    $('btn-connect').textContent = status === 'disconnected' ? 'Connect' : 'Disconnect';
  }

  return { setCheckpoint, renderAudio, setAudioMessage, flashUnlockBanner, showToast, updateToast, renderHistory, renderDemo, renderLiveStatus };
}
