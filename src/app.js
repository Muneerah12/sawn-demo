import { AuthStatus, DEFAULTS, Origin, SECURITY_EVENT, Severity } from './core/constants.js';
import { AlertKind, createMetrics } from './core/metrics.js';
import { maskIdentifier } from './core/identifiers.js';
import { RuleAction, conditionsFromFilters, createRuleEngine, matchRule, sanitizeRules } from './core/alertRules.js';
import { createEventBus } from './core/eventBus.js';
import { EMPTY_REGISTRY } from './core/classifier.js';
import { createPipeline } from './core/pipeline.js';
import { AlertAction, createAlertPolicy } from './core/alertPolicy.js';
import { createAlertHistory } from './core/alertHistory.js';
import { createAlertController } from './core/alertController.js';
import { createDeviceTracker, signalOf } from './core/deviceTracker.js';
import { TYPE_LABEL, inferDeviceType, osFamily } from './core/deviceType.js';
import { createRegistryStore } from './core/registryStore.js';
import { sanitizeRegistry } from './core/registryValidation.js';
import { DEFAULT_SITE_POLICY, SiteMode, sanitizeSitePolicy, zoneFor } from './core/sitePolicy.js';
import { AlarmSound, AudioAlertService } from './audio/AudioAlertService.js';
import { createSessionPrefs } from './audio/preferences.js';
import { DEMO_REGISTRY } from './demo/demoScenarios.js';
import { createLiveSocketSource } from './sources/liveSocketSource.js';
import { createView } from './ui/view.js';
import { createLiveView } from './ui/liveView.js';
import { createRulesView } from './ui/rulesView.js';
import { createOverview } from './ui/overviewView.js';
import { TYPE_ICON, hydrateIcons } from './ui/icons.js';
import { createRadar, distanceFromRssi } from './ui/radarView.js';
import { createVoiceAlerts } from './ui/voiceAlerts.js';
import { emit, on, session } from './shell/hub.js';
import { confirmDialog, formDialog, notify } from './shell/ui.js';
import { state as consoleState } from './shell/store.js';
import { normalizeIdentifier, normalizeProtocol } from './core/identifiers.js';
import { confidenceOf } from './core/confidence.js';

// Static <i data-icon> placeholders become inline SVG before any view reads the DOM.
hydrateIcons(document);

// Stored in the SAWN database; every read and write needs a signed-in session (src/shared/iam.js).
const REGISTRY_URL = 'api/registry';
const RULES_URL = 'api/rules';
const SITE_POLICY_URL = 'api/site-policy';
const RENDER_INTERVAL_MS = 1000;
const RULES_RENDER_EVERY = 5; // render ticks between "matching now" refreshes

/** Latest saved JSON; throws on failure so an edit is never applied to a missing/empty base. */
async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not load ${url} (HTTP ${res.status})`);
  return res.json();
}
const fetchRules = async () => sanitizeRules(await fetchJson(RULES_URL)).rules;

async function loadRules() {
  try {
    return await fetchRules();
  } catch (err) {
    console.warn(`[SAWN] Alert rules unavailable (${err.message}).`);
    return [];
  }
}

async function postJson(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Save failed (HTTP ${res.status})`);
  return data;
}

