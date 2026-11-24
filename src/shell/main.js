// SAWN operations console: sign-in (or first-run setup), navigation and top bar.
// After sign-in the airspace module (src/app.js) starts; it owns the live feed and the siren and
// publishes its picture to the other pages through the hub.
import '../shared/i18n.js';
import { ROLE_LABEL } from '../shared/iam.js';
import { isOpen } from '../shared/scenarios.js';
import { hydrateIcons } from '../ui/icons.js';
import { get, post } from './api.js';
import { emit, on, session } from './hub.js';
import { counts, loadGates, loadIncidents, loadPeople, state } from './store.js';
import { applyPermissions, clock, notify, startPermissionGuard } from './ui.js';
import { createOverviewPage } from './overview.js';
import { createIncidentsPage } from './incidents.js';
import { createMapPage, deviceStatus } from './mapView.js';
import { createDrone } from './drone.js';
import { createSmartDetection } from './smartDetection.js';
import { createPeoplePage } from './people.js';
import { createAuditPage } from './audit.js';
import { changeOwnPassword, createAdminPage } from './admin.js';
import { createCheckpointPage } from './checkpoint.js';
import { createGateLivePage } from './gateLive.js';
import { createGateBPage } from './gateB.js';
import { createGatesOverviewPage } from './gatesOverview.js';
import { createApprovalsPage, createNotifications } from './approvals.js';
import { createReadinessPage } from './readiness.js';
import { createDefensePage } from './defense.js';
import { createThreatsPanel } from './threats.js';
import { loadApprovals, pendingApprovals } from './store.js';

hydrateIcons(document);
const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------------ sign-in / setup
async function boot() {
  let s;
  try {
    s = await get('session');
  } catch (err) {
    $('auth-msg').textContent = `Cannot reach the SAWN server: ${err.message}`;
    $('auth').hidden = false;
    return;
  }
  quickSwitch = Boolean(s.quickSwitch);
  if (!s.user) return showAuth(s.setupRequired);
  session.set(s);
  await startConsole();
}

// ------------------------------------------------------------------ demo: quick user switch
// On the SAWN computer itself, with "demo": { "quickUserSwitch": true }, accounts are switched with
// one click (no password). The server enforces both conditions and audits every switch.
let quickSwitch = false;
async function switchTo(username) {
  try {
    await post('demo/switch', { username });
    location.reload();
  } catch (err) {
    notify(err.message, 'bad');
    const msg = $('auth-msg');
    if (msg) msg.textContent = err.message;
  }
}
async function quickUserButtons(currentUsername = null) {
  const { users } = await get('demo/users');
  return users
    .filter((u) => u.username !== currentUsername)
    .map((u) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-ghost quick-user';
      const name = document.createElement('b');
      name.textContent = u.displayName || u.username;
      const role = document.createElement('small');
      role.textContent = u.roleLabel;
      b.append(name, role);
      b.addEventListener('click', () => switchTo(u.username));
      return b;
    });
}

function showAuth(setup) {
  $('auth').hidden = false;
  $('app').hidden = true;
  $('auth-title').textContent = setup ? 'Set up SAWN' : 'Sign in to SAWN';
  $('auth-intro').textContent = setup
    ? 'No accounts exist yet. Create the first administrator — you can add officers and supervisors afterwards under Facility profile.'
    : 'Security operations console · Facility A';
  for (const el of document.querySelectorAll('.setup-only')) el.hidden = !setup;
  $('auth-display').required = false;
  $('auth-confirm').required = setup;
  $('auth-password').autocomplete = setup ? 'new-password' : 'current-password';
  $('auth-submit').textContent = setup ? 'Create administrator' : 'Sign in';
  $('auth-username').focus();
  // Demo: pick an account instead of typing a password.
  const quick = $('auth-quick');
  quick.hidden = true;
  if (!setup && quickSwitch) {
    quickUserButtons()
      .then((buttons) => {
        if (!buttons.length) return;
        $('auth-quick-list').replaceChildren(...buttons);
        quick.hidden = false;
      })
      .catch(() => {});
  }
  $('auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const msg = $('auth-msg');
    msg.textContent = '';
    const username = $('auth-username').value.trim();
    const password = $('auth-password').value;
    if (setup && password !== $('auth-confirm').value) {
      msg.textContent = 'The passwords do not match.';
      return;
    }
    $('auth-submit').disabled = true;
    try {
      const r = setup ? await post('setup', { username, password, displayName: $('auth-display').value.trim() }) : await post('login', { username, password });
      $('auth-password').value = '';
      $('auth-confirm').value = '';
      session.set(r);
      await startConsole();
    } catch (err) {
      msg.textContent = err.message;
    } finally {
      $('auth-submit').disabled = false;
    }
  };
}

