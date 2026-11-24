import { OS_FAMILIES, RuleAction, describeRule } from '../core/alertRules.js';
import { TYPE_LABEL } from '../core/deviceType.js';
import { el, formatTime } from './dom.js';
import { STATUS_ICON, icon } from './icons.js';

const STATUS_TEXT = { AUTHORIZED: 'Authorized', UNKNOWN: 'Unknown', VERIFIED_UNAUTHORIZED: 'Unauthorized' };

export const OS_LABEL = {
  apple: 'iOS / iPadOS / watchOS',
  macos: 'macOS',
  android: 'Android',
  windows: 'Windows',
  linux: 'Linux',
  unknown: 'OS not identified',
};

const describe = (rule) => describeRule(rule, { typeLabel: (t) => TYPE_LABEL[t] ?? t, osLabel: (o) => OS_LABEL[o] ?? o });

/** Rule editor form + rules table. All values go through textContent / form properties. */
export function createRulesView(root = document) {
  const $ = (id) => root.getElementById(id);

  // Checkbox groups are generated once from the shared type / OS vocabularies.
  const checkbox = (name, value, label) =>
    el('label', {}, [el('input', { attrs: { type: 'checkbox', name, value } }), document.createTextNode(label)]);
  $('rule-types').replaceChildren(...Object.entries(TYPE_LABEL).map(([v, l]) => checkbox('rule-type', v, l)));
  $('rule-os').replaceChildren(...OS_FAMILIES.map((v) => checkbox('rule-os', v, OS_LABEL[v])));

  const checked = (name) => [...root.querySelectorAll(`input[name="${name}"]:checked`)].map((i) => i.value);
  const setChecked = (name, values) => {
    for (const input of root.querySelectorAll(`input[name="${name}"]`)) input.checked = values.includes(input.value);
  };

  function readForm() {
    return {
      name: $('rule-name').value.trim(),
      action: $('rule-action').value,
      conditions: {
        types: checked('rule-type'),
        osFamilies: checked('rule-os'),
        protocol: $('rule-protocol').value,
        minRssi: $('rule-range').value ? Number($('rule-range').value) : null,
        statuses: $('rule-status').value ? [$('rule-status').value] : [],
        text: $('rule-text').value.trim(),
        minConfidence: $('rule-confidence').value,
      },
    };
  }

  function fillForm(rule) {
    const c = rule.conditions;
    $('rule-name').value = rule.name ?? '';
    $('rule-action').value = rule.action ?? RuleAction.NOTIFY;
    setChecked('rule-type', c.types);
    setChecked('rule-os', c.osFamilies);
    $('rule-protocol').value = c.protocol ?? '';
    $('rule-range').value = c.minRssi === null || c.minRssi === undefined ? '' : String(c.minRssi);
    $('rule-status').value = c.statuses?.[0] ?? '';
    $('rule-text').value = c.text ?? '';
    $('rule-confidence').value = c.minConfidence ?? 'medium';
  }

  // Rules whose "matching now" list is expanded.
  const expanded = new Set();
  const toggleExpanded = (id) => (expanded.has(id) ? expanded.delete(id) : expanded.add(id));

  const iconBtn = (iconName, label, action, id, cls = '') =>
    el('button', { className: `btn btn-icon ${cls}`, attrs: { type: 'button', 'data-action': action, 'data-id': id, title: label, 'aria-label': label } }, [icon(iconName, { size: 16 })]);

  /**
   * matches(rule) -> [{ title, id, protocol, signal, status, typeIcon }] devices matching now;
   * firedLastHour(rule) -> number of results in the last hour.
   */
  function renderRules(rules, { matches, firedLastHour, editingId }) {
    const rows = [];
    for (const r of rules) {
      const now = r.enabled ? matches(r) : [];
      const open = expanded.has(r.id);
      rows.push(
        el('tr', { className: `${r.id === editingId ? 'row-editing' : ''} ${r.enabled ? '' : 'row-disabled'}` }, [
          el('td', {}, [
            el('label', { className: 'switch-toggle', attrs: { title: r.enabled ? 'Enabled' : 'Disabled' } }, [
              el('input', { attrs: { type: 'checkbox', 'data-action': 'toggle-rule', 'data-id': r.id, 'aria-label': `Enable ${r.name}`, ...(r.enabled ? { checked: '' } : {}) } }),
              el('span', { className: 'slider' }),
            ]),
          ]),
          el('td', {}, [el('div', { className: 'dev-name', text: r.name }), el('div', { className: 'sub', text: describe(r) })]),
          el('td', {}, [
            el('span', { className: 'chip' }, [icon(r.action === RuleAction.CHIME ? 'volume' : 'alert', { size: 12 }), document.createTextNode(r.action === RuleAction.CHIME ? 'alert + chime' : 'visual alert')]),
          ]),
          el('td', {}, [el('span', { className: `chip ${now.length ? 'chip-active' : ''}`, text: `${now.length} now` })]),
          el('td', { text: String(firedLastHour(r)) }),
          el('td', { className: 'actions' }, [
            el('button', {
              className: `btn btn-icon btn-ghost chevron ${open ? 'open' : ''}`,
              attrs: { type: 'button', 'data-action': 'expand-rule', 'data-id': r.id, 'aria-expanded': String(open), title: 'Devices matching now', 'aria-label': 'Devices matching now' },
            }, [icon('chevron', { size: 16 })]),
            iconBtn('settings', 'Edit rule', 'edit-rule', r.id),
            iconBtn('close', 'Delete rule', 'delete-rule', r.id, 'btn-danger'),
          ]),
        ]),
      );
      if (open) {
        rows.push(
          el('tr', { className: 'detail-row' }, [
            el('td', { attrs: { colspan: '6' } }, [
              now.length
                ? el(
                    'ul',
                    { className: 'match-list' },
                    now.map((m) =>
                      el('li', {}, [
                        icon(m.typeIcon, { size: 16 }),
                        el('span', { className: 'dev-name', text: m.title }),
                        el('span', { className: 'sub mono', text: m.id }),
                        el('span', { className: 'sub', text: `${m.protocol} · ${m.signal}` }),
                        el('span', { className: `status st-${m.status.toLowerCase()}` }, [icon(STATUS_ICON[m.status], { size: 14 })]),
                      ]),
                    ),
                  )
                : el('p', { className: 'sub', text: r.enabled ? 'No live device matches this rule right now.' : 'Rule is disabled.' }),
            ]),
          ]),
        );
      }
    }
    $('rules-body').replaceChildren(...rows);
    $('rules-empty').hidden = rules.length > 0;
  }

  const SOUND_TEXT = { chime: 'chime', none: 'visual only', offline: 'recorded offline', muted: 'muted', locked: 'sound not enabled', 'already-playing': 'merged' };

  /** results: newest first [{ t, ruleId, ruleName, title, id, protocol, typeIcon, typeText, signal, status, sound, offline }] */
  function renderResults(results, { ruleFilter, rules }) {
    const select = $('rule-results-filter');
    const current = select.value;
    select.replaceChildren(new Option('All rules', ''), ...rules.map((r) => new Option(r.name, r.id)));
    select.value = rules.some((r) => r.id === current) ? current : '';
    const shown = results.filter((r) => !ruleFilter || r.ruleId === ruleFilter).slice(0, 200);
    $('rule-results-body').replaceChildren(
      ...shown.map((r) =>
        el('tr', {}, [
          el('td', { className: 'nowrap', text: formatTime(r.t) }),
          el('td', { text: r.ruleName }),
          el('td', {}, [
            el('div', { className: 'dev-title' }, [
              icon(r.typeIcon, { size: 16 }),
              el('div', {}, [el('div', { text: r.title }), el('div', { className: 'sub mono', text: r.id })]),
            ]),
          ]),
          el('td', { text: r.typeText }),
          el('td', { className: 'nowrap', text: `${r.protocol} · ${r.signal}` }),
          el('td', {}, [el('span', { className: `status st-${r.status.toLowerCase()}` }, [icon(STATUS_ICON[r.status], { size: 14 }), document.createTextNode(STATUS_TEXT[r.status])])]),
          el('td', { text: r.offline ? 'recorded offline' : (SOUND_TEXT[r.sound] ?? r.sound) }),
        ]),
      ),
    );
    $('rule-results-empty').hidden = shown.length > 0;
    $('rule-results-count').textContent = `${results.length} result(s) this session`;
  }

  function setMessage(text, tone = 'idle') {
    $('rules-msg').textContent = text;
    $('rules-msg').dataset.tone = tone;
  }

  function setEditing(rule) {
    $('btn-rule-save').textContent = rule ? 'Update rule' : 'Save rule';
    if (rule) showForm(true);
  }

  function showForm(open) {
    $('rule-form-panel').hidden = !open;
    $('btn-rule-new').setAttribute('aria-expanded', String(open));
  }

  return { readForm, fillForm, renderRules, renderResults, toggleExpanded, setMessage, setEditing, showForm };
}