async function loadLiveRegistry() {
  try {
    const res = await fetch(REGISTRY_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return sanitizeRegistry(await res.json());
  } catch (err) {
    console.warn(`[SAWN] Live registry unavailable (${err.message}); all live devices will be UNKNOWN.`);
    return EMPTY_REGISTRY;
  }
}

// Two-person rule: granting access may come back as "pending" (waits for a second approver).
let lastPending = [];
async function saveRegistryToServer(registry) {
  const saved = await postJson('api/registry', registry);
  lastPending = saved._pending ?? [];
  return saved;
}

const $ = (id) => document.getElementById(id);
const prefs = createSessionPrefs();
const saved = prefs.load();
const view = createView(document);
const liveView = createLiveView(document);
const rulesView = createRulesView(document);
const overview = createOverview(document);
const metrics = createMetrics();
const bus = createEventBus();
const audio = new AudioAlertService({ prefs });
const policy = createAlertPolicy({
  cooldownMs: saved.cooldownMs ?? DEFAULTS.cooldownMs,
  notifyUnattributable: saved.notifyUnattributable === true,
});
const history = createAlertHistory();
const tracker = createDeviceTracker();
const controller = createAlertController({ policy, audio, history });
const sensors = new Map(); // sensorId -> latest heartbeat

// Controlled-exercise inputs remain isolated from the live pipeline. They have no
// operator launcher in the production Airspace console; legacy exercise/replay state
// is still labelled if it arrives from the server.
let demoEnabled = false;
let reveal = true;
let liveSource = null;
let lastBridge = null;
let lanByMac = new Map();
let editingRuleId = null;
let renderTick = 0;
// Ephemeral handoff from an operational view to the sole registration editor.
// It is never written to the registry until a supervisor/administrator confirms it.
let registryReview = null;

const lanHost = (d) => (d?.protocol === 'Wi-Fi' ? (lanByMac.get(d.identifier) ?? null) : null);
const ruleEngine = createRuleEngine({ absenceMs: () => Math.max(policy.cooldownMs, DEFAULTS.unknownAbsenceMs) });
ruleEngine.setRules(await loadRules());

// --- Site mode (checkpoint gate vs. monitor) --------------------------------
async function loadSitePolicy() {
  try {
    return sanitizeSitePolicy(await fetchJson(SITE_POLICY_URL));
  } catch {
    return DEFAULT_SITE_POLICY;
  }
}

const SITE_CONTROLS = ['site-mode', 'site-zone', 'site-zone-ble', 'site-confirm', 'site-unknown', 'site-random'];

function selectValue(id, value, label) {
  const select = $(id);
  if (![...select.options].some((o) => o.value === String(value))) select.append(new Option(label, String(value)));
  select.value = String(value);
}

function applySitePolicy(next) {
  const site = policy.setSitePolicy(next);
  const checkpoint = site.mode === SiteMode.CHECKPOINT;
  view.setCheckpoint(checkpoint);
  $('site-mode').value = site.mode;
  selectValue('site-zone', site.zoneRssi, `≥ ${site.zoneRssi} dBm (calibrated)`);
  selectValue('site-zone-ble', site.zoneRssiBle, `≥ ${site.zoneRssiBle} dBm (calibrated)`);
  $('site-confirm').value = String(site.confirmReadings);
  $('site-unknown').value = site.unknownAlert;
  $('site-random').checked = site.includeRandomized;
  const mayEdit = session.can('site.edit');
  $('site-mode').disabled = !mayEdit;
  for (const id of SITE_CONTROLS.slice(1)) $(id).disabled = !checkpoint || !mayEdit;
  if (!mayEdit) for (const id of SITE_CONTROLS) $(id).title = session.why('site.edit');
  const pill = $('site-pill');
  pill.textContent = checkpoint ? `CHECKPOINT · Wi-Fi ≥ ${site.zoneRssi} · BLE ≥ ${site.zoneRssiBle} dBm` : 'MONITOR MODE';
  pill.dataset.tone = checkpoint ? 'warn' : 'idle';
}
applySitePolicy(await loadSitePolicy());

async function saveSitePolicy(overrides = {}) {
  const next = {
    mode: $('site-mode').value,
    zoneRssi: Number($('site-zone').value),
    zoneRssiBle: Number($('site-zone-ble').value),
    confirmReadings: Number($('site-confirm').value),
    unknownAlert: $('site-unknown').value,
    includeRandomized: $('site-random').checked,
    ...overrides,
  };
  $('site-msg').textContent = 'Saving…';
  try {
    applySitePolicy(await postJson('api/site-policy', next));
    $('site-msg').textContent = 'Saved.';
    return true;
  } catch (err) {
    $('site-msg').textContent = err.message;
    applySitePolicy(policy.sitePolicy);
    return false;
  }
}
for (const id of SITE_CONTROLS) $(id).addEventListener('change', () => saveSitePolicy());

/** Sets the gate edge for a device's protocol from its current smoothed signal (−3 dB margin). */
async function calibrateGateEdge(device) {
  if (!session.can('site.edit')) return notify(session.why('site.edit'), 'bad');
  const rssi = signalOf(device);
  if (!Number.isFinite(rssi) || Date.now() - device.lastSeen > 15_000) {
    notify('This device has no recent signal reading. Make sure it is active (screen on) and try again.', 'bad');
    return;
  }
  const threshold = Math.round(rssi) - 3;
  const proto = device.protocol === 'BLE' ? 'Bluetooth' : 'Wi-Fi';
  const ok = await confirmDialog({
    title: `Calibrate the ${proto} gate edge`,
    message:
      `From ${device.identifier}${device.name ? ` (“${device.name}”)` : ''}: smoothed signal ${Math.round(rssi)} dBm (${device.recentReadings ?? 0} recent readings). ` +
      `${proto} devices at ${threshold} dBm or stronger will count as “at the gate” (3 dB margin). ` +
      'Do this with the device held where visitors stand at the outer edge of the gate.',
    confirmLabel: 'Set gate edge',
  });
  if (!ok) return;
  if (await saveSitePolicy(device.protocol === 'BLE' ? { zoneRssiBle: threshold } : { zoneRssi: threshold })) {
    $('site-msg').textContent = `${proto} gate edge calibrated to ≥ ${threshold} dBm.`;
  }
}
const initialRegistry = await loadLiveRegistry();
const pipeline = createPipeline({
  liveRegistry: initialRegistry,
  demoRegistry: DEMO_REGISTRY,
  bus,
  isDemoEnabled: () => demoEnabled,
});

const registry = createRegistryStore({
  initial: initialRegistry,
  save: saveRegistryToServer,
  load: () => fetchJson(REGISTRY_URL),
  onChange(next) {
    pipeline.setLiveRegistry(next);
    tracker.reclassify(pipeline.classifyLive, Origin.LIVE);
    renderLive();
  },
});

// --- Event flow: security event -> tracker + alert controller + rules -> UI --
bus.on(SECURITY_EVENT, (event) => {
  // Replayed offline records are history: they must not overwrite the live picture.
  const tracked = event.offline ? null : tracker.update(event);
  // Alert decisions use the smoothed signal and the number of recent readings.
  const presence = tracked ? { rssi: signalOf(tracked), readings: tracked.recentReadings ?? 1 } : null;
  const result = controller.handle(event, presence);
  if (result.action === AlertAction.NOTIFY) {
    view.showToast(result.entry);
    if (result.sound === 'locked') view.flashUnlockBanner();
    if (!event.offline && event.origin === Origin.LIVE) {
      metrics.recordAlert(result.entry.severity === Severity.HIGH ? AlertKind.UNAUTHORIZED : AlertKind.UNKNOWN);
    }
  } else if (result.action === AlertAction.SUPPRESS) {
    view.updateToast(result.entry);
  }

  // Rules see the merged device (descriptive fields arrive over several observations).
  const device = event.offline ? event : tracker.get(event.key);
  const kind = inferDeviceType(device, lanHost(device));
  for (const rule of ruleEngine.evaluate(device, kind, lanHost(device))) fireRule(rule, event, kind);
});

function fireRule(rule, event, kind) {
  let sound = 'none';
  if (rule.action === RuleAction.CHIME && event.offline) {
    sound = 'offline';
  } else if (rule.action === RuleAction.CHIME) {
    const r = audio.playAlarm(AlarmSound.RULE);
    sound = r.played ? 'chime' : r.reason;
  }
  const what = [kind.model ?? kind.familyLabel ?? TYPE_LABEL[kind.type], kind.os && `OS ${kind.os}`, kind.confidence && `${kind.confidence} confidence`]
    .filter(Boolean)
    .join(', ');
  const entry = history.add(
    {
      ...event,
      alertKey: `${event.key}|rule:${rule.id}${event.offline ? '|offline' : ''}`,
      severity: Severity.RULE,
      ruleName: rule.name,
      reason: `Rule “${rule.name}” matched — ${what}`,
      evidence: kind.evidence,
    },
    { sound },
  );
  view.showToast(entry);
  if (!event.offline && event.origin === Origin.LIVE) metrics.recordAlert(AlertKind.RULE);
  recordRuleResult(rule, event, kind, sound);
}

// --- Rule results: every time a rule fired, newest first (kept for this session) ----
const RULE_RESULTS_KEY = 'sawn.ruleResults.v1';
const RULE_RESULTS_LIMIT = 300;
let ruleResults = [];
try {
  ruleResults = JSON.parse(sessionStorage.getItem(RULE_RESULTS_KEY) ?? '[]');
} catch {
  ruleResults = [];
}

function recordRuleResult(rule, event, kind, sound) {
  const device = event.offline ? event : (tracker.get(event.key) ?? event);
  const signal = signalOf(device);
  const host = lanHost(device);
  const typeText = [kind.type !== 'unknown' ? `${kind.confidence === 'low' ? 'likely ' : ''}${TYPE_LABEL[kind.type]}` : kind.familyLabel ?? 'unidentified', kind.os].filter(Boolean).join(' · ');
  ruleResults.unshift({
    t: event.observedAt,
    ruleId: rule.id,
    ruleName: rule.name,
    title: device.name ?? host?.hostname ?? kind.model ?? kind.familyLabel ?? TYPE_LABEL[kind.type] ?? 'Device',
    id: event.identifier,
    protocol: event.protocol,
    typeIcon: TYPE_ICON[kind.type] ?? 'device',
    typeText,
    signal: Number.isFinite(signal) ? `${Math.round(signal)} dBm` : '—',
    status: event.status,
    sound,
    offline: Boolean(event.offline),
  });
  ruleResults.length = Math.min(ruleResults.length, RULE_RESULTS_LIMIT);
  try {
    sessionStorage.setItem(RULE_RESULTS_KEY, JSON.stringify(ruleResults));
  } catch {
    // storage full: results last for this page only
  }
  renderRuleResults();
}

function renderRuleResults() {
  const shown = reveal ? ruleResults : ruleResults.map((r) => ({ ...r, id: maskIdentifier(r.id) }));
  rulesView.renderResults(shown, { ruleFilter: $('rule-results-filter').value, rules: ruleEngine.rules });
}

// This console's history is operational-only. Stored incidents retain every
// provenance class for review on the Incidents page.
history.onChange(() => view.renderHistory(history.list({ origin: Origin.LIVE })));
audio.onChange(() => view.renderAudio(audio));

function renderLive() {
  const range = $('devices-range');
  const minRssi = range.value ? Number(range.value) : undefined;
  const types = $('devices-type').value ? $('devices-type').value.split(',') : null;
  const os = $('devices-os').value;
  const protocol = $('devices-protocol').value;
  const query = $('devices-search').value.trim().toLowerCase();
  $('type-hint').hidden = !types && !os;

  const devices = tracker
    .list({
      status: $('devices-status').value || undefined,
      origin: Origin.LIVE,
      // Phones almost always use randomized addresses, so type/OS filters include them.
      hideUnattributable: $('devices-hide-random').checked && !types && !os,
      minRssi,
    })
    .map((d) => ({ ...d, kind: inferDeviceType(d, lanHost(d)) }))
    .filter((d) => {
      if (protocol && d.protocol !== protocol) return false;
      if (types && !types.includes(d.kind.type)) return false;
      if (os && osFamily(d.kind.os) !== os) return false;
      if (!query) return true;
      const host = lanHost(d);
      return [d.identifier, d.name, d.vendor, d.mfrName, d.probe, d.kind.model, d.kind.family, d.kind.familyLabel, d.kind.os, host?.ip, host?.hostname]
        .some((v) => v && String(v).toLowerCase().includes(query));
    });

  liveView.renderDevices(
    devices,
    {
      reveal,
      findEntry: registry.find,
      lan: (mac) => lanByMac.get(mac) ?? null,
      network: (bssid) => tracker.get(`${Origin.LIVE}|Wi-Fi|${bssid}`)?.name ?? null,
      zone: policy.sitePolicy.mode === SiteMode.CHECKPOINT ? (protocol) => zoneFor(protocol, policy.sitePolicy) : null,
    },
  );
  liveView.renderSensors(sensors, registry.get());
  liveView.renderRegistry(registry.get(), { reveal, review: registryReview });
  liveView.renderBridge(lastBridge);
  const health = checkSensorHealth();
  renderOverview(health, devices.length);
  if (renderTick++ % RULES_RENDER_EVERY === 0) {
    renderRules();
    renderCharts();
  }
}

// --- Overview: gate status, KPI tiles, charts ----------------------------------------
const RECENT_MS = 60_000; // "in range now" = heard in the last minute
let lastOverview = null;
let lastRefreshAt = Date.now();

function liveSnapshot() {
  const site = policy.sitePolicy;
  const now = Date.now();
  const recent = tracker
    .list({ origin: Origin.LIVE })
    .filter((d) => now - d.lastSeen <= RECENT_MS)
    .map((d) => ({ ...d, kind: inferDeviceType(d, lanHost(d)) }));
  const atGate = recent.filter((d) => {
    const s = signalOf(d);
    return Number.isFinite(s) && s >= zoneFor(d.protocol, site);
  });
  const byStatus = (list, status) => list.filter((d) => d.status === status);
  return {
    site,
    checkpoint: site.mode === SiteMode.CHECKPOINT,
    recent,
    atGate,
    counts: {
      total: recent.length,
      atGate: atGate.length,
      unknown: byStatus(recent, AuthStatus.UNKNOWN).length,
      unauthorized: byStatus(recent, AuthStatus.VERIFIED_UNAUTHORIZED).length,
      authorized: byStatus(recent, AuthStatus.AUTHORIZED).length,
    },
    unknownAtGate: byStatus(atGate, AuthStatus.UNKNOWN).filter((d) => d.stableIdentifier || site.includeRandomized),
    unauthorizedNow: byStatus(recent, AuthStatus.VERIFIED_UNAUTHORIZED),
  };
}

function heroState(snap, health) {
  const names = (list) =>
    list
      .slice(0, 3)
      .map((d) => {
        const what = d.name ?? lanHost(d)?.hostname ?? d.kind?.model ?? TYPE_LABEL[d.kind?.type] ?? 'Device';
        const s = signalOf(d);
        return `${what} (${reveal ? d.identifier : d.deviceIdMasked}${Number.isFinite(s) ? `, ${Math.round(s)} dBm` : ''})`;
      })
      .join(' · ') + (list.length > 3 ? ` and ${list.length - 3} more` : '');
  if (!liveSource) return { level: 'idle', title: 'Not connected to the sensor feed', detail: 'Open Facility profile → Installed equipment & sensors and click Connect.' };
  if (health.problem) return { level: 'critical', title: 'Gate is not being monitored', detail: health.text };
  if (snap.unauthorizedNow.length) {
    return { level: 'critical', title: `${snap.unauthorizedNow.length} unauthorized device${snap.unauthorizedNow.length > 1 ? 's' : ''} present`, detail: names(snap.unauthorizedNow) };
  }
  if (snap.checkpoint && snap.unknownAtGate.length) {
    const n = snap.unknownAtGate.length;
    return {
      level: 'warning',
      title: `${n} unknown device${n > 1 ? 's' : ''} at the gate`,
      detail: `Not authorized — check the visitor, then mark each device authorized or unauthorized. ${names(snap.unknownAtGate)}`,
    };
  }
  if (snap.checkpoint) {
    return {
      level: 'good',
      title: 'Gate clear',
      detail: `${snap.counts.atGate} authorized device${snap.counts.atGate === 1 ? '' : 's'} at the gate · ${snap.counts.total} in range (last minute)`,
    };
  }
  return { level: 'good', title: 'Monitoring airspace', detail: `${snap.counts.total} devices in range · ${snap.counts.unknown} unknown · no unauthorized device present` };
}

function renderOverview(health, shownCount) {
  const snap = liveSnapshot();
  lastOverview = snap;
  // Don't chart the empty moments before the first sensor data arrives after a (re)load.
  if (sensors.size && Date.now() - pageLoadedAt > 8_000) metrics.sample(snap.counts);
  const latestData = Math.max(lastRefreshAt, ...[...sensors.values()].map((s) => s.receivedAt ?? 0));
  const hero = { ...heroState(snap, health), updatedAt: latestData };
  overview.renderHero(hero);
  publishAirspace(snap, hero, health);

  const site = snap.site;
  const trusted = new Set(registry.get().trustedSensors);
  const sensorList = [...sensors.values()];
  const online = sensorList.filter((s) => Date.now() - s.receivedAt <= SENSOR_DOWN_MS).length;
  const alertTrend = metrics.alertBuckets().slice(-12).map((b) => b.unauthorized + b.unknown + b.rule);
  overview.renderKpis([
    {
      label: snap.checkpoint ? 'At the gate' : 'Close by',
      value: snap.counts.atGate,
      iconName: 'gate',
      tone: 'info',
      trend: metrics.recent('atGate'),
      hint: `zone: Wi-Fi ≥ ${site.zoneRssi} · BLE ≥ ${site.zoneRssiBle} dBm`,
    },
    { label: 'Unknown in range', value: snap.counts.unknown, iconName: 'unknown', tone: snap.counts.unknown ? 'warning' : 'neutral', trend: metrics.recent('unknown'), hint: 'heard in the last minute' },
    { label: 'Unauthorized', value: snap.counts.unauthorized, iconName: 'block', tone: snap.counts.unauthorized ? 'critical' : 'neutral', trend: metrics.recent('unauthorized'), hint: snap.counts.unauthorized ? 'siren active' : 'none present' },
    { label: 'Alerts (last hour)', value: metrics.alertsSince(3_600_000), iconName: 'alert', tone: 'info', trend: alertTrend, hint: 'siren, warning and rule alerts' },
    {
      label: 'Sensors online',
      value: `${online}/${sensorList.length}`,
      iconName: 'sensor',
      tone: sensorList.length && online === sensorList.length ? 'good' : 'critical',
      hint: sensorList.some((s) => !trusted.has(s.sensorId)) ? 'a sensor is not trusted' : 'reporting every ~2 s',
    },
  ]);
  $('devices-count').textContent = `${shownCount} shown · ${snap.counts.total} in range (last minute)`;
}

// --- Radar + console snapshot (command center, map, 3D model) -------------------------
// Spoken alerts: new WARNING / HIGH / CRITICAL incidents, once each. The header
// toggle controls real alert speech; no preview/test control is exposed here.
const voice = createVoiceAlerts({ ownOnly: true });

// New incidents: an alarm that matches the severity, then the spoken alert once it has finished.
// Device alerts from the live sensor have their own siren / warning tone (alertController).
const INCIDENT_SOUND = { crit: AlarmSound.DANGER, high: AlarmSound.THREAT, mid: AlarmSound.ALERT };
const OWN_SOUND = new Set(['air-unauth', 'air-unknown', 'air-rule']);
function incidentAlarm(inc) {
  const sound = INCIDENT_SOUND[inc?.sev];
  if (!sound || OWN_SOUND.has(inc.key ?? inc.scenario)) return 0;
  const r = audio.playAlarm(sound);
  return r.played ? r.seconds : 0;
}
function renderVoiceToggle() {
  $('btn-voice').setAttribute('aria-pressed', String(voice.enabled));
  $('voice-text').textContent = voice.mode === 'off' ? 'Voice alerts: off (site setting)' : voice.supported ? `Voice alerts: ${voice.enabled ? 'ON' : 'OFF'}` : 'Voice alerts: not supported';
  $('btn-voice').disabled = !voice.supported || voice.mode === 'off';
  const selected = voice.selectedVoice;
  const source = selected.loading ? 'choosing an Arabic browser voice' : selected.name ? `browser voice: ${selected.name}` : 'browser default voice';
  $('btn-voice').title = `Speak new WARNING / HIGH / CRITICAL incidents aloud · mode: ${voice.mode === 'recorded' ? 'recorded clips (computer voice where a clip is missing)' : voice.mode} · ${source}`;
}
$('btn-voice').addEventListener('click', () => {
  voice.enabled = !voice.enabled;
});
voice.onChange(renderVoiceToggle);
renderVoiceToggle();
fetchJson('api/voice')
  .then((info) => {
    voice.configure(info);
    if (info.mode === 'recorded' && info.missing?.length) console.info(`[SAWN] voice: ${info.missing.length} clip(s) not recorded yet — those alerts use the computer's voice`);
  })
  .catch(() => {});

const radar = createRadar($('radar'), {
  voice,
  onAction: (action, key) => {
    const device = tracker.get(key);
    if (action === 'review-registry') openRegistryReview(device);
    else if (action === 'adsb-mode') {
      postJson('api/settings/adsb-mode', { mode: key })
        .then((r) => notify(`Aircraft feed: ${r.mode}`))
        .catch((err) => notify(err.message, 'bad'));
    } else if (action === 'fr24') {
      postJson('api/settings/fr24', { on: key === true })
        .then((r) => notify(r.on ? `Flightradar24 on for ${r.autoOffMin} min` : 'Flightradar24 off — free source'))
        .catch((err) => notify(err.message, 'bad'));
    }
  },
  statusOf: (protocol, id) => tracker.get(`${Origin.DEMO}|${protocol}|${id}`)?.status ?? null,
  ingestDemo: (obs) => pipeline.ingestDemo(obs),
  incidents: () => consoleState.incidents,
  isDemo: () => demoEnabled,
  setDemo(enabled) {
    demoEnabled = enabled;
    view.renderDemo(enabled);
  },
});
let feedStatus = 'disconnected';
let lastObservationCount = 0;

const deviceName = (d) => d.name ?? lanHost(d)?.hostname ?? d.kind?.model ?? d.kind?.familyLabel ?? (d.kind?.type !== 'unknown' ? TYPE_LABEL[d.kind?.type] : null) ?? d.vendor ?? d.mfrName ?? null;

function publishAirspace(snap, hero, health) {
  const site = snap.site;
  const now = Date.now();
  const sensorList = [...sensors.values()];
  const online = sensorList.filter((s) => now - s.receivedAt <= SENSOR_DOWN_MS);
  const serialPorts = lastBridge?.serial?.ports ?? [];
  const link = { usb: serialPorts.some((p) => p.state === 'open'), wifi: (lastBridge?.wifi ?? []).some((w) => w.state === 'connected') };
  const atGate = new Set(snap.atGate.map((d) => d.key));
  const entryOf = (d) => registry.find(d.identifier, d.protocol);
  const devices = snap.recent.map((d) => ({
    key: d.key,
    identifier: reveal ? d.identifier : d.deviceIdMasked,
    protocol: d.protocol,
    status: d.status,
    signal: signalOf(d),
    name: deviceName(d),
    vendor: d.vendor ?? d.mfrName ?? null,
    type: d.kind.type,
    typeLabel: [d.kind.model ?? d.kind.familyLabel ?? TYPE_LABEL[d.kind.type], d.kind.os].filter(Boolean).join(' · '),
    stable: d.stableIdentifier,
    observations: d.observations,
    lastSeen: d.lastSeen,
    atGate: atGate.has(d.key),
    reason: d.reason,
    ownerName: entryOf(d)?.ownerName ?? null,
    typeScore: d.kind.typeScore ?? 0,
    confidence: confidenceOf(d, d.kind),
  }));
  const stats = pipeline.stats();
  const reading = stats.live > lastObservationCount;
  lastObservationCount = stats.live;
  radar.update({ devices, site, link, reading, sensor: { id: sensorList[0]?.sensorId ?? null, online: online.length > 0 } });

  const level = hero.level === 'idle' ? 'idle' : hero.level;
  const payload = {
    level,
    heroTitle: hero.title,
    heroDetail: hero.detail,
    counts: snap.counts,
    unknownAtGate: snap.unknownAtGate.length,
    unauthorized: snap.unauthorizedNow.length,
    gateDevices: devices.filter((d) => d.atGate).sort((a, b) => (a.status === 'VERIFIED_UNAUTHORIZED' ? -1 : 0) - (b.status === 'VERIFIED_UNAUTHORIZED' ? -1 : 0)),
    devices3d: devices
      .filter((d) => d.atGate || d.status === 'VERIFIED_UNAUTHORIZED' || (Number.isFinite(d.signal) && d.signal >= -75))
      .map((d) => ({ key: d.key, type: d.type, status: d.status, dist: distanceFromRssi(d.signal, d.protocol), atGate: d.atGate })),
    sensorOnline: online.length > 0 && !health.problem,
    sensorId: sensorList[0]?.sensorId ?? null,
    sensorsOnline: online.length,
    sensorsTotal: sensorList.length,
    connected: feedStatus === 'connected',
    link,
    checkpoint: snap.checkpoint,
  };
  emit('airspace', payload);
}

on('navigate', ({ tab, focus, aircraft }) => {
  if (tab === 'airspace' && aircraft) radar.showAircraft(typeof aircraft === 'string' ? aircraft : null);
  if (tab === 'airspace' && focus) {
    const [protocol, id] = focus.split('|');
    radar.select(`${Origin.LIVE}|${protocol}|${id}`);
  }
});

function renderCharts() {
  const snap = lastOverview ?? liveSnapshot();
  const typeCounts = new Map();
  for (const d of snap.recent) typeCounts.set(d.kind.type, (typeCounts.get(d.kind.type) ?? 0) + 1);
  const types = [...typeCounts.entries()]
    .map(([type, value]) => ({ label: TYPE_LABEL[type] ?? type, iconName: TYPE_ICON[type] ?? 'device', value }))
    .sort((a, b) => b.value - a.value);
  overview.renderCharts({ snapshots: metrics.snapshots(), buckets: metrics.alertBuckets(), types, checkpoint: snap.checkpoint });
}

// --- Sensor health: readings are only trustworthy while the sensor reports ---------
const SENSOR_DOWN_MS = 20_000; // sensors report every ~2 s (firmware v0.5+)
const pageLoadedAt = Date.now();
let sensorsWereDown = false;

function checkSensorHealth() {
  const now = Date.now();
  const down = [...sensors.values()].filter((s) => now - s.receivedAt > SENSOR_DOWN_MS);
  const none = sensors.size === 0 && liveSource && now - pageLoadedAt > SENSOR_DOWN_MS;
  const problem = down.length > 0 || none;
  const banner = $('sensor-down-banner');
  banner.hidden = !problem;
  const text = !problem
    ? ''
    : none
      ? 'No sensor is reporting. The gate is NOT being monitored.'
      : `Sensor ${down.map((s) => `${s.sensorId} (silent ${Math.round((now - s.receivedAt) / 1000)} s)`).join(', ')} is not reporting. ` +
        'Readings are not reliable until it is back — check its power and Wi-Fi.';
  if (problem) $('sensor-down-text').textContent = text;
  if (problem && !sensorsWereDown) audio.playAlarm(AlarmSound.WARNING); // once, when it goes down
  sensorsWereDown = problem;
  return { problem, text };
}
setInterval(renderLive, RENDER_INTERVAL_MS);

function renderRules() {
  const live = tracker.list({ origin: Origin.LIVE }).map((d) => ({ d, kind: inferDeviceType(d, lanHost(d)) }));
  const hourAgo = Date.now() - 3_600_000;
  rulesView.renderRules(ruleEngine.rules, {
    editingId: editingRuleId,
    matches: (rule) =>
      live
        .filter(({ d, kind }) => matchRule(rule, d, kind, lanHost(d)))
        .map(({ d, kind }) => {
          const s = signalOf(d);
          return {
            title: d.name ?? lanHost(d)?.hostname ?? kind.model ?? kind.familyLabel ?? TYPE_LABEL[kind.type] ?? 'Device',
            id: reveal ? d.identifier : d.deviceIdMasked,
            protocol: d.protocol,
            signal: Number.isFinite(s) ? `${Math.round(s)} dBm` : '—',
            status: d.status,
            typeIcon: TYPE_ICON[kind.type] ?? 'device',
          };
        }),
    firedLastHour: (rule) => ruleResults.filter((r) => r.ruleId === rule.id && r.t >= hourAgo).length,
  });
  renderRuleResults();
}

/** Applies `mutate` to the latest saved rules (never a stale copy) and saves the result. */
async function saveRules(mutate, okText) {
  rulesView.setMessage('Saving…', 'warn');
  try {
    const next = mutate(await fetchRules());
    const savedRules = (await postJson('api/rules', sanitizeRules({ rules: next }))).rules;
    ruleEngine.setRules(savedRules);
    rulesView.setMessage(okText, 'ok');
    renderRules();
    return true;
  } catch (err) {
    rulesView.setMessage(err.message, 'bad');
    return false;
  }
}

// --- Alert rules ------------------------------------------------------------
function resetRuleForm() {
  editingRuleId = null;
  $('rule-form').reset();
  rulesView.setEditing(null);
  rulesView.showForm(false);
  renderRules();
}

$('btn-rule-new').addEventListener('click', () => {
  const opening = $('rule-form-panel').hidden;
  if (!opening) return resetRuleForm();
  editingRuleId = null;
  $('rule-form').reset();
  rulesView.setEditing(null);
  rulesView.showForm(true);
  $('rule-name').focus();
});

$('rule-results-filter').addEventListener('change', renderRuleResults);
$('btn-rule-results-clear').addEventListener('click', () => {
  ruleResults = [];
  sessionStorage.removeItem(RULE_RESULTS_KEY);
  renderRules();
});

$('btn-rule-from-filters').addEventListener('click', () => {
  const draft = rulesView.readForm();
  rulesView.fillForm({
    ...draft,
    conditions: conditionsFromFilters({
      types: $('devices-type').value,
      os: $('devices-os').value,
      protocol: $('devices-protocol').value,
      range: $('devices-range').value,
      status: $('devices-status').value,
      search: $('devices-search').value.trim(),
    }),
  });
  rulesView.setMessage('Filters loaded — name the rule and save.', 'idle');
});

$('rule-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const draft = rulesView.readForm();
  const editing = editingRuleId;
  const mutate = (rules) =>
    editing
      ? rules.map((r) => (r.id === editing ? { ...r, ...draft } : r))
      : [...rules, { ...draft, id: `rule-${Date.now().toString(36)}`, enabled: true }];
  if (await saveRules(mutate, editing ? 'Rule updated.' : 'Rule saved.')) resetRuleForm();
});

