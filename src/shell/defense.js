// Detection Domains (on Command Center): SAWN's detections in the aerospace-security segment
// model — Space, Link, Ground, User — each with its detections, their RF band where it is real,
// and the incidents open right now, live and SIMULATED counted apart. The section is collapsed
// by default; its title line shows the open incidents per layer at a glance.
// See src/shared/defenseLayers.js.
import { coverage, segmentOf } from '../shared/defenseLayers.js';
import { isOpen } from '../shared/scenarios.js';
import { IncidentProvenance, incidentProvenance } from '../shared/incidentProvenance.js';
import { emit, on } from './hub.js';
import { state } from './store.js';
import { h } from './ui.js';

const STATUS = {
  live: { en: 'Live detector', cls: 'det-live' },
  simulated: { en: 'Simulated subsystem', cls: 'det-sim' },
  gap: { en: 'Not covered yet', cls: 'det-gap' },
};

// A domain points to the operational view that owns its detector/source details. The physical
// controls themselves remain separately in Readiness as Physical Protection Layers.
const SOURCE_DESTINATION = {
  space: { tab: 'airspace', aircraft: true, label: 'Aircraft & satellites' },
  link: { tab: 'airspace', label: 'Radio & GPS' },
  ground: { tab: 'airspace', label: 'Live sensor & radar' },
  user: { tab: 'checkpoint', label: 'Gate A checks' },
};

const provenanceBadges = (item, make) => [
  item.exercise ? make('exercise', `${item.exercise} EX`) : null,
  item.replay ? make('replay', `${item.replay} REPLAY`) : null,
  item.hybrid ? make('hybrid', `${item.hybrid} HYBRID`) : null,
  item.unknown ? make('unknown', `${item.unknown} VERIFY`) : null,
].filter(Boolean);

/** @param root the <details id="defense-section"> on the Command Center page */
export function createDefensePage({ root }) {
  const cols = root.querySelector('#def-cols');
  const summary = root.querySelector('#def-summary');
  const page = root.closest('section[data-view]');

  function render() {
    if (page?.hidden) return;
    const segs = coverage(state.incidents, isOpen);
    const unclassified = state.incidents.filter((i) => isOpen(i.status) && incidentProvenance(i) === IncidentProvenance.UNKNOWN).length;
    const unmapped = state.incidents.filter((i) => isOpen(i.status) && !segmentOf(i)).length;
    const summaryItems = [
      ...segs.map((s) =>
        h('span', { class: `def-chip seg-${s.id}${s.operational ? ' hot' : ''}`, attrs: { title: `${s.en} / ${s.ar}: ${s.operational} operational open incident(s)` } }, [
          `${s.icon} ${s.operational}`,
          ...provenanceBadges(s, (kind, text) => h('span', { class: `def-chip-sim prov-${kind}`, text: `+${text}` })),
        ]),
      ),
      unclassified ? h('span', { class: 'def-chip prov-unknown', text: `${unclassified} unclassified / verify source` }) : null,
      unmapped ? h('span', { class: 'def-chip prov-unknown', text: `${unmapped} unmapped / verify mapping` }) : null,
    ].filter(Boolean);
    summary.replaceChildren(...summaryItems);
    if (!root.open) return; // the columns are only built when the section is open
    cols.replaceChildren(
      ...segs.map((s) =>
        h('section', { class: `def-col seg-${s.id}`, attrs: { 'aria-label': `${s.en} segment` } }, [
          h('header', { class: 'def-head' }, [
            h('span', { class: 'def-icon', text: s.icon, attrs: { 'aria-hidden': 'true' } }),
            h('div', {}, [
              h('b', { class: 'ar', text: s.ar, attrs: { lang: 'ar', dir: 'rtl' } }),
              h('b', { text: s.en }),
              h('small', { text: s.desc.en }),
              h('button', { class: 'btn btn-ghost btn-sm', attrs: { type: 'button' }, on: { click: () => emit('navigate', { ...SOURCE_DESTINATION[s.id] }) } }, [SOURCE_DESTINATION[s.id].label]),
            ]),
          ]),
          h('div', { class: 'def-counts' }, [
            h('button', { class: `def-count${s.operational ? ' hot' : ''}`, attrs: { type: 'button', title: 'Open incidents from verified operational sources' }, on: { click: () => emit('navigate', { tab: 'incidents' }) } }, [h('b', { text: String(s.operational) }), h('span', { text: 'operational incidents' })]),
            ...provenanceBadges(s, (kind, text) => h('span', { class: `def-count sim prov-${kind}`, text })),
          ]),
          h(
            'ul',
            { class: 'def-list' },
            s.detections.map((d) =>
              h('li', { class: STATUS[d.status].cls }, [
                h('div', { class: 'def-det' }, [h('b', { text: d.en }), h('small', { class: 'ar', text: d.ar, attrs: { lang: 'ar', dir: 'rtl' } })]),
                h('div', { class: 'def-meta' }, [
                  d.band ? h('span', { class: 'band-tag', text: d.band }) : null,
                  h('span', { class: `det-status ${STATUS[d.status].cls}`, text: STATUS[d.status].en }),
                  d.operational ? h('span', { class: 'def-n hot', text: `${d.operational} operational` }) : null,
                  ...provenanceBadges(d, (kind, text) => h('span', { class: `def-n sim prov-${kind}`, text })),
                ]),
              ]),
            ),
          ),
        ]),
      ),
    );
  }

  root.addEventListener('toggle', render);
  on('incidents', render);
  setInterval(render, 5000);
  return { show: render };
}
