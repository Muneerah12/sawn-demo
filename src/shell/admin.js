// Users & roles (IAM): administrators add, change and remove console accounts. The permission
// matrix shows exactly what each role may do — it is the same table the server enforces.
import { PERMISSIONS, ROLE_DESCRIPTION, ROLE_LABEL } from '../shared/iam.js';
import { TEAMS } from '../shared/response.js';
import { del, get, patch, post } from './api.js';
import { on, session } from './hub.js';
import { button, confirmDialog, dateTime, formDialog, h, icon, notify } from './ui.js';

const ROLES = Object.keys(ROLE_LABEL);
const TEAM_OPTIONS = [['', '— no team —'], ...Object.entries(TEAMS)];
const PW_HINT = 'At least 10 characters, not containing the user name.';

export function createAdminPage({ root }) {
  const body = root.querySelector('#users-body');
  let users = [];

  async function load() {
    if (!session.can('users.manage')) return;
    try {
      users = (await get('users')).users;
      render();
    } catch (err) {
      notify(err.message, 'bad');
    }
  }

  async function run(promise, ok) {
    try {
      await promise;
      notify(ok);
      await load();
    } catch (err) {
      notify(err.message, 'bad');
    }
  }

  async function addUser() {
    const r = await formDialog({
      title: 'Add a console user',
      iconName: 'key',
      fields: [
        { name: 'username', label: 'User name (sign-in)', required: true, maxlength: 32, pattern: '[A-Za-z0-9._\\-]{3,32}', hint: '3–32 letters, digits, dot, dash, underscore' },
        { name: 'displayName', label: 'Display name', maxlength: 60 },
        { name: 'role', label: 'Role', type: 'select', options: ROLES.map((r) => [r, `${ROLE_LABEL[r]} — ${ROLE_DESCRIPTION[r]}`]), value: 'officer' },
        { name: 'team', label: 'Team', type: 'select', options: TEAM_OPTIONS, value: '' },
        { name: 'password', label: 'Initial password', type: 'password', required: true, hint: PW_HINT },
      ],
      submitLabel: 'Add user',
    });
    if (!r) return;
    const { team, ...user } = r;
    await run(
      post('users', user).then((out) => (team ? post(`users/${out.user.id}/team`, { team }) : out)),
      `User ${r.username} added.`,
    );
  }

  async function editUser(u) {
    const r = await formDialog({
      title: `Edit ${u.username}`,
      iconName: 'key',
      fields: [
        { name: 'displayName', label: 'Display name', value: u.displayName, maxlength: 60 },
        { name: 'role', label: 'Role', type: 'select', options: ROLES.map((x) => [x, ROLE_LABEL[x]]), value: u.role },
        { name: 'team', label: 'Team', type: 'select', options: TEAM_OPTIONS, value: u.team ?? '' },
        { name: 'password', label: 'New password (leave empty to keep)', type: 'password', hint: `${PW_HINT} Resetting signs the user out.` },
      ],
    });
    if (!r) return;
    const payload = { displayName: r.displayName, role: r.role };
    if (r.password) payload.password = r.password;
    const teamChanged = (r.team || null) !== (u.team ?? null);
    await run(
      patch(`users/${u.id}`, payload).then((out) => (teamChanged ? post(`users/${u.id}/team`, { team: r.team || null }) : out)),
      `${u.username} updated.`,
    );
  }

  function render() {
    body.replaceChildren(
      ...users.map((u) =>
        h('tr', { class: u.active ? '' : 'row-muted' }, [
          h('td', {}, [h('strong', { text: u.displayName }), h('div', { class: 'sub mono', text: u.username })]),
          h('td', {}, [h('span', { class: `role role-${u.role}`, text: ROLE_LABEL[u.role] })]),
          h('td', {}, [u.team ? h('span', { class: `badge team-${u.team}`, text: TEAMS[u.team] }) : h('span', { class: 'sub', text: '—' })]),
          h('td', {}, [h('span', { class: `pill ${u.active ? 'st-confirmed' : 'st-dismissed'}`, text: u.active ? 'Active' : 'Disabled' })]),
          h('td', { text: u.lastLoginAt ? dateTime(u.lastLoginAt) : 'never' }),
          h('td', { class: 'actions-col' }, [
            h('div', { class: 'row' }, [
              button('', { iconName: 'edit', cls: 'btn-icon', title: 'Edit', onClick: () => editUser(u), attrs: { 'aria-label': `Edit ${u.username}` } }),
              u.id !== session.user.id
                ? button(u.active ? 'Disable' : 'Enable', { cls: 'btn-sm', onClick: () => run(patch(`users/${u.id}`, { active: !u.active }), `${u.username} ${u.active ? 'disabled' : 'enabled'}.`) })
                : h('span', { class: 'sub', text: 'you' }),
              u.id !== session.user.id
                ? button('', {
                    iconName: 'trash',
                    cls: 'btn-icon btn-danger',
                    title: 'Delete user',
                    attrs: { 'aria-label': `Delete ${u.username}` },
                    onClick: async () => {
                      if (await confirmDialog({ title: `Delete ${u.username}?`, message: 'The account is removed and signed out. Their audit entries stay.', confirmLabel: 'Delete user', danger: true })) {
                        await run(del(`users/${u.id}`), `${u.username} deleted.`);
                      }
                    },
                  })
                : null,
            ]),
          ]),
        ]),
      ),
    );
  }

  function renderMatrix() {
    const table = root.querySelector('#perm-matrix');
    table.replaceChildren(
      h('thead', {}, [h('tr', {}, [h('th', { text: 'Permission' }), ...ROLES.map((r) => h('th', { text: ROLE_LABEL[r] }))])]),
      h(
        'tbody',
        {},
        Object.values(PERMISSIONS).map((p) =>
          h('tr', {}, [
            h('td', { text: p.label }),
            ...ROLES.map((r) =>
              h('td', { class: 'cell-center' }, [p.roles.includes(r) ? h('span', { class: 'yes' }, [icon('check', { size: 16, label: 'allowed' })]) : h('span', { class: 'no', attrs: { 'aria-label': 'not allowed' }, text: '—' })]),
            ),
          ]),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------- authority contacts
  let contacts = [];
  async function loadContacts() {
    try {
      contacts = (await get('response/contacts')).contacts;
    } catch {
      contacts = [];
    }
    root.querySelector('#contacts-list').replaceChildren(
      ...(contacts.length
        ? contacts.map((c) => h('li', {}, [h('b', { text: c.agency }), c.phone ? h('span', { class: 'mono', text: c.phone }) : null, c.note ? h('small', { text: c.note }) : null].filter(Boolean)))
        : [h('li', { class: 'sub', text: 'No contacts yet.' })]),
    );
  }

  async function editContacts() {
    // One line per authority: "Name | phone | note".
    const r = await formDialog({
      title: 'Authority contacts',
      iconName: 'alert',
      intro: 'One authority per line: name | phone | note. Check the numbers for your site before relying on them.',
      fields: [{ name: 'lines', label: 'Contacts', type: 'textarea', maxlength: 4000, value: contacts.map((c) => [c.agency, c.phone, c.note].filter(Boolean).join(' | ')).join('\n'), placeholder: 'Police | 999\nCivil Defense | 998 | fire, gas, rescue' }],
    });
    if (!r) return;
    const list = r.lines
      .split('\n')
      .map((line) => line.split('|').map((x) => x.trim()))
      .filter(([agency]) => agency)
      .map(([agency, phone = '', note = '']) => ({ agency, phone, note }));
    await run(post('response/contacts', { contacts: list }), 'Contacts saved.');
    await loadContacts();
  }

  root.querySelector('#contacts-edit-slot').replaceChildren(button('Edit contacts', { iconName: 'edit', onClick: editContacts }));
  root.querySelector('#user-add-slot').replaceChildren(button('Add user', { iconName: 'plus', cls: 'btn-primary', onClick: addUser }));
  on('users-changed', () => !root.hidden && load());
  renderMatrix();

  return {
    show() {
      renderMatrix();
      load();
      loadContacts();
    },
  };
}

export async function changeOwnPassword() {
  const r = await formDialog({
    title: 'Change my password',
    iconName: 'key',
    fields: [
      { name: 'current', label: 'Current password', type: 'password', required: true },
      { name: 'next', label: 'New password', type: 'password', required: true, hint: PW_HINT },
    ],
    submitLabel: 'Change password',
  });
  if (!r) return;
  try {
    await post('me/password', r);
    notify('Password changed.');
  } catch (err) {
    notify(err.message, 'bad');
  }
}