$('btn-rule-cancel').addEventListener('click', resetRuleForm);

$('rules-body').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  const rule = btn && ruleEngine.rules.find((r) => r.id === btn.dataset.id);
  if (!rule) return;
  if (btn.dataset.action === 'expand-rule') {
    rulesView.toggleExpanded(rule.id);
    renderRules();
  } else if (btn.dataset.action === 'edit-rule') {
    editingRuleId = rule.id;
    rulesView.fillForm(rule);
    rulesView.setEditing(rule);
    renderRules();
    $('rule-name').focus();
  } else if (btn.dataset.action === 'delete-rule') {
    confirmDialog({ title: `Delete rule “${rule.name}”?`, message: 'The rule stops alerting for every console.', confirmLabel: 'Delete rule', danger: true }).then((ok) => {
      if (!ok) return;
      saveRules((rules) => rules.filter((r) => r.id !== rule.id), 'Rule deleted.');
      if (editingRuleId === rule.id) resetRuleForm();
    });
  } else if (btn.dataset.action === 'toggle-rule') {
    const enabled = btn.checked;
    saveRules((rules) => rules.map((r) => (r.id === rule.id ? { ...r, enabled } : r)), enabled ? 'Rule enabled.' : 'Rule disabled.');
  }
});

async function applyRegistryChange(promise, okText) {
  liveView.setRegistryMessage('Saving…', 'warn');
  lastPending = [];
  try {
    await promise;
    if (lastPending.length) {
      const text = `Sent for a second approval (two-person rule): ${lastPending.map((p) => p.summary).join('; ')}`;
      liveView.setRegistryMessage('Waiting for a second approver', 'warn');
      notify(text, 'warn');
      return true;
    }
    liveView.setRegistryMessage(okText, 'ok');
    notify(okText);
    return true;
  } catch (err) {
    liveView.setRegistryMessage(err.message, 'bad');
    notify(err.message, 'bad');
    return false;
  }
}

