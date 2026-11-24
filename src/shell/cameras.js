// Camera zones and the presence log on the Drone & cameras page. An operator (shift supervisor)
// draws a restricted zone on a tracking camera's picture; the server then logs who enters and
// leaves it, checks their badge and raises incidents (server/vision.mjs). This module keeps the
// zones and the "who is inside now" picture for drawing, and renders the presence log.
import { TRACKING_CAMERAS } from '../shared/cameraSim.js';
import { formatDuration } from '../shared/response.js';
import { get, post } from './api.js';
import { on, session } from './hub.js';
import { button, clock, confirmDialog, formDialog, h, notify } from './ui.js';

export function createCameraZones({ root }) {
  let zones = {};
  let presence = [];
  let serverOffset = 0; // server clock − this clock, so dwell timers agree with the log
  const drafts = {}; // cam → points being drawn
  const $ = (id) => root.querySelector(`#${id}`);

  async function loadZones() {
    try {
      zones = (await get('vision/zones')).zones ?? {};
    } catch {
      zones = {};
    }
    renderTools();
  }

  async function loadPresence() {
    try {
      const r = await get('vision/presence?limit=60');
      presence = r.presence;
      serverOffset = r.now - Date.now();
      renderLog();
    } catch {
      /* the log is optional */
    }
  }

  /** track → authorized?, for everyone inside a zone of this camera right now. */
  function insideNow(cam) {
    const m = new Map();
    for (const p of presence) if (p.cam === cam && !p.exitAt && !m.has(p.track)) m.set(p.track, p.authorized);
    return m;
  }

  async function save(cam, list, message) {
    try {
      const r = await post('vision/zones', { cam, zones: list });
      zones = { ...zones, [cam]: r.zones };
      notify(message);
      renderTools();
      loadPresence();
    } catch (err) {
      notify(err.message, 'bad');
    }
  }

  async function finish(cam) {
    const points = drafts[cam];
    if (!points || points.length < 3) return notify('Click at least three corners on the picture.', 'warn');
    const r = await formDialog({
      title: `New zone · ${TRACKING_CAMERAS[cam]}`,
      fields: [
        { name: 'name', label: 'Zone name', required: true, maxlength: 40, placeholder: 'e.g. Staff door' },
        { name: 'minLevel', label: 'Who may enter', type: 'select', options: [1, 2, 3, 4, 5].map((l) => [String(l), `Level ${l} or higher`]), value: '4' },
        { name: 'maxDwellS', label: 'Longest allowed stay in seconds (0 = no limit)', type: 'number', min: 0, max: 3600, value: '0' },
        { name: 'hours', label: 'Allowed hours (optional, e.g. 7-19)', maxlength: 5, placeholder: '7-19' },
      ],
      submitLabel: 'Save zone',
    });
    if (!r) return;
    const m = /^(\d{1,2})\s*-\s*(\d{1,2})$/.exec(r.hours);
    const zone = { id: `z${Date.now().toString(36)}`, name: r.name, points, minLevel: Number(r.minLevel), maxDwellS: Number(r.maxDwellS) || 0, hours: m ? [Number(m[1]), Number(m[2])] : null };
    delete drafts[cam];
    await save(cam, [...(zones[cam] ?? []), zone], `Zone “${r.name}” saved.`);
  }

  function renderTools() {
    for (const cam of Object.keys(TRACKING_CAMERAS)) {
      const slot = $(`zones-${cam.toLowerCase()}`);
      if (!slot) continue;
      const drawing = Boolean(drafts[cam]);
      const list = zones[cam] ?? [];
      slot.replaceChildren(
        ...(drawing
          ? [
              h('span', { class: 'sub', text: `Click the corners on the picture (${drafts[cam].length} so far)` }),
              button('Finish', { iconName: 'check', cls: 'btn-sm btn-primary', onClick: () => finish(cam) }),
              button('Cancel', { cls: 'btn-sm', onClick: () => { delete drafts[cam]; renderTools(); } }),
            ]
          : [
              h('span', { class: 'sub', text: list.length ? list.map((z) => `${z.name} (L${z.minLevel}+)`).join(' · ') : 'No zones' }),
              button('Draw zone', { iconName: 'edit', cls: 'btn-sm', perm: 'site.edit', onClick: () => { drafts[cam] = []; renderTools(); } }),
              list.length
                ? button('Remove zones', {
                    iconName: 'trash',
                    cls: 'btn-sm btn-danger',
                    perm: 'site.edit',
                    onClick: async () => {
                      if (await confirmDialog({ title: `Remove the zones of ${TRACKING_CAMERAS[cam]}?`, message: 'Entries are no longer checked on this camera. The presence log stays.', confirmLabel: 'Remove', danger: true })) save(cam, [], 'Zones removed.');
                    },
                  })
                : null,
            ].filter(Boolean)),
      );
    }
  }

  function renderLog() {
    const body = $('presence-body');
    if (!body) return;
    const t = Date.now() + serverOffset;
    body.replaceChildren(
      ...(presence.length
        ? presence.map((p) =>
            h('tr', { class: p.authorized ? '' : 'row-attn' }, [
              h('td', { class: 'mono nowrap', text: clock(p.enterAt) }),
              h('td', { text: `${TRACKING_CAMERAS[p.cam] ?? p.cam} · ${p.zone}` }),
              h('td', { text: p.person ?? 'Unidentified' }),
              h('td', { class: 'mono', text: p.card ?? '—' }),
              h('td', {}, [h('span', { class: `pill ${p.authorized ? 'st-confirmed' : 'st-new'}`, text: p.authorized ? 'Authorized' : 'Not authorized' })]),
              p.exitAt ? h('td', { class: 'mono nowrap', text: clock(p.exitAt) }) : h('td', { class: 'nowrap' }, [h('b', { text: 'inside' })]),
              h('td', { class: 'mono nowrap', text: formatDuration((p.exitAt ?? t) - p.enterAt) }),
              h('td', { class: 'wrap', text: p.incident ? `${p.reason} · ${p.incident}` : p.reason ?? '' }),
            ]),
          )
        : [h('tr', {}, [h('td', { attrs: { colspan: 8 }, class: 'sub', text: 'Nobody has entered a camera zone yet. Draw a zone on B1 or CAM-2 to start.' })])]),
    );
  }

  // Clicking on a tracking camera's picture adds a corner to the zone being drawn.
  for (const cam of Object.keys(TRACKING_CAMERAS)) {
    const canvas = $(`cv-${cam.toLowerCase()}`);
    canvas?.addEventListener('click', (e) => {
      if (!drafts[cam]) return;
      const r = canvas.getBoundingClientRect();
      drafts[cam].push([Math.round(((e.clientX - r.left) / r.width) * 480), Math.round(((e.clientY - r.top) / r.height) * 270)]);
      renderTools();
    });
  }

  on('presence', loadPresence);
  on('config', (what) => what === 'cameraZones' && loadZones());
  on('session', () => session.user && loadZones());
  setInterval(() => !root.hidden && renderLog(), 1000);

  return {
    show() {
      loadZones();
      loadPresence();
    },
    /** What the feed needs to draw this camera. */
    drawOptions: (cam) => ({ zones: zones[cam] ?? [], draft: drafts[cam] ?? null, presence: insideNow(cam), time: Date.now() + serverOffset }),
    loadPresence,
  };
}