// ------------------------------------------------------------------ console
const TABS = ['overview', 'gates', 'checkpoint', 'gateb', 'simulation', 'airspace', 'incidents', 'approvals', 'readiness', 'site', 'smart', 'drone', 'facility', 'audit'];
const GATE_TABS = new Set(['gates', 'checkpoint', 'gateb']);
const TAB_TITLE = { gates: 'Gates overview', checkpoint: 'Gate A', gateb: 'Gate B · Level 5', simulation: 'Simulation & training' };
const TAB_PERM = { audit: 'audit.view', simulation: 'incidents.simulate' };
let pages = {};
let model = null;
let modelLoading = null;
let current = null;

// The Site & airspace scene (three.js) loads on first use.
async function getModel() {
  if (model) return model;
  modelLoading ??= import('./siteScene.js').then(({ createSiteScene }) => {
    model = createSiteScene($('stage3d'), {
      getIncidents: () => state.incidents.filter((i) => isOpen(i.status)),
      deviceStatus,
      onSelect: (p) => pages.site?.showPick(p),
    });
    if (state.airspace) model.setAirspace({ level: state.airspace.level, devices: state.airspace.devices3d });
    return model;
  });
  return modelLoading;
}

function goTab(tab, { select = null } = {}) {
  // Preserve old bookmarks and contextual links while configuration sections move under the
  // Facility Profile. Its individual sections still enforce their former permissions.
  if (tab === 'people' || tab === 'admin') tab = 'facility';
  if (tab === 'model3d' || tab === 'map') tab = 'site'; // the 3D model and site map are one page now
  if (!TABS.includes(tab) || (TAB_PERM[tab] && !session.can(TAB_PERM[tab]))) tab = 'overview';
  current = tab;
  const navTab = GATE_TABS.has(tab) ? 'gates' : tab;
  for (const b of document.querySelectorAll('nav [data-tab]')) {
    if (b.dataset.tab === navTab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  $('gate-subnav').hidden = !GATE_TABS.has(tab);
  for (const b of document.querySelectorAll('[data-gate-tab]')) {
    if (b.dataset.gateTab === tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  for (const v of document.querySelectorAll('section[data-view]')) v.hidden = v.dataset.view !== tab;
  if (select && tab === 'incidents') pages.incidents.select(select);
  pages[tab]?.show?.();
  if (location.hash !== `#${tab}`) history.replaceState(null, '', `#${tab}`);
  setTitle();
  if (TAB_TITLE[tab]) document.title = `SAWN · ${TAB_TITLE[tab]}`;
}

// The nav label is already in the chosen language, so the title follows a language switch too.
function setTitle() {
  document.title = `SAWN · ${document.querySelector(`nav [data-tab="${current}"] .nav-label`)?.textContent ?? 'Operations'}`;
}
window.addEventListener('sawn:language', setTitle);

async function startConsole() {
  $('auth').hidden = true;
  $('app').hidden = false;
  const u = session.user;
  $('user-name').textContent = u.displayName;
  $('user-role').textContent = ROLE_LABEL[u.role];
  $('user-role').className = `role role-${u.role}`;
  for (const b of document.querySelectorAll('nav [data-tab]')) b.hidden = Boolean(TAB_PERM[b.dataset.tab] && !session.can(TAB_PERM[b.dataset.tab]));
  for (const section of document.querySelectorAll('[data-facility-view]')) section.hidden = !session.can(section.dataset.facilityView);
  startPermissionGuard(document.body);
  applyPermissions(document);

  const peoplePage = createPeoplePage({ root: document.querySelector('[data-view="facility"]') });
  const adminPage = session.can('users.manage') ? createAdminPage({ root: document.querySelector('[data-view="facility"]') }) : null;
  const overview = createOverviewPage({ root: document.querySelector('[data-view="overview"]') });
  const gatesOverview = createGatesOverviewPage({ root: document.querySelector('[data-view="gates"]') });
  const defense = createDefensePage({ root: document.querySelector('#defense-section') });
  pages = {
    overview: { show: () => { overview.show(); defense.show(); } },
    gates: gatesOverview,
    site: createMapPage({ root: document.querySelector('[data-view="site"]'), getScene: getModel }),
    audit: createAuditPage({ root: document.querySelector('[data-view="audit"]') }),
    checkpoint: createGateLivePage({ root: document.querySelector('[data-view="checkpoint"]') }),
    gateb: createGateBPage({ root: document.querySelector('[data-view="gateb"]') }),
    simulation: createCheckpointPage({ root: document.querySelector('[data-view="simulation"]') }),
    approvals: createApprovalsPage({ root: document.querySelector('[data-view="approvals"]') }),
    readiness: createReadinessPage({ root: document.querySelector('[data-view="readiness"]'), onNavigate: (tab) => goTab(tab) }),
  };
  createNotifications({ onNavigate: (tab) => goTab(tab) });
  const threatsPanel = createThreatsPanel({ root: document.querySelector('[data-view="airspace"]') });
  pages.airspace = {
    show: () => {
      threatsPanel.start();
    },
  };
  pages.facility = {
    show: () => {
      if (session.can('people.view')) peoplePage.show();
      adminPage?.show();
      threatsPanel.refreshConfig();
    },
  };
  const drone = createDrone({ root: document.querySelector('[data-view="drone"]'), model: { droneTo: (...a) => getModel().then((m) => m.droneTo(...a)), droneRecall: () => model?.droneRecall() } });
  pages.drone = drone;
  // Smart detection shows the AI cameras the Drone & cameras page runs (created just above).
  pages.smart = createSmartDetection({ root: document.querySelector('[data-view="smart"]'), onNavigate: (tab, select) => goTab(tab, { select }) });
  pages.incidents = createIncidentsPage({
    root: document.querySelector('[data-view="incidents"]'),
    onShow3D: (i) => {
      goTab('site');
      getModel().then((m) => m.trigger(i.key));
    },
    onDrone: (i) => drone.dispatch(i.at ?? [64, 52], i),
    droneBusy: drone.busy,
  });

  for (const b of document.querySelectorAll('nav [data-tab]')) b.addEventListener('click', () => goTab(b.dataset.tab));
  for (const b of document.querySelectorAll('[data-gate-tab]')) b.addEventListener('click', () => goTab(b.dataset.gateTab));
  window.addEventListener('hashchange', () => goTab(location.hash.slice(1)));
  on('navigate', ({ tab, select, facilitySection }) => {
    goTab(tab, { select });
    if (tab === 'facility' && facilitySection) requestAnimationFrame(() => document.getElementById(facilitySection)?.scrollIntoView({ block: 'start' }));
  });

  // Top bar
  setInterval(() => ($('clock').textContent = clock(Date.now())), 1000);
  $('clock').textContent = clock(Date.now());
  $('btn-logout').addEventListener('click', async () => {
    await post('logout').catch(() => {});
    location.reload();
  });
  $('btn-password').addEventListener('click', changeOwnPassword);
  $('btn-user').addEventListener('click', () => {
    const open = $('user-menu').hidden;
    $('user-menu').hidden = !open;
    $('btn-user').setAttribute('aria-expanded', String(open));
    // Demo: the other accounts, one click each.
    const box = $('user-switch');
    box.hidden = true;
    if (open && quickSwitch) {
      quickUserButtons(session.user?.username)
        .then((buttons) => {
          if (!buttons.length) return;
          $('user-switch-list').replaceChildren(...buttons);
          box.hidden = false;
        })
        .catch(() => {});
    }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#user-box')) $('user-menu').hidden = true;
  });
  // Badges & feeds
  const renderBadges = () => {
    const c = counts();
    $('badge-incidents').textContent = String(c.open);
    $('badge-incidents').hidden = c.open === 0;
    $('badge-incidents').className = `badge-count ${c.crit ? 'crit' : ''}`;
    const air = state.airspace;
    const n = (air?.unauthorized ?? 0) + (air?.unknownAtGate ?? 0);
    $('badge-airspace').textContent = String(n);
    $('badge-airspace').hidden = !n;
    $('badge-airspace').className = `badge-count ${air?.unauthorized ? 'crit' : 'warn'}`;
    // Approvals someone else asked for, that this user may decide.
    const waiting = pendingApprovals().filter((a) => a.requestedById !== session.user.id).length;
    $('badge-approvals').textContent = String(waiting);
    $('badge-approvals').hidden = !waiting;
    $('badge-approvals').className = 'badge-count warn';
    const down = state.health.filter((x) => x.status === 'down').length;
    const warn = state.health.filter((x) => x.status === 'warn').length;
    $('badge-readiness').textContent = String(down || warn);
    $('badge-readiness').hidden = !(down || warn);
    $('badge-readiness').className = `badge-count ${down ? 'crit' : 'warn'}`;
  };
  on('approvals', renderBadges);
  on('health', renderBadges);
  on('gate', renderBadges);
  on('incidents', (d) => {
    renderBadges();
    model?.drawScreen();
    if (d?.event === 'created' && d.incident) {
      const i = d.incident;
      if (i.source !== 'airspace' || i.sev === 'crit') notify(`New incident ${i.ref}: ${i.type}${i.simulated ? ' (simulated)' : ''}`, i.sev === 'crit' ? 'bad' : 'warn');
      if (i.simulated || i.sev === 'crit') getModel().then((m) => m.trigger(i.key));
    }
  });
  on('airspace', (air) => {
    renderBadges();
    model?.setAirspace({ level: air.level, devices: air.devices3d });
    const chip = $('feed-chip');
    chip.dataset.tone = !air.connected ? 'bad' : air.sensorOnline ? 'ok' : 'warn';
    $('feed-text').textContent = !air.connected ? 'Feed offline' : air.sensorOnline ? `Sensor ${air.sensorId ?? ''} online` : 'Sensor not reporting';
  });
  on('net', (down) => {
    $('net-chip').hidden = !down;
  });
  on('sim-granted', () => getModel().then((m) => m.trigger('granted')));
  on('server-message', (msg) => {
    if (msg.type !== 'session') return;
    if (msg.action === 'refresh') {
      notify('Your role was changed — reloading with the new permissions…', 'warn');
      setTimeout(() => location.reload(), 1500);
    } else if (msg.action === 'ended') location.reload();
  });
  on('session-expired', () => location.reload());
  setInterval(async () => {
    const s = await get('session').catch(() => null);
    if (s && !s.user) location.reload();
  }, 60_000);

  await Promise.all([
    loadIncidents().catch((err) => notify(err.message, 'bad')),
    loadPeople().catch(() => {}),
    loadApprovals().catch(() => {}),
    loadGates().catch(() => {}),
    get('readiness').then((r) => ((state.health = r.health), emit('health'))).catch(() => {}),
    get('gate').then((g) => ((state.gate = g), emit('gate'))).catch(() => {}),
  ]);
  renderBadges();
  goTab(location.hash.slice(1) || 'overview');

  // The airspace module: live feed, classification, siren, radar, rules, registry.
  await import('../app.js');
  applyPermissions(document);
  emit('console-ready');
}

boot();