// --- Audio controls ---------------------------------------------------------
$('btn-enable-sound').addEventListener('click', async () => {
  const ok = await audio.enable();
  view.setAudioMessage(ok ? 'Sound alerts enabled.' : 'The browser did not allow audio. Check site sound permissions.');
});

$('btn-mute').addEventListener('click', () => {
  const muted = audio.toggleMute();
  view.setAudioMessage(muted ? 'Muted: alarms will be visual only.' : 'Unmuted.');
});

$('volume').addEventListener('input', (e) => audio.setVolume(Number(e.target.value) / 100));

const cooldownInput = $('cooldown');
cooldownInput.value = String(policy.cooldownMs / 1000);
cooldownInput.addEventListener('change', () => {
  const ms = policy.setCooldown(Number(cooldownInput.value) * 1000);
  cooldownInput.value = String(ms / 1000);
  prefs.save({ cooldownMs: ms });
  view.setAudioMessage(`Cooldown set to ${ms / 1000}s per device.`);
});

// --- Live devices -----------------------------------------------------------
for (const id of ['devices-status', 'devices-range', 'devices-hide-random', 'devices-type', 'devices-os', 'devices-protocol']) {
  $(id).addEventListener('change', renderLive);
}
$('devices-search').addEventListener('input', renderLive);
$('devices-mask').addEventListener('change', (e) => {
  reveal = !e.target.checked;
  renderLive();
  renderRules();
});
$('btn-more-filters').addEventListener('click', () => {
  const open = $('more-filters').hidden;
  $('more-filters').hidden = !open;
  $('btn-more-filters').setAttribute('aria-expanded', String(open));
});

