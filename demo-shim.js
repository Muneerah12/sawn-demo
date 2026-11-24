// SAWN static demo copy: this page runs without the SAWN server. Every /api/ request is answered from
// a recording (data/api.json, made by scripts/demo-capture.mjs and cleaned by scripts/build-demo.mjs);
// times are moved forward so the recording always looks recent; nothing can be changed (read-only);
// the live connections to the server are replaced by silent ones. A ribbon says so on every page.
(function () {
  const BASE = '/sawn-demo';
  let DATA = null;
  const realFetch = window.fetch.bind(window);
  const ready = realFetch(BASE + '/data/api.json').then((r) => r.json()).then((d) => { DATA = d; });
  // Recorded flights replayed in a loop, so the sky moves like the live page (positions interpolated
  // between recorded points). Each flight plays for 2-6 minutes; together they fill a 15-minute loop.
  let FLIGHTS = [];
  realFetch(BASE + '/data/flights.json').then((r) => (r.ok ? r.json() : { flights: [] })).then((d) => { FLIGHTS = (d.flights || []).filter((f) => f.points && f.points.length >= 2); }).catch(() => {});
  const LOOP = 15 * 60000;
  const distM = (a, b, c, d) => { const R = 6371000, r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return Math.round(2 * R * Math.asin(Math.sqrt(x))); };
  function livePlanes(site) {
    const now = Date.now(), out = [];
    FLIGHTS.forEach((f, i) => {
      const p = f.points, t0 = p[0][0], t1 = p[p.length - 1][0], real = Math.max(1, t1 - t0);
      const play = Math.min(6, Math.max(2, real / 60000)) * 60000;
      const local = (((now - (i * LOOP) / FLIGHTS.length * 2.3) % LOOP) + LOOP) % LOOP;
      if (local > play) return;
      const t = t0 + (local / play) * real;
      let k = 0; while (k < p.length - 2 && p[k + 1][0] < t) k++;
      const a = p[k], b = p[k + 1], u = Math.min(1, Math.max(0, (t - a[0]) / Math.max(1, b[0] - a[0]))), mix = (j) => (a[j] == null || b[j] == null ? (a[j] ?? b[j] ?? null) : a[j] + (b[j] - a[j]) * u);
      const lat = mix(1), lon = mix(2);
      out.push({ hex: f.hex, kind: 'aircraft', callsign: f.callsign, registration: f.registration, type: f.type, squawk: f.squawk, lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6,
        altitudeFt: a[3] == null ? null : Math.round(mix(3)), onGround: false, speedKt: a[4] == null ? null : Math.round(mix(4)), track: a[5] == null ? null : Math.round(a[5]) % 360,
        verticalRateFpm: null, distanceM: site ? distM(site.lat, site.lon, lat, lon) : null, seenAt: now - 1500, level: f.level || 'normal', restricted: !!f.restricted, emergency: null });
    });
    return out;
  }
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  // Move every recorded time forward by the age of the recording.
  function shift(v, delta, lo, hi) {
    if (typeof v === 'number') return v > lo && v < hi && Number.isInteger(v) ? v + delta : v;
    if (Array.isArray(v)) return v.map((x) => shift(x, delta, lo, hi));
    if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = shift(v[k], delta, lo, hi); return o; }
    return v;
  }
  const answer = (key) => {
    let body = DATA.api[key];
    if (body === undefined) { const p = key.split('?')[0]; const k = Object.keys(DATA.api).find((x) => x.split('?')[0] === p); if (k) body = DATA.api[k]; }
    if (body === undefined && key.startsWith('/api/airspace/history/replay')) {
      const sat = Object.entries(DATA.api).find(([k]) => k.startsWith('/api/airspace/history/satellites'));
      body = { from: DATA.capturedAt - 86400000, to: DATA.capturedAt, aircraft: [], passes: sat ? sat[1].passes || [] : [], note: null };
    }
    if (body === undefined) return undefined;
    const T = DATA.capturedAt;
    return shift(body, Date.now() - T, T - 400 * 86400000, T + 40 * 86400000);
  };
  // Sign-in for the online copy: user name "admin" and the agreed password (only its SHA-256 is kept here).
  // This is a gate for a shared link, not real security: the recorded data ships with the page.
  const USER = 'admin', PASS_SHA256 = '8122cba12b897aa5546baf90b6c82c9f646f976b3555033cbc5e0b72d4f7a5bc', KEY = 'sawn.demo.in';
  const signedIn = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
  const setSigned = (on) => { try { if (on) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch (e) {} };
  const sha256 = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    // The large AI models are not in this copy: the same files come from Hugging Face.
    const hf = url.origin === location.origin ? /\/vendor\/hf\/(onnx-community\/[\w.-]+)\/(.+)$/.exec(url.pathname) : null;
    if (hf) return realFetch(`https://huggingface.co/${hf[1]}/resolve/main/${hf[2]}`, init);
    const i = url.pathname.indexOf('/api/');
    if (i < 0) return realFetch(input, init);
    await ready;
    const path = url.pathname.slice(i), method = (init.method || 'GET').toUpperCase();
    if (path === '/api/login' && method === 'POST') {
      let b = {}; try { b = JSON.parse(init.body || '{}'); } catch (e) {}
      const ok = String(b.username || '').trim().toLowerCase() === USER && (await sha256(String(b.password || ''))) === PASS_SHA256;
      if (!ok) return json(401, { error: 'اسم المستخدم أو كلمة المرور غير صحيحة · Wrong user name or password.' });
      setSigned(true);
      const s = answer('/api/session') || {};
      return json(200, { user: s.user, permissions: s.permissions || [] });
    }
    if (path === '/api/logout' && method === 'POST') { setSigned(false); return json(200, { ok: true }); }
    if (path === '/api/session' && !signedIn()) return json(200, { setupRequired: false, user: null, permissions: [], training: false, preview: null });
    if (!signedIn()) return json(401, { error: 'Please sign in.' });
    if (method !== 'GET') return json(403, { error: 'نسخة عرض للقراءة فقط · This is a read-only demo copy' });
    // The recordings library: the numbered camera videos shipped with the copy (media/camera-N.mp4).
    const vid = /^\/api\/recordings\/demo-camera-(\d+)\/video$/.exec(path);
    if (vid) return realFetch(BASE + '/media/camera-' + vid[1] + '.mp4');
    if (path === '/api/recordings') return json(200, { recordings: [2, 3, 4, 5].map((n, k) => ({ id: 'demo-camera-' + n, name: 'Camera ' + n, kind: 'gate camera', type: 'video/mp4', size: [10321114, 1831926, 12596893, 6406124][k], by: 'admin', at: DATA.capturedAt - (4 - k) * 3600000 + (Date.now() - DATA.capturedAt) })) });
    let body = answer(url.pathname.slice(i) + url.search);
    if (body && path === '/api/airspace/aircraft') body = { ...body, list: livePlanes(body.site), fetchedAt: Date.now(), error: null, liveFailures: 0 };
    // Replayed as if live: the boards and links of the recorded session are shown reporting now.
    const now = Date.now();
    const LIVE_ROWS = { 'AS-1': 'esp32-6a3d3c reporting', link: 'Wi-Fi', A1: 'Found by the board (reader ready)', 'board-a': 'Reporting · firmware gate-a · Wi-Fi -58 dBm', 'board-b': 'Reporting · firmware gate-b-0.5.0 · Wi-Fi -56 dBm', 'b-nfc': 'Found by the board', 'b-keypad': 'Found by the board', 'b-finger': 'Found by the board', vault: 'All 5 armed: laser-1, laser-2, reed-vault, pir, pressure', face: 'Linked to SAWN', consoles: '1 console open' };
    if (body && path === '/api/readiness' && Array.isArray(body.health)) body = { ...body, health: body.health.map((h) => (LIVE_ROWS[h.id] && h.status !== 'sim' ? { ...h, status: 'ok', detail: LIVE_ROWS[h.id] } : h)) };
    if (body && path === '/api/status') body = { ...body, bridge: body.bridge && { ...body.bridge, wifi: (body.bridge.wifi || []).map((w) => ({ ...w, state: 'connected', lastLineAt: now - 2000 })) }, sensors: (body.sensors || []).map((s) => ({ ...s, link: 'connected', receivedAt: now - 2000, online: true })) };
    if (body && path === '/api/gate') body = { ...body,
      boards: (body.boards || []).map((b) => ({ ...b, known: true, fresh: true, receivedAt: now - 5000, dev: b.readerId === 'gate-level-5' ? { ...b.dev, nfc: 'ok' } : b.dev, vault: b.readerId === 'gate-level-5' ? 'laser-1,laser-2,reed-vault,pir,pressure' : b.vault })),
      mesh: body.mesh && { ...body.mesh, fresh: true, reportedAt: now - 5000, sensor: body.mesh.sensor && { ...body.mesh.sensor, heard: true, ageMs: 3000 } } };
    // Registered devices: the copy masks the last three bytes of every address; fill them the same way
    // the replayed sensor stream does, so registered devices are recognised.
    if (body && path === '/api/registry') body = { ...body, trustedSensors: [...new Set([...(body.trustedSensors || []), SENSOR])], devices: (body.devices || []).map((d) => ({ ...d, id: fillMac(d.id) })) };
    // A drone's track for the history replay: the same flight, sampled every 5 s over the asked window.
    if (path === '/api/airspace/history/drone') {
      const site = { ...SITE }, to = Number(url.searchParams.get('to')) || Date.now(), from = Number(url.searchParams.get('from')) || to - 600000;
      const step = Math.max(5000, Math.ceil((to - from) / 600)), points = [];
      for (let t = from; t <= to; t += step) { const d = liveDrone(site, t), r = d.remoteId; points.push([t, r.lat, r.lon, r.height, r.speed, r.heading, r.operatorLat, r.operatorLon, d.rssi, d.distance]); }
      return json(200, { key: url.searchParams.get('key'), from, to, points });
    }
    if (body && path === '/api/airspace/threats') { const site = body.site || { ...SITE }; body = { ...body, site, drones: [liveDrone(site)] }; }
    return body === undefined ? json(404, { error: 'غير متاح في نسخة العرض · Not available in the demo copy' }) : json(200, body);
  };
  // ---- The airspace sensor, replayed: its registered devices plus devices passing by, with a signal that
  // drifts as people move, and one drone sending Remote ID (position, height, speed, pilot position).
  const SENSOR = 'esp32-6a3d3c', SITE = { lat: 24.7136, lon: 46.6753, radiusM: 500 };
  const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const hx = (n) => (n & 255).toString(16).toUpperCase().padStart(2, '0');
  const fillMac = (id) => (typeof id === 'string' && /XX:XX:XX$/.test(id) ? id.replace(/XX:XX:XX$/, ((h) => `${hx(h)}:${hx(h >> 8)}:${hx(h >> 16)}`)(hash(id + '|sawn'))) : id);
  const PASSERS = [
    { id: '5A:3C:91:7E:02:4D', protocol: 'ble', addressType: 'random', mfr: 76, md: '1005031c', base: -72 },
    { id: '6E:11:A0:42:9B:C3', protocol: 'ble', addressType: 'random', mfr: 76, md: '100c1e1b', base: -80 },
    { id: '74:D4:23:5B:10:8E', protocol: 'ble', addressType: 'public', mfr: 117, base: -77, name: 'Galaxy Buds2' },
    { id: 'C8:3A:35:61:7F:20', protocol: 'wifi', base: -84, probe: 'STC-WiFi' },
    { id: 'DA:A1:19:3B:44:5E', protocol: 'wifi', base: -69, probe: 'iPhone' },
    { id: '60:60:1F:A2:5D:77', protocol: 'wifi', base: -86, name: 'DJI-RC-N1' },
    { id: '3C:71:BF:0A:6E:12', protocol: 'ble', addressType: 'public', base: -88, name: 'Mi Band 7' },
  ];
  let FEED = null;
  function feedDevices() {
    if (FEED) return FEED;
    const reg = (DATA && DATA.api['/api/registry'] && DATA.api['/api/registry'].devices) || [];
    FEED = [...reg.map((d) => ({ id: fillMac(d.id), protocol: /ble/i.test(d.protocol) ? 'ble' : 'wifi', addressType: 'public', base: -48 - (hash(d.id) % 30) })), ...PASSERS];
    return FEED;
  }
  function observations() {
    const t = Date.now();
    return feedDevices().map((d, i) => {
      const wave = Math.sin(t / 9000 + i * 1.7) * 6 + Math.sin(t / 2300 + i) * 2;
      const rssi = Math.max(-97, Math.min(-30, Math.round(d.base + wave)));
      const o = { type: 'obs', sensorId: SENSOR, protocol: d.protocol, id: d.id, rssi, rssiAvg: rssi, count: 1 + (i % 4), src: d.protocol === 'ble' ? 'adv' : d.probe ? 'probe' : 'data', timestamp: t };
      if (d.addressType) o.addressType = d.addressType;
      if (d.mfr != null) o.mfr = d.mfr;
      if (d.md) o.md = d.md;
      if (d.name) o.name = d.name;
      if (d.probe) o.probe = d.probe;
      return o;
    });
  }
  const heartbeat = () => ({ type: 'sensor', sensorId: SENSOR, fw: '0.6.0', board: 'esp32dev', transport: 'wifi', link: 'connected', wifiRssi: -58, uptimeMs: Math.round(performance.now()) + 3600000, cycle: Math.floor(Date.now() / 2000) % 100000, sightings: feedDevices().length, dropped: 0, droppedTotal: 0, clock: 'ntp', receivedAt: Date.now() });
  // A drone circling ~350 m north-east of the site; its pilot stands still ~700 m away.
  function liveDrone(site, t = Date.now()) {
    const a = t / 40000, m = 1 / 111320, k = Math.cos(site.lat * Math.PI / 180);
    const lat = site.lat + (250 + Math.cos(a) * 120) * m, lon = site.lon + (250 + Math.sin(a) * 120) * m / k;
    const opLat = site.lat + 520 * m, opLon = site.lon + 470 * m / k;
    const d = (aLat, aLon, bLat, bLon) => Math.round(Math.hypot((aLat - bLat) / m, (aLon - bLon) * k / m));
    const rid = { transport: 'Wi-Fi beacon', messages: ['Basic ID', 'Location', 'System', 'Operator ID'], idType: 'Serial number (ANSI/CTA-2063-A)', uaType: 'Helicopter or multirotor', uasId: '1581F5FKD239500C0H7W', status: 'Airborne',
      heading: Math.round(((a * 180) / Math.PI + 90) % 360), speed: 6.3, verticalSpeed: 0, lat: Math.round(lat * 1e7) / 1e7, lon: Math.round(lon * 1e7) / 1e7, altitudeBaro: 118, altitudeGeo: 121, height: 92, heightRef: 'above take-off',
      operatorLat: Math.round(opLat * 1e7) / 1e7, operatorLon: Math.round(opLon * 1e7) / 1e7, operatorLocationType: 'Live GNSS', operatorId: 'SAU-OP-48211' };
    const ds = d(site.lat, site.lon, lat, lon), ps = d(site.lat, site.lon, opLat, opLon);
    return { key: 'Wi-Fi|60:60:1F:B4:2C:91', identifier: '60:60:1F:B4:2C:91', protocol: 'Wi-Fi', sensorId: SENSOR, name: 'DJI Mini 4 Pro', detection: 'Remote ID (Wi-Fi beacon)', typeScore: 0.97, remoteId: rid,
      rssi: -66 + Math.round(Math.sin(a * 3) * 4), distance: ds, pilot: { lat: rid.operatorLat, lon: rid.operatorLon, type: 'Live GNSS', operatorId: rid.operatorId, distanceToSiteM: ps, distanceToDroneM: d(opLat, opLon, lat, lon), inside: site.radiusM ? ps <= site.radiusM : null },
      firstSeen: t - 6 * 60000, lastSeen: t - 1000 };
  }
  // The live channels have no server here: the sensor channel replays the stream above, the others stay quiet.
  class QuietSocket {
    constructor(url) {
      this.readyState = 0;
      setTimeout(() => { this.readyState = 1; if (this.onopen) this.onopen({}); }, 60);
      if (/\/observations$/.test(String(url))) {
        const push = () => { if (this.readyState !== 1 || !this.onmessage || !DATA) return; this.onmessage({ data: JSON.stringify([heartbeat(), ...observations()]) }); };
        this.timer = setInterval(push, 2000);
        setTimeout(push, 800);
      }
    }
    send() {}
    close() { clearInterval(this.timer); this.readyState = 3; if (this.onclose) this.onclose({}); }
    addEventListener(t, f) { this['on' + t] = f; }
    removeEventListener() {}
  }
  QuietSocket.CONNECTING = 0; QuietSocket.OPEN = 1; QuietSocket.CLOSING = 2; QuietSocket.CLOSED = 3;
  window.WebSocket = QuietSocket;
  window.SAWN_DEMO = true;
  addEventListener('DOMContentLoaded', () => {
    const r = document.createElement('div');
    r.textContent = 'نسخة عرض · إعادة تشغيل بيانات مسجّلة · للقراءة فقط  |  Demo copy · replay of recorded data · read-only';
    r.style.cssText = 'position:fixed;bottom:0;left:50%;transform:translateX(-50%);z-index:99999;background:#8B1E24;color:#fff;font:600 12px system-ui,sans-serif;padding:5px 14px;border-radius:10px 10px 0 0;pointer-events:none;opacity:.92;white-space:nowrap;max-width:100vw;overflow:hidden;text-overflow:ellipsis';
    document.body.appendChild(r);
  });
})();
