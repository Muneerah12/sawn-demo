// Space panel of the aircraft view: imaging satellites passing over the site.
//   banner    OVERHEAD NOW / next imaging pass with a live countdown (SIMULATED in the demo)
//   list      next passes reaching ≥ 30°: name, rise–set time, highest elevation, countdown;
//             imaging satellites in colour, others (weather, science, stations) dimmed
//   sky-plot  circle = horizon, centre = straight overhead, north up; current positions and the
//             paths of passes in progress / coming next; the demo satellite in purple
// Data: the server's `space` message (server/satellites.mjs).
import { el } from './dom.js';
import { icon } from './icons.js';

const SIM = '#c084fc';
const time = (t) => new Date(t).toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit' });
const mmss = (sec) => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m}:${String(s % 60).padStart(2, '0')}`;
};

export function createSpaceView(host) {
  let data = null;
  const status = el('span', { className: 'sub' });
  const banner = el('div', { className: 'space-banner', attrs: { hidden: '', role: 'status', 'aria-live': 'polite' } });
  const list = el('ul', { className: 'space-list', attrs: { 'aria-label': 'Next satellite passes' } });
  const plot = el('canvas', { className: 'space-plot', attrs: { width: '260', height: '260', role: 'img', 'aria-label': 'Sky plot: horizon circle, overhead at the centre, north up' } });
  const legend = el('p', { className: 'hint', text: 'Circle = horizon · centre = straight overhead · N up. Bright = imaging satellite, grey = other.' });
  const panel = el('section', { className: 'sky-space', attrs: { hidden: '' } }, [
    el('div', { className: 'sky-profile-head' }, [el('b', {}, [icon('satellite', { size: 15 }), document.createTextNode(' Space — imaging satellites over the site')]), status]),
    banner,
    el('div', { className: 'space-grid' }, [list, el('div', { className: 'space-plot-box' }, [plot, legend])]),
  ]);
  host.after(panel);

  function renderStatus() {
    if (!data) return;
    const t = data.tle ?? {};
    const age = t.fetchedAt ? Math.round((Date.now() - t.fetchedAt) / 3_600_000) : null;
    const imaging = data.counts?.imagingPasses ?? (data.passes ?? []).filter((p) => p.imaging).length;
    status.textContent = !t.satellites
      ? `No orbit data yet${t.error ? ` (${t.error})` : ''} — needs internet once`
      : `${t.satellites} satellites (${t.imaging} imaging) · orbits ${t.source === 'cache' ? 'from the cache' : 'from CelesTrak'}${age !== null ? `, ${age} h old` : ''}${t.error ? ' · refresh failed, using cache' : ''} · ${imaging} imaging pass(es) ≥ ${data.config?.minElevationDeg ?? 30}° next ${data.config?.horizonHours ?? 24} h`;
  }

  function renderBanner() {
    const d = data?.demo;
    const now = Date.now();
    let tone = null;
    let text = '';
    if (d) {
      tone = 'sim';
      text = d.countdownSec > 0 ? `SIMULATED fast-forward · ${d.name} rises in ${mmss(d.countdownSec)} (max ${d.maxElevationDeg}°)` : d.pos ? `SIMULATED · ${d.name} OVERHEAD NOW — elevation ${Math.round(d.pos.el)}°` : `SIMULATED · ${d.name} has set`;
    } else if (data?.overhead?.length) {
      tone = 'crit';
      text = `OVERHEAD NOW: ${data.overhead.join(', ')} — cover sensitive activity`;
    } else if (data?.next) {
      const sec = (data.next.aos - now) / 1000;
      const lead = (data.config?.alertLeadMin ?? 15) * 60;
      tone = sec <= lead ? 'warn' : 'info';
      text = `Next imaging pass: ${data.next.name} in ${mmss(sec)} (${time(data.next.aos)}, max ${data.next.maxElevationDeg}°)${sec <= lead ? ' — cover sensitive activity' : ''}`;
    }
    banner.hidden = !tone;
    banner.dataset.tone = tone ?? '';
    banner.textContent = text;
  }

  function renderList() {
    const now = Date.now();
    const rows = (data?.passes ?? []).slice(0, 14).map((p) => {
      const live = p.aos <= now && p.los >= now;
      const cd = live ? 'NOW' : p.aos > now ? `in ${mmss((p.aos - now) / 1000)}` : 'ended';
      return el('li', { className: `${p.imaging ? 'imaging' : 'other'}${live ? ' live' : ''}` }, [
        el('b', { text: p.name }),
        el('span', { className: 'mono', text: `${time(p.aos)}–${time(p.los)}` }),
        el('span', { className: 'mono', text: `${p.maxElevationDeg}°` }),
        el('span', { className: `cd mono${live ? ' now' : ''}`, text: cd }),
      ]);
    });
    list.replaceChildren(el('li', { className: 'head' }, [el('b', { text: 'Satellite' }), el('span', { text: 'Rise–set' }), el('span', { text: 'Max' }), el('span', { text: 'Countdown' })]), ...(rows.length ? rows : [el('li', { className: 'sub', text: data ? 'No passes above the limit in the next 24 h.' : 'Waiting for the server…' })]));
  }

  function drawPlot() {
    const ctx = plot.getContext('2d');
    const W = plot.width;
    const c = W / 2;
    const R = W / 2 - 18;
    const xy = (az, el) => {
      const r = R * (1 - Math.max(0, el) / 90);
      const a = (az * Math.PI) / 180;
      return [c + r * Math.sin(a), c - r * Math.cos(a)];
    };
    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = '#060b14';
    ctx.beginPath();
    ctx.arc(c, c, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.5)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(148,163,184,0.18)';
    for (const e of [30, 60]) {
      ctx.beginPath();
      ctx.arc(c, c, R * (1 - e / 90), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px ui-monospace, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('30°', c + 4, c - R * (2 / 3) + 11);
    ctx.fillText('60°', c + 4, c - R / 3 + 11);
    ctx.font = '700 11px system-ui, sans-serif';
    for (const [t, az] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]) {
      const [x, y] = xy(az, -8);
      ctx.fillText(t, x, y + 4);
    }
    if (!data) return;
    const demoOn = Boolean(data.demo);
    // Paths of passes in progress and the next ones (dashed).
    for (const p of data.passes ?? []) {
      if (!p.path?.length) continue;
      ctx.globalAlpha = demoOn ? 0.25 : p.imaging ? 0.85 : 0.35;
      ctx.strokeStyle = p.imaging ? '#fb923c' : '#64748b';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      p.path.forEach(([az, e], i) => {
        const [x, y] = xy(az, e);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Current positions.
    for (const s of data.sky ?? []) {
      const [x, y] = xy(s.az, s.el);
      ctx.globalAlpha = demoOn ? 0.3 : s.imaging ? 1 : 0.45;
      ctx.fillStyle = s.imaging ? '#fb923c' : '#94a3b8';
      ctx.beginPath();
      ctx.arc(x, y, s.imaging ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fill();
      if (s.imaging && !demoOn) {
        ctx.fillStyle = '#fed7aa';
        ctx.font = '600 10px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(s.name.slice(0, 16), x + 6, y - 4);
      }
    }
    ctx.globalAlpha = 1;
    // Demo satellite (SIMULATED fast-forward of a real pass).
    if (data.demo) {
      const d = data.demo;
      ctx.strokeStyle = SIM;
      ctx.lineWidth = 2;
      ctx.beginPath();
      (d.path ?? []).forEach(([az, e], i) => {
        const [x, y] = xy(az, e);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.stroke();
      if (d.pos) {
        const [x, y] = xy(d.pos.az, d.pos.el);
        ctx.fillStyle = SIM;
        ctx.beginPath();
        ctx.arc(x, y, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f5f3ff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#e9d5ff';
        ctx.font = '700 10.5px system-ui, sans-serif';
        ctx.textAlign = x > c ? 'right' : 'left';
        ctx.fillText(`${d.name.slice(0, 16)} SIM`, x + (x > c ? -9 : 9), y - 7);
      }
    }
  }

  function render() {
    renderStatus();
    renderBanner();
    renderList();
    drawPlot();
  }
  setInterval(() => !panel.hidden && (renderBanner(), renderList()), 1000); // live countdowns

  return {
    panel,
    setData(msg) {
      data = msg;
      if (!panel.hidden) render();
    },
    show(on) {
      panel.hidden = !on;
      if (on) render();
    },
  };
}
