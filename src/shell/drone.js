// Drone DR-1 and camera feeds. The flight and the video are simulated; every dispatch, recall
// and attached piece of evidence is a real, audited record linked to the incident.
import { isOpen } from '../shared/scenarios.js';
import { post } from './api.js';
import { on, session } from './hub.js';
import { createAiCameras } from './aiCameras.js';
import { createCameraZones } from './cameras.js';
import { createPeopleSearch } from './peopleSearch.js';
import { DRONE_TARGETS, boxLabel, drawFeed, drawZones } from './facility.js';
import { state } from './store.js';
import { clock, h, notify } from './ui.js';

const DST = { docked: 'On its pad', takeoff: 'En route', hover: 'Hovering · live feed', returning: 'Returning to pad' };

export function createDrone({ root, model }) {
  const drone = { state: 'docked', bat: 96, inc: null, t0: 0, tname: '', log: [] };
  const $ = (id) => root.querySelector(`#${id}`);
  const zonesUi = createCameraZones({ root });
  const aiCams = createAiCameras({ root });
  createPeopleSearch({ root });
  const target = $('dr-target');
  target.replaceChildren(...DRONE_TARGETS.map(([n], k) => h('option', { attrs: { value: String(k) }, text: n })));
  $('dr-go').addEventListener('click', () => {
    const [n, at] = DRONE_TARGETS[Number(target.value)];
    dispatch(at, null, n);
  });
  $('dr-back').addEventListener('click', async () => {
    if (drone.state === 'docked') return;
    model?.droneRecall();
    drone.t0 = performance.now() - 7500;
    drone.state = 'returning';
    try {
      await post('drone', { action: 'recall', ref: drone.inc?.ref ?? null });
    } catch (err) {
      notify(err.message, 'bad');
    }
  });

  async function dispatch(at, inc, name) {
    if (!session.can('incidents.handle')) return notify(session.why('incidents.handle'), 'bad');
    if (drone.state !== 'docked') return notify('Drone DR-1 is already on a mission', 'bad');
    const tname = name || inc?.zone || '';
    try {
      await post('drone', { action: 'dispatch', target: tname, ref: inc?.ref ?? null });
    } catch (err) {
      return notify(err.message, 'bad');
    }
    Object.assign(drone, { state: 'takeoff', t0: performance.now(), inc, tname });
    model?.droneTo(inc?.key ?? null, at);
    drone.log.unshift({ t: Date.now(), text: `Take-off to ${tname}${inc ? ` · ${inc.ref}` : ''}` });
    notify(`Drone DR-1 took off for ${tname}`);
    render();
  }

  function tick(now) {
    if (drone.state === 'docked') {
      if (drone.bat < 100 && Math.random() < 0.01) drone.bat++;
      return;
    }
    const e = (now - drone.t0) / 1000;
    const prev = drone.state;
    drone.state = e < 3.2 ? 'takeoff' : e < 7.5 ? 'hover' : e < 10.7 ? 'returning' : 'docked';
    if (drone.state !== 'docked') drone.bat = Math.max(20, drone.bat - 0.004);
    if (prev !== 'hover' && drone.state === 'hover') drone.log.unshift({ t: Date.now(), text: `Hovering over ${drone.tname} · live feed` });
    if (drone.state === 'docked') {
      drone.log.unshift({ t: Date.now(), text: 'Back on its pad' });
      if (drone.inc) {
        post('drone', { action: 'attach', ref: drone.inc.ref })
          .then(() => notify(`Drone feed attached to ${drone.inc?.ref ?? 'the incident'}`))
          .catch((err) => notify(err.message, 'bad'));
      }
      drone.inc = null;
    }
    if (prev !== drone.state) render();
  }

  function render() {
    $('dr-kv').replaceChildren(
      ...[
        ['Status', DST[drone.state]],
        ['Destination', drone.state === 'docked' ? '—' : drone.tname],
        ['Incident', drone.inc?.ref ?? '—'],
        ['Altitude', drone.state === 'docked' ? '0 m' : '15 m (simulated)'],
      ].flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { text: v })]),
    );
    $('dr-bat').style.width = `${drone.bat}%`;
    $('dr-bat').style.background = drone.bat < 40 ? 'var(--warning-ink)' : 'var(--good-ink)';
    $('dr-go').disabled = drone.state !== 'docked';
    $('dr-back').disabled = drone.state === 'docked';
    $('dr-log').replaceChildren(
      ...(drone.log.length ? drone.log.slice(0, 8).map((l) => h('li', {}, [h('time', { text: clock(l.t) }), h('span', { text: l.text })])) : [h('li', {}, [h('time', { text: '—' }), h('span', { text: 'No missions yet' })])]),
    );
    const t = $('t-dr');
    t.textContent = DST[drone.state];
    t.className = `pill ${drone.state === 'hover' ? 'st-new' : drone.state === 'docked' ? 'st-dismissed' : 'st-ack'}`;
  }

  const camActive = (cam) => state.incidents.find((x) => isOpen(x.status) && x.cam === cam && Date.now() - x.createdAt < 15_000);
  // Fire, smoke and gas stay on the picture while their incident is open.
  const HAZARD = { fire: 'fire', smoke: 'smoke', gas: 'gas' };
  const hazardOn = (cam) => state.incidents.find((x) => isOpen(x.status) && x.cam === cam && HAZARD[x.key]);
  function feeds(now) {
    if (root.hidden) return;
    for (const [id, cam, pill] of [['cv-b1', 'B1', 't-b1'], ['cv-c2', 'C2', 't-c2'], ['cv-t1', 'T1', 't-t1'], ['cv-w3', 'W3', 't-w3'], ['cv-og', 'OG', 't-og']]) {
      if (!$(id)) continue; // the simulated fixed cameras are no longer on the page
      const hz = cam === 'W3' || cam === 'OG' ? hazardOn(cam) : null;
      const i = hz ?? camActive(cam);
      const zoneOpts = cam === 'B1' || cam === 'C2' ? zonesUi.drawOptions(cam) : null;
      const ctx = $(id).getContext('2d');
      drawFeed(ctx, cam, now, {
        ...(i ? { alert: true, label: boxLabel(i), conf: i.conf } : {}),
        ...(hz ? { effect: HAZARD[hz.key] } : {}),
        ...(zoneOpts ? { zones: zoneOpts.zones, presence: zoneOpts.presence.size ? zoneOpts.presence : null, time: zoneOpts.time } : {}),
      });
      if (zoneOpts?.draft) drawZones(ctx, [], zoneOpts.draft);
      const p = $(pill);
      p.textContent = i ? `Alert · ${i.ref}` : cam === 'T1' ? 'Sweeping' : 'Normal';
      p.className = `pill ${i ? 'st-new' : 'st-confirmed'}`;
    }
    const dr = $('cv-dr').getContext('2d');
    if (drone.state === 'hover') drawFeed(dr, 'DR', now, { alert: Boolean(drone.inc), label: 'target' });
    else {
      dr.fillStyle = '#05080f';
      dr.fillRect(0, 0, 480, 270);
      dr.fillStyle = '#9aabc2';
      dr.font = '16px system-ui, sans-serif';
      dr.textAlign = 'center';
      dr.fillText(drone.state === 'docked' ? 'Drone on its pad · no feed' : 'On the way to the site…', 240, 140);
      dr.textAlign = 'left';
    }
  }

  let last = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    tick(now);
    if (now - last > 110) {
      last = now;
      feeds(now);
    }
  }
  requestAnimationFrame(loop);
  on('session', render);
  render();

  return {
    dispatch,
    busy: () => drone.state !== 'docked',
    show() {
      render();
      zonesUi.show();
      aiCams.show();
    },
  };
}