// Manual refresh: reload saved settings, rules and registry, reconnect the feed if needed,
// and re-render everything now (the dashboard also updates live every second on its own).
$('btn-refresh').addEventListener('click', async () => {
  const btn = $('btn-refresh');
  btn.disabled = true;
  btn.classList.remove('spinning');
  void btn.offsetWidth;
  btn.classList.add('spinning');
  try {
    const [reg, rules, site] = await Promise.all([fetchJson(REGISTRY_URL), fetchRules(), loadSitePolicy()]);
    registry.replace(reg);
    ruleEngine.setRules(rules);
    applySitePolicy(site);
    if (!liveSource) connectLive($('ws-url').value.trim());
  } catch (err) {
    console.warn(`[SAWN] Refresh failed: ${err.message}`);
  } finally {
    lastRefreshAt = Date.now();
    renderLive();
    renderRules();
    renderCharts();
    btn.disabled = false;
  }
});
$('notify-random').checked = policy.notifyUnattributable;
$('notify-random').addEventListener('change', (e) => {
  policy.setNotifyUnattributable(e.target.checked);
  prefs.save({ notifyUnattributable: e.target.checked });
});

const RANDOMIZED_NOTE =
  ' This address is randomized: the same device will show up under a new address later, so this registration will not follow it. Register devices by a stable MAC where possible.';

