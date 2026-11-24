// People search chat (Drone & cameras page): the operator describes someone in Arabic or English;
// the server translates the description, compares it with the pictures the AI cameras took of each
// tracked person (SigLIP 2, server/peopleSearch.mjs) and the closest come back as cards with camera
// and time. A message with only a time, a camera or "more" refines the previous search.
import { post } from './api.js';
import { h, button, notify } from './ui.js';

const EXAMPLES = ['رجل يلبس ثوب أبيض وشماغ', 'شخص لابس أسود آخر ساعة', 'امرأة بعباية ونقاب', 'a man in a red jacket'];
const tzOffsetMin = () => -new Date().getTimezoneOffset();
const time = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const day = (t) => {
  const d = new Date(t);
  return d.toDateString() === new Date().toDateString() ? time(t) : `${d.toLocaleDateString()} ${time(t)}`;
};

export function createPeopleSearch({ root }) {
  const box = root.querySelector('#people-search');
  if (!box) return {};
  let context = null;
  const log = h('div', { class: 'ps-log', attrs: { 'aria-live': 'polite' } });
  const input = h('input', { class: 'ps-input', attrs: { type: 'text', maxlength: '300', placeholder: 'Describe the person — e.g. man in a white thobe, last hour', 'aria-label': 'Describe the person' } });
  const sendBtn = button('Search', { iconName: 'people', cls: 'btn-primary', perm: 'incidents.handle', type: 'submit' });
  const form = h('form', { class: 'ps-form', on: { submit: (e) => (e.preventDefault(), send(input.value)) } }, [input, sendBtn]);
  const chips = h('div', { class: 'ps-chips' }, EXAMPLES.map((ex) => h('button', { class: 'ps-chip', attrs: { type: 'button' }, text: ex, on: { click: () => send(ex) } })));

  const say = (who, children) => {
    const msg = h('div', { class: `ps-msg ps-${who}` }, children);
    log.append(msg);
    log.scrollTop = log.scrollHeight;
    return msg;
  };

  function help(reason) {
    say('bot', [
      h('p', { text: reason === 'no-description' ? 'Tell me first what the person looks like — then I can narrow it down by time or camera.' : reason === 'not-understood' ? 'I did not understand a description in that.' : 'Describe what the person wears: colours and clothes (shirt, thobe, abaya, jacket…), what they carry, man / woman / child.' }),
      h('p', { class: 'sub', text: 'Then refine: “last hour”, “today”, “after 3 pm”, a camera name, or “more”. “New search” starts again.' }),
    ]);
  }

  function results(r) {
    const s = r.search;
    const filters = [s.since ? `since ${day(s.since)}` : 'last 7 days', s.until ? `until ${day(s.until)}` : null, s.cam ? `camera ${s.cam}` : 'all cameras'].filter(Boolean).join(' · ');
    const lines = [
      h('p', { class: 'ps-prompt' }, [h('span', { class: 'sub', text: 'Searched for' }), h('code', { text: s.prompt })]),
      h('p', { class: 'sub', text: filters }),
    ];
    if (r.unknown?.length) lines.push(h('p', { class: 'sub ps-warn', text: `Words I did not understand: ${r.unknown.join('، ')}` }));
    if (!r.total) {
      lines.push(h('p', { text: r.waiting > 0 && !r.pictures ? 'The cameras’ pictures of people are still being processed — ask again in a moment.' : r.pictures ? 'Nobody in these pictures looks like that.' : 'No pictures of people yet for these filters — start an AI camera with people in view.' }));
    } else {
      lines.push(h('p', { text: s.page ? `More results (page ${s.page + 1}) of ${r.total} people.` : `${r.total} people seen — closest to the description first.` }));
      lines.push(
        h('div', { class: 'ps-grid' }, r.results.map((x, i) =>
          h('figure', { class: 'ps-card' }, [
            h('img', { attrs: { src: `api/sightings/${x.id}.jpg`, alt: `${x.cam} ${time(x.t)}`, loading: 'lazy' } }),
            h('figcaption', {}, [
              h('b', { text: `#${s.page * 12 + i + 1} · ${x.cam}`, attrs: { title: x.cam } }),
              h('span', { text: x.seen > 1 ? `${day(x.first)} – ${time(x.last)} (${x.seen}×)` : day(x.t) }),
              x.testVideo ? h('span', { class: 'badge badge-demo', text: 'TEST VIDEO' }) : null,
            ]),
          ]),
        )),
      );
      if (r.total > (s.page + 1) * 12) lines.push(button('More', { cls: 'btn-sm', onClick: () => send('more') }));
    }
    if (r.waiting > 0) lines.push(h('p', { class: 'sub', text: `${r.waiting} new pictures are still being processed.` }));
    lines.push(h('p', { class: 'sub ps-note', text: 'Ranked by how well clothes and colours match; this is not identification. Small items (bags) and age are less reliable — check the pictures.' }));
    say('bot', lines);
  }

  async function send(raw) {
    const message = String(raw ?? '').trim();
    if (!message) return;
    input.value = '';
    say('me', [h('p', { text: message, attrs: { dir: 'auto' } })]);
    const wait = say('bot', [h('p', { class: 'sub', text: 'Searching…' })]);
    sendBtn.disabled = true;
    try {
      const r = await post('vision/people-search', { message, context, tzOffsetMin: tzOffsetMin() });
      wait.remove();
      if (r.action === 'reset') {
        context = null;
        say('bot', [h('p', { text: 'New search. Describe the person.' })]);
      } else if (r.action === 'help') help(r.reason);
      else {
        context = r.search;
        results(r);
      }
    } catch (err) {
      wait.remove();
      say('bot', [h('p', { class: 'ps-warn', text: err.message })]);
      notify(err.message, 'bad');
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

  box.replaceChildren(
    h('p', { class: 'sub', text: 'The AI cameras keep a picture of each person they track (kept 7 days). Describe someone in Arabic or English and the closest matches come back with camera and time. Every search is recorded in the audit log.' }),
    chips,
    log,
    form,
  );
  help();
  return { send };
}
