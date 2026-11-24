// Airspace page: drones (Remote ID / drone networks), evil twins and the radio environment of each
// sensor (deauthentication, beacon and Bluetooth floods, possible jamming) with its learned baseline.
import { get, post } from './api.js';
import { on } from './hub.js';
import { ago, h, notify } from './ui.js';

const CHECK_LABEL = { deauth: 'Deauth flood', beacons: 'Beacon flood', jamming: 'Jamming', ble: 'Bluetooth flood' };
const CHECK_TONE = { ok: 'st-confirmed', alert: 'st-new', watch: 'st-escalated', learning: 'st-dismissed' };

export function createThreatsPanel({ root }) {
  const $ = (id) => root.querySelector(`#${id}`);
  const facility = (id) => document.getElementById(id);
  let timer = null;
  let pending = false;

  async function load({ force = false } = {}) {
    if (root.hidden && !force) return;
    try {
      render(await get('airspace/threats'));
    } catch {
      // keep the last picture; the next poll retries
    }
  }

  function render(t) {
    const drones = t.drones ?? [];
    const radio = t.rf ?? [];
    const twins = t.evilTwins ?? [];
    const alerts = radio.flatMap((s) => Object.values(s.checks ?? {})).filter((c) => c === 'alert').length;
    const summary = $('threats-summary');
    const active = drones.length || alerts || twins.length;
    summary.textContent = active
      ? `${drones.length} drone(s) · ${alerts} radio alert(s) · ${twins.length} evil twin(s)`
      : !radio.length ? 'Awaiting radio data' : 'No active threats';
    summary.dataset.tone = active ? 'bad' : !radio.length ? 'idle' : 'ok';

    const fact = (label, value, wide = false) => h('div', { class: `threat-fact${wide ? ' wide' : ''}` }, [h('dt', { text: label }), h('dd', { text: value })]);
    const dronesState = $('drones-state');
    dronesState.textContent = drones.length ? `${drones.length} observed` : 'No observation';
    dronesState.dataset.tone = drones.length ? 'warn' : 'idle';
    $('drones-body').replaceChildren(
      ...drones.map((d) => {
        const r = d.remoteId ?? {};
        const pos = Number.isFinite(r.lat) ? `${r.lat.toFixed(5)}, ${r.lon.toFixed(5)}${r.height !== null && r.height !== undefined ? ` · ${r.height} m` : ''}` : 'Not reported';
        const operator = Number.isFinite(r.operatorLat) ? `${r.operatorLat.toFixed(5)}, ${r.operatorLon.toFixed(5)}${r.operatorId ? ` · ${r.operatorId}` : ''}` : 'Not reported';
        const detectedBy = `${d.detection}${Number.isFinite(d.typeScore) ? ` · ${d.typeScore}% classification confidence` : ''}`;
        return h('article', { class: `drone-card${r.status === 'EMERGENCY' ? ' row-crit' : ''}` }, [
          h('div', { class: 'threat-item-head' }, [
            h('div', {}, [h('strong', { text: r.uasId ?? d.name }), h('div', { class: 'sub', text: `${r.uaType ?? 'drone'} · ${d.identifier}` })]),
            r.status ? h('span', { class: r.status === 'EMERGENCY' ? 'pill st-new' : 'pill', text: r.status }) : null,
          ]),
          h('dl', { class: 'threat-facts' }, [
            fact('Detected by', detectedBy),
            fact('From site', d.distance !== null && d.distance !== undefined ? `${d.distance} m` : t.site ? 'Not reported' : 'Site location not set'),
            fact('Last seen', d.lastSeen ? `${ago(d.lastSeen)} ago` : 'Unknown'),
            fact('Position', pos, true),
            fact('Speed', Number.isFinite(r.speed) ? `${r.speed} m/s · ${r.heading ?? '—'}°` : 'Not reported'),
            fact('Operator', operator, true),
          ]),
        ]);
      }),
    );
    $('drones-empty').hidden = drones.length > 0;

    const twinsState = $('evil-twins-state');
    twinsState.textContent = twins.length ? `${twins.length} needs review` : 'No match';
    twinsState.dataset.tone = twins.length ? 'bad' : 'idle';
    $('eviltwins').replaceChildren(
      ...(twins.length
        ? twins.map((e) => h('li', {}, [h('span', { class: 'pill st-new', text: 'EVIL TWIN' }), h('span', { text: ` “${e.ssid}” from ${e.bssid} (yours: ${e.legit}) · ${e.rssi} dBm` })]))
        : [h('li', { class: 'sub', text: 'None.' })]),
    );

    const rfState = $('rf-state');
    rfState.textContent = !radio.length ? 'No source' : alerts ? `${alerts} alert(s)` : `${radio.length} reporting`;
    rfState.dataset.tone = !radio.length ? 'idle' : alerts ? 'bad' : 'ok';
    $('rf-body').replaceChildren(
      ...radio.map((s) => {
        const l = s.last ?? {};
        const b = s.baseline ?? {};
        const lastReport = Number.isFinite(l.t) ? `Last report ${ago(l.t)} ago` : 'Report time unavailable';
        const sourceMode = s.learning ? `Learning baseline (${s.reports}/10)` : l.hopping ? 'All channels (hopping)' : 'One Wi-Fi channel';
        const baseline = s.learning
          ? 'Threshold checks are learning the normal level; this is not a coverage guarantee.'
          : `Baseline: ${b.fps ?? '—'} frames/s, ${b.noise ?? '—'} dBm noise, ≈${b.bleAddrs ?? '—'} Bluetooth senders.`;
        const checks = Object.entries(s.checks ?? {});
        return h('article', { class: 'radio-sensor-card' }, [
          h('div', { class: 'threat-item-head' }, [
            h('div', {}, [h('strong', { class: 'mono', text: s.sensorId }), h('div', { class: 'sub', text: sourceMode })]),
            h('span', { class: 'radio-freshness', text: lastReport }),
          ]),
          h('dl', { class: 'threat-facts radio-metrics' }, [
            fact('Traffic', `${l.fps ?? '—'} frames/s`),
            fact('Noise', l.noise !== null && l.noise !== undefined ? `${l.noise} dBm` : 'Not reported'),
            fact('Deauth', `${l.deauthPerSec ?? 0} /s`),
            fact('Senders', `Wi-Fi ≈${l.bssids ?? 0} · BLE ≈${l.bleAddrs ?? 0}`),
          ]),
          h('div', { class: 'radio-checks' }, [
            h('span', { class: 'sub', text: 'Checks' }),
            ...(checks.length ? checks.map(([k, v]) => h('span', { class: `pill ${CHECK_TONE[v]}`, text: `${CHECK_LABEL[k]}: ${v}` })) : [h('span', { class: 'sub', text: 'No check result yet' })]),
          ]),
          h('p', { class: 'sub radio-baseline', text: baseline }),
        ]);
      }),
    );
    $('rf-empty').hidden = radio.length > 0;

    const scans = radio.filter((s) => s.last?.apScan);
    const apSummary = $('ap-scan-summary');
    if (!scans.length) {
      apSummary.textContent = 'No scan telemetry';
    } else {
      const latest = scans.map((s) => s.last.apScan).sort((a, b) => (b.completedAt ?? b.startedAt ?? 0) - (a.completedAt ?? a.startedAt ?? 0))[0];
      const failed = scans.filter((s) => s.last.apScan.result < 0 || s.last.apScan.state === 'failed').length;
      const found = scans.reduce((sum, s) => sum + (s.last.apScan.found ?? 0), 0);
      const emitted = scans.reduce((sum, s) => sum + (s.last.apScan.emitted ?? 0), 0);
      const dropped = scans.reduce((sum, s) => sum + (s.last.apScan.dropped ?? 0), 0);
      const lastCompleted = latest.completedAt ? `${ago(latest.completedAt)} ago` : 'time unavailable';
      apSummary.textContent = failed
        ? `${failed} scan error${failed === 1 ? '' : 's'} · last ${lastCompleted}`
        : `${latest.state} · ${lastCompleted} · ${found} found · ${emitted} emitted${dropped ? ` · ${dropped} dropped` : ''}`;
    }
    $('ap-scan-body').replaceChildren(
      ...scans.map((s) => {
        const scan = s.last.apScan;
        const failed = scan.result < 0 || scan.state === 'failed' || (scan.startError !== null && scan.startError !== undefined && scan.startError !== 0);
        const state = scan.state ?? 'unknown';
        const driver = scan.doneSeen
          ? `Driver complete: status ${scan.doneStatus ?? '—'}, ${scan.doneNumber ?? 0} reported`
          : 'Driver completion was not reported';
        return h('article', { class: `ap-scan-card${failed ? ' ap-scan-error' : ''}` }, [
          h('div', { class: 'threat-item-head' }, [
            h('div', {}, [h('strong', { class: 'mono', text: s.sensorId }), h('div', { class: 'sub', text: `Last completed ${scan.completedAt ? `${ago(scan.completedAt)} ago` : 'not reported'}` })]),
            h('span', { class: `pill ${failed ? 'st-new' : state === 'complete' ? 'st-confirmed' : 'st-dismissed'}`, text: state }),
          ]),
          h('dl', { class: 'threat-facts ap-scan-facts' }, [
            fact('Started', scan.startedAt ? `${ago(scan.startedAt)} ago` : 'Not reported'),
            fact('Completed', scan.completedAt ? `${ago(scan.completedAt)} ago` : 'Not reported'),
            fact('Driver result', scan.result === null || scan.result === undefined ? 'Not reported' : String(scan.result)),
            fact('Elapsed', scan.elapsedMs !== null && scan.elapsedMs !== undefined ? `${scan.elapsedMs} ms` : 'Not reported'),
          ]),
          h('div', { class: 'ap-pipeline', attrs: { 'aria-label': 'AP observation pipeline' } }, [
            h('span', { text: `Found ${scan.found ?? 0}` }),
            h('span', { text: `Queued ${scan.queued ?? 0}` }),
            h('span', { text: `Emitted ${scan.emitted ?? 0}` }),
            h('span', { class: (scan.dropped ?? 0) ? 'ap-dropped' : '', text: `Dropped ${scan.dropped ?? 0}` }),
          ]),
          h('p', { class: 'sub ap-driver-detail', text: `Start status ${scan.startError ?? '—'} · ${driver}` }),
        ]);
      }),
    );
    $('ap-scan-empty').hidden = scans.length > 0;

    if (t.site && !facility('site-lat').value) {
      facility('site-lat').value = t.site.lat;
      facility('site-lon').value = t.site.lon;
      facility('site-radius').value = t.site.radiusM;
    }
  }

  facility('site-location-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      // Raw text: the server refuses empty fields instead of turning them into 0, 0.
      await post('settings/site-location', { lat: facility('site-lat').value.trim(), lon: facility('site-lon').value.trim(), radiusM: Number(facility('site-radius').value || 500) });
      notify('Site location saved — drones get a distance from the site.');
      load();
    } catch (err) {
      notify(err.message, 'bad');
    }
  });

  on('server-message', (msg) => {
    if (msg.type !== 'threats' || pending) return;
    pending = true;
    setTimeout(() => {
      pending = false;
      load();
    }, 800);
  });

  return {
    start() {
      load();
      clearInterval(timer);
      timer = setInterval(load, 4000);
    },
    refreshConfig: () => load({ force: true }),
  };
}
