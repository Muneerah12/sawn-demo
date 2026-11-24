// Airspace engine for the main interface: the platform's own detection modules (pipeline,
// device tracker, classifier, registry, alert policy, rules, audio) without any of their UI.
// The page reads window.SAWN_AIR and redraws when it calls back.
import { AuthStatus, DEFAULTS, Origin, SECURITY_EVENT, Severity } from '../core/constants.js';
import { createEventBus } from '../core/eventBus.js';
import { EMPTY_REGISTRY } from '../core/classifier.js';
import { createPipeline } from '../core/pipeline.js';
import { AlertAction, createAlertPolicy } from '../core/alertPolicy.js';
import { createAlertHistory } from '../core/alertHistory.js';
import { createAlertController } from '../core/alertController.js';
import { createDeviceTracker, proximity, signalOf } from '../core/deviceTracker.js';
import { TYPE_LABEL, inferDeviceType, osFamily } from '../core/deviceType.js';
import { createRegistryStore } from '../core/registryStore.js';
import { sanitizeRegistry } from '../core/registryValidation.js';
import { DEFAULT_SITE_POLICY, sanitizeSitePolicy, zoneFor, inZone } from '../core/sitePolicy.js';
import { OS_FAMILIES, RuleAction, createRuleEngine, sanitizeRules } from '../core/alertRules.js';
import { AlarmSound, AudioAlertService } from '../audio/AudioAlertService.js';
import { createSessionPrefs } from '../audio/preferences.js';
import { createLiveSocketSource } from '../sources/liveSocketSource.js';