const ACTION_PERMISSION = { authorize: 'devices.authorize', unauthorize: 'devices.deny', unregister: 'devices.remove' };

/** People for the "owner" field (Facility Profile → People & access). */
function ownerOptions(current) {
  const people = consoleState.people.filter((p) => p.status === 'active' || p.id === current);
  return [['', '— no owner —'], ...people.map((p) => [String(p.id), `${p.name} · ${p.kind}${p.organization ? ` · ${p.organization}` : ''}`])];
}

/**
 * Authorize / mark unauthorized / unregister a device. The server checks the role again and
 * records the change under the signed-in user. Returns a promise, or null if cancelled.
 */
async function deviceAction(action, device) {
  if (!device || device.origin !== Origin.LIVE) return null;
  const perm = ACTION_PERMISSION[action];
  if (perm && !session.can(perm)) {
    notify(session.why(perm), 'bad');
    return null;
  }
  const target = { identifier: device.identifier, protocol: device.protocol };
  const shown = `${device.identifier} (${device.protocol === 'BLE' ? 'Bluetooth' : 'Wi-Fi'}${device.name ? `, “${device.name}”` : ''})`;
  const note = device.stableIdentifier === false ? RANDOMIZED_NOTE : '';
  const entry = registry.find(device.identifier, device.protocol);

  if (action === 'authorize') {
    const r = await formDialog({
      title: 'Authorize device',
      iconName: 'shieldCheck',
      intro: `${shown} will be allowed through the gate.${note}`,
      fields: [
        { name: 'label', label: 'Label', value: entry?.label ?? device.name ?? '', maxlength: 80, placeholder: 'e.g. Staff laptop' },
        { name: 'ownerId', label: 'Owner (People & cards)', type: 'select', options: ownerOptions(entry?.ownerId), value: entry?.ownerId ?? '' },
      ],
      submitLabel: 'Authorize',
    });
    if (!r) return null;
    return applyRegistryChange(registry.authorize({ ...target, label: r.label, ownerId: Number(r.ownerId) || undefined }), 'Device marked authorized.');
  }
  if (action === 'unauthorize') {
    const r = await formDialog({
      title: 'Mark device unauthorized',
      iconName: 'block',
      intro: `${shown}: whenever a trusted sensor hears it again, the SIREN sounds and a critical incident is raised.${note}`,
      fields: [
        { name: 'reason', label: 'Reason (required, kept in the registry and the audit log)', type: 'textarea', required: true, maxlength: 200 },
        { name: 'ownerId', label: 'Belongs to (optional)', type: 'select', options: ownerOptions(entry?.ownerId), value: entry?.ownerId ?? '' },
      ],
      submitLabel: 'Mark unauthorized',
      danger: true,
    });
    if (!r?.reason) return null;
    return applyRegistryChange(registry.deny({ ...target, reason: r.reason, ownerId: Number(r.ownerId) || undefined }), 'Device marked unauthorized.');
  }
  if (action === 'unregister') {
    const ok = await confirmDialog({ title: 'Remove registration?', message: `${shown} becomes UNKNOWN again.`, confirmLabel: 'Remove registration' });
    if (!ok) return null;
    return applyRegistryChange(registry.remove(target), 'Registration removed.');
  }
  return null;
}

