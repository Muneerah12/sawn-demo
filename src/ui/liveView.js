import { AuthStatus, Origin } from '../core/constants.js';
import { proximity, signalOf } from '../core/deviceTracker.js';
import { SENSITIVE_TYPES, TYPE_LABEL } from '../core/deviceType.js';
import { confidenceOf, confidenceTone } from '../core/confidence.js';
import { maskIdentifier } from '../core/identifiers.js';
import { el, formatAge, formatTime, statusBadge } from './dom.js';
import { STATUS_ICON, TYPE_ICON, icon } from './icons.js';
import { signalMeter, sparkline } from './charts.js';

const SENSOR_STALE_MS = 30_000;
const MAX_DEVICE_ROWS = 300;
const STATUS_SHORT = { AUTHORIZED: 'Authorized', UNKNOWN: 'Unknown', VERIFIED_UNAUTHORIZED: 'Unauthorized' };

const SOURCE_LABEL = { ap: 'access point', adv: 'BLE advert', probe: 'probe request', assoc: 'association', data: 'data frame' };

const actionButton = (label, action, data, className = 'btn btn-sm') =>
  el('button', { className, text: label, attrs: { type: 'button', 'data-action': action, ...data } });

export function createLiveView(root = document) {
  const $ = (id) => root.getElementById(id);

  function renderBridge(bridge) {
    const node = $('bridge-info');
    if (!bridge) {
      node.textContent = 'No local bridge (connected directly to a sensor).';
      return;
    }
    const lines = [];
    const serial = bridge.serial ?? {};
    if (!serial.available) lines.push('USB: serial support unavailable on the server.');
    else if (serial.paused) lines.push('USB: ports released for flashing — resuming shortly.');
    else if (!serial.ports?.length) lines.push('USB: no ESP32 detected — plug in the sensor.');
    for (const p of serial.ports ?? []) {
      const parser = p.parser ?? {};
      const parserText = Number.isFinite(parser.accepted) || Number.isFinite(parser.malformed) || Number.isFinite(parser.oversized)
        ? ` · parser ${parser.accepted ?? 0} accepted, ${parser.malformed ?? 0} malformed, ${parser.oversized ?? 0} oversized`
        : '';
      lines.push(`USB ${p.path}: ${p.state}${p.sensorId ? ` (${p.sensorId})` : ''}${parserText}`);
    }
    for (const [path, err] of Object.entries(serial.errors ?? {})) {
      lines.push(`USB ${path}: ${/access denied|busy|in use/i.test(err) ? 'in use by another program (close the serial monitor)' : err}`);
    }
    for (const w of bridge.wifi ?? []) lines.push(`Wi-Fi ${w.url}: ${w.state}`);
    node.replaceChildren(...lines.map((text) => el('div', { text })));
  }

  function renderSensors(sensors, registry, now = Date.now()) {
    const trusted = new Set(registry.trustedSensors);
    const rows = [...sensors.values()].sort((a, b) => a.sensorId.localeCompare(b.sensorId));
    $('sensors-body').replaceChildren(
      ...rows.map((s) => {
        const age = now - s.receivedAt;
        const isTrusted = trusted.has(s.sensorId);
        return el('tr', {}, [
          el('td', { className: 'mono', text: s.sensorId }),
          el('td', { text: [s.transport, s.link, s.ssid && `“${s.ssid}”`, s.ip].filter(Boolean).join(' · ') }),
          el('td', {}, [el('span', { className: 'pill', text: age > SENSOR_STALE_MS ? `stale (${formatAge(age)})` : formatAge(age), attrs: { 'data-tone': age > SENSOR_STALE_MS ? 'bad' : 'ok' } })]),
          el('td', {}, [
            el('div', { text: `${s.sightings ?? 0} / cycle #${s.cycle ?? 0}` }),
            s.apScanState
              ? el('div', {
                  className: 'sub',
                  text: `Diagnostics — AP scan ${s.apScanState}; start error ${s.apScanStartError ?? '—'}, final ${s.apScanResult ?? '—'}; ${s.apScanDoneSeen ? `driver done status ${s.apScanDoneStatus ?? '—'}, ${s.apScanDoneNumber ?? 0} reported` : 'no driver-done event'}; ${s.apScanElapsedMs ?? '—'} ms; ${s.apScanFound ?? 0} found, ${s.apScanQueued ?? 0} queued, ${s.apScanEmitted ?? 0} AP-source emitted, ${s.apScanDropped ?? 0} aggregator-dropped${s.apScanCompletedAt ? `; completed ${formatAge(now - s.apScanCompletedAt)} ago` : ''}`,
                })
              : null,
            s.buffered ? el('div', { className: 'sub warn-text', text: `${s.buffered} offline record(s) waiting to send` }) : null,
            s.clockSynced === false && s.transport === 'wifi' ? el('div', { className: 'sub', text: 'clock not synced (no internet)' }) : null,
          ]),
          el('td', { text: String((s.droppedTotal ?? 0) + (s.bufferDropped ?? 0)) }),
          el('td', { text: s.fw ?? '' }),
          el('td', {}, [
            actionButton(isTrusted ? 'Trusted ✓' : 'Trust', 'toggle-trust', { 'data-sensor': s.sensorId }, `btn btn-sm ${isTrusted ? 'btn-ok' : ''}`),
          ]),
        ]);
      }),
    );
    $('sensors-empty').hidden = rows.length > 0;
    const untrusted = rows.filter((s) => !trusted.has(s.sensorId)).length;
    $('sensors-warning').hidden = untrusted === 0;
  }

  // Rows the operator expanded stay expanded across the 1 s re-render.
  const expanded = new Set();
  const toggleExpanded = (key) => (expanded.has(key) ? expanded.delete(key) : expanded.add(key));

  /** Short human title for a device: its own name, hostname, model, or inferred type. */
  function titleOf(d, host) {
    if (d.source === 'ap') return d.name ? `Wi-Fi network “${d.name}”` : 'Hidden Wi-Fi network';
    const likely = d.kind?.confidence === 'low' ? 'Likely ' : '';
    return d.name ?? host?.hostname ?? d.kind?.model ?? d.kind?.familyLabel ?? `${likely}${(TYPE_LABEL[d.kind?.type] ?? 'Unidentified device').toLowerCase()}`.replace(/^./, (c) => c.toUpperCase());
  }

  /**
   * Compact row (status · device · signal · last seen · quick actions) with an expandable
   * detail panel for everything else.
   * lookups.lan(mac) -> { ip, hostname } (this PC's network); lookups.network(bssid) -> SSID.
   */
  function renderDevices(devices, { reveal, findEntry, lan, network, zone = null, now = Date.now() }) {
    const shown = devices.slice(0, MAX_DEVICE_ROWS);
    const showId = (id) => (reveal ? id : maskIdentifier(id));
    const muted = (text) => el('div', { className: 'sub', text });
    const iconButton = (iconName, label, action, key, cls = '') =>
      el('button', { className: `btn btn-icon ${cls}`, attrs: { type: 'button', 'data-action': action, 'data-key': key, title: label, 'aria-label': label } }, [
        icon(iconName, { size: 16 }),
      ]);

    const rows = [];
    for (const d of shown) {
      const entry = d.origin === Origin.LIVE ? findEntry(d.identifier, d.protocol) : null;
      const signal = signalOf(d);
      const threshold = zone ? zone(d.protocol) : null;
      const atGate = zone && Number.isFinite(signal) && signal >= threshold;
      // Wi-Fi MACs match this PC's ARP table only for devices on the same network.
      const host = d.protocol === 'Wi-Fi' ? lan(d.identifier) : null;
      const vendor = d.vendor ?? d.mfrName;
      const isOpen = expanded.has(d.key);
      const evidenceLabel = d.kind?.typeScore ? TYPE_LABEL[d.kind.type] : d.kind?.familyScore ? `${d.kind.family} family` : null;
      const evidenceScore = d.kind?.typeScore ?? d.kind?.familyScore ?? 0;

      // Airspace is an observation and investigation surface. Device-registration
      // decisions happen only in Facility Profile → Device Registry.
      const quick = d.origin === Origin.LIVE
        ? [iconButton('registry', 'Review in Device Registry', 'review-registry', d.key)]
        : [el('span', { className: 'badge badge-demo', text: 'DEMO' })];
      const chevron = el('button', {
        className: `btn btn-icon btn-ghost chevron ${isOpen ? 'open' : ''}`,
        attrs: { type: 'button', 'data-action': 'toggle-details', 'data-key': d.key, 'aria-expanded': String(isOpen), 'aria-label': 'Show details', title: 'Details' },
      }, [icon('chevron', { size: 16 })]);

      rows.push(
        el('tr', { className: `dev-row row-${d.severity} ${d.origin === Origin.DEMO ? 'row-demo' : ''} ${isOpen ? 'is-open' : ''}` }, [
          el('td', {}, [
            el('span', { className: `status st-${d.status.toLowerCase()}` }, [icon(STATUS_ICON[d.status], { size: 18 }), document.createTextNode(STATUS_SHORT[d.status])]),
            atGate ? el('div', {}, [el('span', { className: 'chip chip-gate' }, [icon('gate', { size: 12 }), document.createTextNode('at the gate')])]) : null,
          ]),
          el('td', {}, [
            el('div', { className: 'dev-title' }, [
              el('span', { className: 'dev-type-icon', attrs: { title: d.kind?.familyLabel ?? TYPE_LABEL[d.kind?.type] ?? 'Unknown type' } }, [icon(TYPE_ICON[d.kind?.type] ?? 'device', { size: 20 })]),
              el('div', {}, [
                el('div', { className: 'dev-name' }, [
                  document.createTextNode(titleOf(d, host)),
                  evidenceLabel ? el('span', { className: `conf-chip conf-${confidenceTone(evidenceScore)}`, text: `${evidenceLabel} ${evidenceScore}%`, attrs: { title: d.kind?.typeScore ? 'Classification evidence — expand the row for the evidence' : 'Observed family evidence; exact device category was not broadcast' } }) : null,
                ]),
                el('div', { className: 'sub dev-id' }, [
                  icon(d.protocol === 'BLE' ? 'bluetooth' : 'wifi', { size: 12, label: d.protocol }),
                  el('span', { className: 'mono', text: showId(d.identifier) }),
                  vendor ? document.createTextNode(` · ${vendor}`) : null,
                ]),
              ]),
            ]),
          ]),
          el(
            'td',
            { attrs: { title: 'Median of recent readings. The white tick marks the gate edge.' } },
            Number.isFinite(signal)
              ? [signalMeter(signal, { threshold: zone ? threshold : null }), muted(`${Math.round(signal)} dBm · ${proximity(signal)}`)]
              : [muted('no reading')],
          ),
          el('td', { text: formatAge(now - d.lastSeen), attrs: { title: formatTime(d.lastSeen) } }),
          el('td', { className: 'actions' }, [...quick, chevron]),
        ]),
      );

      if (isOpen) rows.push(detailRow(d, { entry, host, signal, threshold, zone, showId, network, muted }));
    }

    $('devices-body').replaceChildren(...rows);
    $('devices-empty').hidden = devices.length > 0;
    $('devices-truncated').hidden = devices.length <= MAX_DEVICE_ROWS;
    $('devices-truncated').textContent = `Showing ${MAX_DEVICE_ROWS} of ${devices.length} devices — use the filters to narrow down.`;
  }

  /** Separate evidence strengths with their reasons; never combine unlike dimensions. */
  function confidencePanel(c) {
    const bar = (label, part) =>
      el('div', { className: 'conf-row', attrs: { title: part.reason } }, [
        el('span', { className: 'conf-label', text: label }),
        el('span', { className: 'conf-track' }, [el('i', { className: `conf-fill conf-${confidenceTone(part.pct)}`, attrs: { style: `width:${part.pct}%` } })]),
        el('b', { className: 'conf-pct', text: `${part.pct}%` }),
        el('span', { className: 'sub conf-reason', text: part.reason }),
      ]);
    return el('div', { className: 'conf-panel' }, [
      bar('Identity continuity', c.identity),
      bar('Signal consistency', c.distance),
      c.family ? bar('Observed family', c.family) : null,
      bar('Classification evidence', c.type),
      bar('OS-family evidence', c.os),
      el('div', { className: 'conf-note sub', text: 'No combined score — these evidence dimensions answer different questions.' }),
    ]);
  }

  function detailRow(d, { entry, host, signal, threshold, zone, showId, network, muted }) {
    const field = (label, ...value) => el('div', { className: 'field-item' }, [el('div', { className: 'field-label', text: label }), ...value.filter(Boolean)]);
    const kind = d.kind;
    const tags = [];
    if (!d.stableIdentifier) tags.push(el('span', { className: 'tag', text: 'randomized address' }));
    if (d.source) tags.push(el('span', { className: 'tag', text: SOURCE_LABEL[d.source] ?? d.source }));

    let networkText = d.protocol === 'BLE' ? '— (Bluetooth)' : 'not seen connected';
    if (d.source === 'ap') networkText = d.name ? `access point broadcasting “${d.name}”` : 'access point (hidden network)';
    else if (d.bssid) networkText = `${network(d.bssid) ? `“${network(d.bssid)}”` : 'connected (name not seen yet)'} via ${showId(d.bssid)}`;

    const history = (d.samples ?? []).map((s) => s.v);
    const actions = [];
    if (d.origin === Origin.LIVE) {
      actions.push(el('button', { className: 'btn btn-sm', attrs: { type: 'button', 'data-action': 'review-registry', 'data-key': d.key } }, [icon('registry', { size: 14 }), document.createTextNode('Review in Device Registry')]));
    }

    return el('tr', { className: 'detail-row' }, [
      el('td', { attrs: { colspan: '5' } }, [
        el('div', { className: 'detail-grid' }, [
          field(
            'Classification',
            el('div', { text: kind && kind.type !== 'unknown' ? `${kind.confidence === 'low' ? 'likely ' : ''}${TYPE_LABEL[kind.type]}` : kind?.familyLabel ?? 'not identified' }),
            kind?.model ? muted(kind.model) : null,
            kind?.family && kind?.type !== 'unknown' ? muted(`Observed family: ${kind.family}`) : null,
            muted(kind?.os ? `OS: ${kind.os}` : kind?.family ? 'OS: category not broadcast' : 'OS: not identified'),
            SENSITIVE_TYPES[kind?.type] ? el('div', { className: 'warn-text', text: SENSITIVE_TYPES[kind.type] }) : null,
          ),
          field('Confidence', confidencePanel(confidenceOf(d, kind))),
          d.remoteId
            ? field(
                'Drone Remote ID',
                el('div', { text: `${d.remoteId.uasId ?? 'ID not received yet'}${d.remoteId.uaType ? ` · ${d.remoteId.uaType}` : ''}` }),
                muted(Number.isFinite(d.remoteId.lat) ? `position ${d.remoteId.lat.toFixed(5)}, ${d.remoteId.lon.toFixed(5)}${d.remoteId.height !== null && d.remoteId.height !== undefined ? ` · ${d.remoteId.height} m` : ''}` : 'position not received yet'),
                d.remoteId.operatorLat ? muted(`operator ${d.remoteId.operatorLat.toFixed(5)}, ${d.remoteId.operatorLon.toFixed(5)}`) : null,
                muted(d.remoteId.transport),
              )
            : null,
          field('Identifier', el('div', { className: 'mono', text: showId(d.identifier) }), muted(d.vendor ?? d.mfrName ?? 'vendor unknown'), el('div', { className: 'tags' }, tags)),
          field('Name', el('div', { text: d.name ?? host?.hostname ?? '—' }), d.probe ? muted(`looking for “${d.probe}”`) : null),
          field('Wi-Fi network', el('div', { text: networkText })),
          field('IP address', el('div', { className: 'mono', text: host?.ip ?? '—' }), host?.hostname ? muted(host.hostname) : null),
          field('Seen by', el('div', { text: d.sensorId }), muted(`${d.protocol} · first seen ${formatAge(Date.now() - d.firstSeen)}`)),
          field(
            'Signal (last 20 s)',
            history.length > 1 ? sparkline(history, { width: 140, height: 30 }) : null,
            muted(Number.isFinite(signal) ? `median ${Math.round(signal)} dBm · last ${d.rssi ?? '—'} · ${d.recentReadings ?? 0} reading(s)/12 s` : 'no reading'),
            Number.isFinite(threshold) ? muted(`gate edge ${threshold} dBm`) : null,
          ),
          field('Authorization', el('div', { text: d.reason })),
          field(
            'Evidence (weight)',
            kind?.evidenceDetail?.length
              ? el('ul', { className: 'evidence-list' }, kind.evidenceDetail.map((e) => el('li', { className: `ev-${e.supports}` }, [el('b', { text: `${e.supports === 'other' ? '−' : '+'}${e.weight}%` }), document.createTextNode(` ${e.text}${e.supports === 'other' ? ` (suggests ${TYPE_LABEL[e.type] ?? e.type})` : ''}`)])))
              : muted('nothing identifying was broadcast'),
          ),
        ]),
        actions.length ? el('div', { className: 'row detail-actions' }, actions) : null,
      ]),
    ]);
  }

  function renderRegistryReview(registry, review, { reveal }) {
    const node = $('registry-review');
    if (!node) return;
    if (!review) {
      node.hidden = true;
      node.replaceChildren();
      return;
    }

    const entry = registry.devices.find((d) => d.id === review.identifier && d.protocol === review.protocol);
    const shown = reveal ? review.identifier : maskIdentifier(review.identifier);
    const observedAt = Number.isFinite(review.lastSeen) ? formatAge(Date.now() - review.lastSeen) : 'time not available';
    const status = entry ? (entry.status === 'DENIED' ? 'Registered: unauthorized' : 'Registered: authorized') : 'Not registered';
    const actions = [
      !entry || entry.status !== 'AUTHORIZED' ? actionButton('Authorize device', 'registry-authorize', {}, 'btn btn-sm btn-ok') : null,
      !entry || entry.status !== 'DENIED' ? actionButton('Mark unauthorized', 'registry-deny', {}, 'btn btn-sm btn-danger') : null,
      entry ? actionButton('Remove registration', 'registry-unregister', {}, 'btn btn-sm') : null,
      Number.isFinite(signalOf(review)) && Date.now() - review.lastSeen <= 15_000
        ? actionButton('Calibrate gate edge', 'registry-calibrate', {}, 'btn btn-sm')
        : null,
      actionButton('Close review', 'registry-clear-review', {}, 'btn btn-sm btn-ghost'),
    ].filter(Boolean);

    node.hidden = false;
    node.replaceChildren(
      el('div', { className: 'registry-review' }, [
        el('div', { className: 'toolbar' }, [
          el('div', {}, [
            el('h3', { text: 'Device under review' }),
            el('p', { className: 'sub', text: 'Observed from Airspace. This is a registry decision, not a monitoring action.' }),
          ]),
          el('span', { className: 'pill', text: status, attrs: { 'data-tone': entry ? (entry.status === 'DENIED' ? 'bad' : 'ok') : 'warn' } }),
        ]),
        el('dl', { className: 'kv' }, [
          el('dt', { text: 'Identifier' }), el('dd', { className: 'mono', text: shown }),
          el('dt', { text: 'Protocol' }), el('dd', { text: review.protocol }),
          el('dt', { text: 'Observed name' }), el('dd', { text: review.name ?? '—' }),
          el('dt', { text: 'Last observed' }), el('dd', { text: observedAt }),
          el('dt', { text: 'Observed by' }), el('dd', { text: review.sensorId ?? '—' }),
        ]),
        el('div', { className: 'row wrap' }, actions),
      ]),
    );
  }

  function renderRegistry(registry, { reveal, review = null }) {
    renderRegistryReview(registry, review, { reveal });
    $('registry-body').replaceChildren(
      ...registry.devices.map((d, index) =>
        el('tr', {}, [
          el('td', {}, [statusBadge(d.status === 'DENIED' ? AuthStatus.VERIFIED_UNAUTHORIZED : AuthStatus.AUTHORIZED)]),
          el('td', { className: 'mono', text: reveal ? d.id : maskIdentifier(d.id) }),
          el('td', { text: d.protocol }),
          el('td', { text: d.status === 'DENIED' ? `Unauthorized: ${d.reason ?? ''}` : `Authorized${d.label ? `: ${d.label}` : ''}` }),
          el('td', { text: [d.verifiedBy, d.verifiedAt && formatTime(Date.parse(d.verifiedAt))].filter(Boolean).join(' · ') }),
          el('td', {}, [actionButton('Remove', 'remove-entry', { 'data-index': String(index) })]),
        ]),
      ),
    );
    $('registry-empty').hidden = registry.devices.length > 0;
    $('registry-info').textContent = `${registry.devices.length} registered device(s), ${registry.trustedSensors.length} trusted sensor(s)`;
    $('trusted-list').textContent = registry.trustedSensors.length ? registry.trustedSensors.join(', ') : 'none — trust a sensor in Sensors above';
  }

  function setRegistryMessage(text, tone = 'idle') {
    const node = $('registry-msg');
    node.textContent = text;
    node.dataset.tone = tone;
  }

  return { renderBridge, renderSensors, renderDevices, toggleExpanded, renderRegistry, setRegistryMessage };
}