const j = async (url, body) => {
  const r = await fetch(url, body === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
  return d;
};

let started = false;
const listeners = new Set();
let tick = null;
const changed = () => {
  if (tick) return;
  tick = setTimeout(() => { tick = null; listeners.forEach((f) => f()); }, 700);
};

const prefs = createSessionPrefs();
const audio = new AudioAlertService({ prefs });
const policy = createAlertPolicy({ cooldownMs: DEFAULTS.cooldownMs, notifyUnattributable: false });
const history = createAlertHistory();
const tracker = createDeviceTracker();
const controller = createAlertController({ policy, audio, history });
const ruleEngine = createRuleEngine({ absenceMs: () => Math.max(policy.cooldownMs, DEFAULTS.unknownAbsenceMs) });
const sensors = new Map();
const ruleHits = [];
let pending = [];
let lan = new Map();
let bridge = null;
let feed = 'disconnected';
let site = DEFAULT_SITE_POLICY;
let pipeline = null;
let registry = null;
const lanHost = (d) => (d?.protocol === 'Wi-Fi' ? (lan.get(d.identifier) ?? null) : null);

async function start() {
  if (started) return;
  started = true;
  let registryFailed = false, siteFailed = false, rulesFailed = false;
  const initial = await j('/sawn-demo/api/registry').then(sanitizeRegistry).catch(() => { registryFailed = true; return EMPTY_REGISTRY; });
  site = policy.setSitePolicy(sanitizeSitePolicy(await j('/sawn-demo/api/site-policy').catch(() => { siteFailed = true; return DEFAULT_SITE_POLICY; })));
  ruleEngine.setRules(sanitizeRules(await j('/sawn-demo/api/rules').catch(() => { rulesFailed = true; return { rules: [] }; })).rules);
  const bus = createEventBus();
  pipeline = createPipeline({ liveRegistry: initial, demoRegistry: EMPTY_REGISTRY, bus });
  registry = createRegistryStore({
    initial,
    save: async (next) => { const s = await j('/sawn-demo/api/registry', next); pending = s._pending ?? []; return s; },
    load: () => j('/sawn-demo/api/registry'),
    onChange(next) { pipeline.setLiveRegistry(next); tracker.reclassify(pipeline.classifyLive, Origin.LIVE); changed(); },
  });
  bus.on(SECURITY_EVENT, (event) => {
    const tracked = event.offline ? null : tracker.update(event);
    const presence = tracked ? { rssi: signalOf(tracked), readings: tracked.recentReadings ?? 1 } : null;
    controller.handle(event, presence);
    const device = event.offline ? event : tracker.get(event.key);
    const kind = inferDeviceType(device, lanHost(device));
    for (const rule of ruleEngine.evaluate(device, kind, lanHost(device))) {
      if (rule.action === RuleAction.CHIME && !event.offline) audio.playAlarm(AlarmSound.RULE);
      ruleHits.unshift({ t: event.observedAt, ruleId: rule.id, ruleName: rule.name, id: event.identifier, protocol: event.protocol, type: kind.type, signal: signalOf(device), status: event.status });
      ruleHits.length = Math.min(ruleHits.length, 300);
    }
    changed();
  });
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/observations`;
  createLiveSocketSource({
    url,
    onObservation: pipeline.ingestLive,
    onSensor: (s) => { sensors.set(s.sensorId, { ...s, receivedAt: s.receivedAt ?? Date.now() }); changed(); },
    onBridge: (b) => { bridge = b; changed(); },
    onLan: (l) => { lan = new Map((l.hosts ?? []).map((h) => [String(h.mac).toUpperCase(), h])); },
    onControl: async (msg) => {
      if (msg.type !== 'config') return;
      try {
        if (msg.what === 'registry') registry.replace(await j('/sawn-demo/api/registry'));
        if (msg.what === 'site') site = policy.setSitePolicy(sanitizeSitePolicy(await j('/sawn-demo/api/site-policy')));
        if (msg.what === 'rules') ruleEngine.setRules(sanitizeRules(await j('/sawn-demo/api/rules')).rules);
        changed();
      } catch { /* the next change reloads it */ }
    },
    onStatus: (s) => { feed = s; changed(); },
  });
  setInterval(changed, 5000);
  // The engine can start before the console's session is ready; then the first reads fail and the
  // engine would run on an empty registry (every device "unknown") until the next change. Retry.
  if (registryFailed || siteFailed || rulesFailed) {
    const retry = setInterval(async () => {
      try {
        if (registryFailed) { registry.replace(sanitizeRegistry(await j('/sawn-demo/api/registry'))); registryFailed = false; }
        if (siteFailed) { site = policy.setSitePolicy(sanitizeSitePolicy(await j('/sawn-demo/api/site-policy'))); siteFailed = false; }
        if (rulesFailed) { ruleEngine.setRules(sanitizeRules(await j('/sawn-demo/api/rules')).rules); rulesFailed = false; }
        changed();
      } catch { /* not ready yet */ }
      if (!registryFailed && !siteFailed && !rulesFailed) clearInterval(retry);
    }, 2000);
  }
}

const deviceView = (d) => {
  const kind = inferDeviceType(d, lanHost(d));
  const rssi = signalOf(d);
  return {
    key: d.key, id: d.identifier, masked: d.deviceIdMasked, protocol: d.protocol, name: d.name ?? lanHost(d)?.hostname ?? null, vendor: d.vendor ?? d.mfrName ?? null,
    status: d.status, severity: d.severity, reason: d.reason, rssi, near: proximity(rssi), inZone: inZone(rssi, site, d.protocol), randomized: !d.stableIdentifier,
    type: kind.type, typeLabel: kind.model ?? kind.familyLabel ?? TYPE_LABEL[kind.type], os: kind.os ?? null, osFamily: osFamily(kind.os), confidence: kind.confidence ?? null,
    sensorId: d.sensorId, lastSeen: d.lastSeen, firstSeen: d.firstSeen, entry: registry ? registry.find(d.identifier, d.protocol) : null,
  };
};

const withPending = async (p) => { pending = []; await p; return pending; };

window.SAWN_AIR = {
  start,
  onChange: (f) => { listeners.add(f); return () => listeners.delete(f); },
  devices: () => tracker.list({ origin: Origin.LIVE }).map(deviceView),
  sensors: () => [...sensors.values()],
  bridge: () => bridge,
  feed: () => feed,
  site: () => site,
  alerts: () => history.list ? history.list() : [],
  registry: () => (registry ? registry.get() : EMPTY_REGISTRY),
  authorize: (d, label, ownerId) => withPending(registry.authorize({ identifier: d.id, protocol: d.protocol, label, ownerId })),
  deny: (d, reason, ownerId) => withPending(registry.deny({ identifier: d.id, protocol: d.protocol, reason, ownerId })),
  remove: (d) => withPending(registry.remove({ identifier: d.id, protocol: d.protocol })),
  trustSensor: (id, on) => withPending(registry.setSensorTrusted(id, on)),
  saveSite: async (next) => { site = policy.setSitePolicy(sanitizeSitePolicy(await j('/sawn-demo/api/site-policy', next))); changed(); return site; },
  rules: () => ruleEngine.rules,
  ruleHits: () => ruleHits,
  saveRules: async (rules) => { const s = (await j('/sawn-demo/api/rules', sanitizeRules({ rules }))).rules; ruleEngine.setRules(s); changed(); return s; },
  enableSound: () => audio.enable(),
  zoneFor: (protocol) => zoneFor(protocol, site),
  TYPES: TYPE_LABEL, OS: OS_FAMILIES, STATUS: AuthStatus, SEVERITY: Severity, ACTION: RuleAction,
};
window.dispatchEvent(new Event('sawn-air'));