/**
 * Open the controlled Device Registry editor for an observed device. Monitoring
 * views may call this, but only registry controls can mutate authorization.
 */
function openRegistryReview(candidate) {
  if (candidate?.origin && candidate.origin !== Origin.LIVE) {
    notify('Only a current live observation can be sent to Device Registry.', 'bad');
    return;
  }
  const id = normalizeIdentifier(candidate?.identifier);
  const protocol = normalizeProtocol(candidate?.protocol);
  if (!id || !protocol) {
    notify('This observation does not have a usable identifier and protocol for registry review.', 'bad');
    return;
  }
  const tracked = candidate?.origin === Origin.LIVE
    ? candidate
    : tracker.get(`${Origin.LIVE}|${protocol}|${id}`);
  registryReview = tracked ?? {
    origin: Origin.LIVE,
    identifier: id,
    protocol,
    name: candidate?.name ?? null,
    sensorId: candidate?.sensorId ?? null,
    lastSeen: candidate?.lastSeen ?? null,
    stableIdentifier: candidate?.stableIdentifier ?? null,
  };
  renderLive();
  emit('navigate', { tab: 'facility', facilitySection: 'facility-registry' });
}

on('registry-review', openRegistryReview);

$('devices-body').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  if (btn.dataset.action === 'toggle-details') {
    liveView.toggleExpanded(btn.dataset.key);
    renderLive();
  } else if (btn.dataset.action === 'review-registry') openRegistryReview(tracker.get(btn.dataset.key));
});

// Gate notifications hand the observation to Device Registry; they cannot make
// an authorization decision in the alert itself.
$('toasts').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-toast-action]');
  if (!btn) return;
  if (btn.dataset.toastAction === 'review-registry') openRegistryReview(tracker.get(btn.dataset.key));
});

$('registry-review').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  if (btn.dataset.action === 'registry-clear-review') {
    registryReview = null;
    renderLive();
    return;
  }
  if (!registryReview) return;
  if (btn.dataset.action === 'registry-authorize') await deviceAction('authorize', registryReview);
  else if (btn.dataset.action === 'registry-deny') await deviceAction('unauthorize', registryReview);
  else if (btn.dataset.action === 'registry-unregister') await deviceAction('unregister', registryReview);
  else if (btn.dataset.action === 'registry-calibrate') await calibrateGateEdge(registryReview);
});

$('registry-body').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action="remove-entry"]');
  const entry = btn && registry.get().devices[Number(btn.dataset.index)];
  if (!entry) return;
  applyRegistryChange(registry.remove({ identifier: entry.id, protocol: entry.protocol }), 'Registration removed.');
});

$('sensors-body').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action="toggle-trust"]');
  if (!btn) return;
  const sensorId = btn.dataset.sensor;
  const trusted = registry.get().trustedSensors.includes(sensorId);
  if (!trusted && !(await confirmDialog({ title: `Trust sensor ${sensorId}?`, message: 'Only trust sensors you physically control: a trusted sensor can raise the siren.', confirmLabel: 'Trust sensor' }))) return;
  applyRegistryChange(registry.setSensorTrusted(sensorId, !trusted), trusted ? 'Sensor untrusted.' : 'Sensor trusted.');
});

// --- History ----------------------------------------------------------------
$('btn-clear-history').addEventListener('click', () => history.clear());

// --- Server control messages -------------------------------------------------
let loadedAppVersion = null;

// LIVE / SIMULATION banner on the Airspace page (and a chip in the header on every page) for
// the whole time a demo scenario runs: everything purple is simulated, real data is dimmed.
let lastModeSig = '';
function renderMode(msg) {
  const d = msg?.demo;
  const sim = Boolean(d && d.status && d.status !== 'idle');
  const detail = sim
    ? `${d.title?.en ?? d.id}${d.status === 'paused' ? ' (paused)' : d.status === 'ended' ? ' (ending)' : ''} — everything purple is SIMULATED; real data is dimmed underneath`
    : `Real sensor, ADS-B and satellite data${msg?.replay ? ' · aircraft feed in REPLAY of recorded data' : ''}`;
  const sig = `${sim}|${detail}`;
  if (sig === lastModeSig) return;
  lastModeSig = sig;
  const b = $('mode-banner');
  b.dataset.mode = sim ? 'sim' : 'live';
  const part = (tag, text, attrs = {}) => {
    const n = document.createElement(tag);
    n.textContent = text;
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  };
  b.replaceChildren(part('b', sim ? '⚠ وضع المحاكاة' : '● مباشر', { lang: 'ar', dir: 'rtl' }), part('b', sim ? 'SIMULATION' : 'LIVE'), part('span', detail));
  $('sim-chip').hidden = !sim;
}

async function handleControl(msg) {
  // Incidents, audit entries, people / user changes and session notices go to the console pages.
  emit('server-message', msg);
  if (msg.type === 'incident' && msg.event === 'created') {
    const wait = incidentAlarm(msg.incident);
    voice.announce(msg.incident, { delayMs: wait ? Math.round(wait * 1000) + 250 : 0 });
  }
  if (msg.type === 'aircraft') {
    consoleState.aircraft = msg;
    radar.setAircraft(msg);
    renderMode(msg);
  } else if (msg.type === 'space') {
    radar.setSpace(msg);
  } else if (msg.type === 'server' && msg.appVersion) {
    // The first version seen is what this page is running; a different one means an update.
    loadedAppVersion ??= msg.appVersion;
    $('update-banner').hidden = msg.appVersion === loadedAppVersion;
  } else if (msg.type === 'config') {
    // Another tab (or this one) saved: adopt the saved copy so every tab shows the same thing.
    try {
      if (msg.what === 'registry') registry.replace(await fetchJson(REGISTRY_URL));
      if (msg.what === 'site') applySitePolicy(await loadSitePolicy());
      if (msg.what === 'rules') {
        ruleEngine.setRules(await fetchRules());
        renderRules();
      }
    } catch (err) {
      console.warn(`[SAWN] Could not reload ${msg.what}: ${err.message}`);
    }
  }
}

$('btn-reload').addEventListener('click', () => location.reload());

// --- Live feed --------------------------------------------------------------
function connectLive(url) {
  try {
    liveSource = createLiveSocketSource({
      url,
      onObservation: pipeline.ingestLive,
      onSensor: (s) => sensors.set(s.sensorId, { ...s, receivedAt: s.receivedAt ?? Date.now() }),
      onBridge: (b) => {
        lastBridge = b;
        // Gate hardware status is derived from the serial bridge, independently from Airspace
        // observations.  Shell pages refresh a non-PII gate summary from this event.
        emit('bridge-status', b);
      },
      onLan: (l) => {
        lanByMac = new Map((l.hosts ?? []).map((h) => [String(h.mac).toUpperCase(), h]));
      },
      onControl: handleControl,
      onStatus: (status) => {
        feedStatus = status;
        view.renderLiveStatus(status);
        emit('feed-status', status);
      },
    });
  } catch (err) {
    liveSource = null;
    view.renderLiveStatus('disconnected');
    $('bridge-info').textContent = err.message;
  }
}

$('btn-connect').addEventListener('click', () => {
  if (liveSource) {
    liveSource.close();
    liveSource = null;
    return;
  }
  connectLive($('ws-url').value.trim());
});

$('btn-release-usb').addEventListener('click', async () => {
  try {
    const res = await fetch('api/serial/release', { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    $('bridge-info').textContent = 'USB released for 60 s — run `npm run flash` now.';
  } catch (err) {
    $('bridge-info').textContent = `Could not release USB: ${err.message}`;
  }
});

// Integration hook for an existing SAWN frontend/backend bridge running in the same page.
window.SAWNAirspace = Object.freeze({
  ingestLive: pipeline.ingestLive,
  setLiveRegistry: pipeline.setLiveRegistry,
  stats: pipeline.stats,
  Origin,
});

// --- Initial render ---------------------------------------------------------
audio.probe();
view.renderAudio(audio);
view.renderDemo(false);
view.renderLiveStatus('disconnected');
view.renderHistory([]);
renderLive();

// When served by the SAWN server, the local bridge feed is on the same host.
if (location.protocol.startsWith('http')) {
  $('ws-url').value = `ws://${location.host}/observations`;
  connectLive($('ws-url').value);
}
