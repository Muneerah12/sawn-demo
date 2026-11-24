// Identity & access management: the roles an account can hold and what each may do.
// Enforced by the server on every request; the browser uses the same table only to show or hide
// controls and to explain why one is locked ("needs Physical security manager").
//
// The roles are the facility's positions. The seven management and oversight responsibilities
// (CSO, PSM, PER, CISO, INS, LEG, CRO) are the team's starting point, chosen with reference to
// CISA's Cybersecurity and Physical Security Convergence Action Guide (section 6.3.1); CISA does not
// mandate them as application roles. Three operational positions (OPR, GTO, ASO) handle incidents and one
// technical position (ADM) runs the system. The cyber-operations position (SOC) exists but is read-only
// until SAWN receives cyber events.
//
// Each permission is a workflow step, and each role holds only the steps that its written duty
// covers and that SAWN actually implements. Where a duty's own workflow is not built (cyber events for
// SOC, investigation cases for INS, unused-access review for PER, masking for LEG, a risk register for
// CRO), the role is read-only for that part. Choices the team has not approved are marked
// "UNRESOLVED (Dn)": they are provisional defaults so the software runs, not team decisions.
// See docs/ROLES_AND_ASSESSMENT.md.
//
// Separation of duties built into this table:
//   - The technical administrator (ADM) manages accounts, sensors, integrations and the system.
//     ADM holds no operational or approval permission.
//   - Assessment preparation (policy.draft), policy approval (policy.approve), remediation
//     ownership (remediation.manage) and exception/risk acceptance (risk.accept) are separate
//     permissions. The server also refuses approval by anyone who edited the draft.
//   - Periodic access reviews (people.manage, PER), incident handling (OPR/GTO/ASO), escalation
//     decisions and field dispatch (PSM, CSO) and reading insider-risk scores (INS) are held by different
//     roles. INS does not handle incidents, and no investigation workflow exists.

export const ROLES = Object.freeze(['opr', 'soc', 'gto', 'aso', 'cso', 'psm', 'ciso', 'per', 'ins', 'leg', 'cro', 'adm']);

export const ROLE_LABEL = {
  opr: 'Security operations operator',
  soc: 'Cyber operations analyst',
  gto: 'Gate officer',
  aso: 'Airspace officer',
  cso: 'Chief security officer',
  psm: 'Physical security manager',
  ciso: 'Information security manager',
  per: 'Personnel security',
  ins: 'Insider threat officer',
  leg: 'Legal affairs',
  cro: 'Risk manager',
  adm: 'System administrator',
};

export const ROLE_LABEL_AR = {
  opr: 'مشغّل العمليات الأمنية',
  soc: 'محلل العمليات السيبرانية',
  gto: 'ضابط البوابة',
  aso: 'ضابط المجال الجوي',
  cso: 'مدير الأمن',
  psm: 'مدير الأمن المادي',
  ciso: 'مدير أمن المعلومات',
  per: 'أمن الأفراد',
  ins: 'مسؤول التهديد الداخلي',
  leg: 'الشؤون القانونية',
  cro: 'مدير المخاطر',
  adm: 'مسؤول النظام',
};

/** Tier of each role, for grouping in the interface. */
export const ROLE_TIER = {
  opr: 'operations', soc: 'operations', gto: 'operations', aso: 'operations',
  cso: 'management', psm: 'management', ciso: 'management', per: 'management', ins: 'management',
  leg: 'oversight', cro: 'oversight',
  adm: 'system',
};

export const ROLE_DESCRIPTION = {
  opr: 'Watches open incidents and confirms, dismisses or escalates them; records maintenance.',
  soc: 'Read-only: incidents and the audit log. SAWN receives no system or account events yet, so there is nothing cyber-specific to handle.',
  gto: 'Runs Gate A and Gate B and decides wireless device authorization.',
  aso: 'Watches aircraft and wireless devices; requests device authorization from the gate officer and cannot allow or deny.',
  cso: 'Sees the whole picture, approves the facility assessment as the active policy, decides escalations.',
  psm: 'Prepares the physical assessment, owns remediation, follows confirmed physical incidents and dispatches field teams.',
  ciso: 'Records assets, their data classification and critical-system status in the assessment draft; reads the audit log and reports. No cyber-event monitoring exists yet.',
  per: 'Issues and revokes cards, manages people, grants need-to-access zone authorizations, records periodic and unused-access reviews.',
  ins: 'Reads insider-risk scores and the gate events behind them; opens, annotates and closes investigation cases. Access changes go through personnel security.',
  leg: 'Reads the audit log and reports; no incident or personal-record access. No server-side masking exists yet.',
  cro: 'Reads dashboards, the assessment and reports. No risk register exists yet.',
  adm: 'Manages accounts, sensors, cameras, integrations and the system itself. Makes no security decisions.',
};

// Roles that handle incidents. SOC is not among them: its own workflow (cyber events) is not built.
const OPS = ['opr', 'gto', 'aso'];
const LEAD = ['cso', 'psm'];

export const PERMISSIONS = Object.freeze({
  'incidents.view': { roles: [...OPS, 'soc', ...LEAD, 'ciso', 'per', 'ins', 'cro', 'adm'], label: 'View incidents, cameras and airspace' },
  'incidents.handle': { roles: [...OPS, ...LEAD], label: 'Acknowledge, confirm, dismiss, escalate and annotate incidents' },
  'incidents.decideEscalated': { roles: LEAD, label: 'Decide incidents escalated to a manager' },
  'incidents.assign': { roles: LEAD, label: 'Route incidents to a team and assign field responders' },
  'incidents.simulate': { roles: [...OPS, ...LEAD], label: 'Run training scenarios (simulated incidents, training database only)' },
  'devices.request': { roles: ['opr', 'gto', 'aso'], label: 'Request authorization of a wireless device' },
  // UNRESOLVED (D5): one gate officer approves another's request; whether another role should is open.
  'devices.authorize': { roles: ['gto'], label: 'Authorize a wireless device' },
  'devices.deny': { roles: ['gto'], label: 'Mark a wireless device unauthorized' },
  'devices.remove': { roles: ['gto'], label: 'Remove a device registration' },
  'sensors.trust': { roles: ['adm'], label: 'Trust or untrust sensors' },
  'integrations.edit': { roles: ['adm'], label: 'Configure cameras, camera zones, ADS-B, FR24 and the site location' },
  'people.view': { roles: ['opr', 'gto', ...LEAD, 'per', 'ins'], label: 'View people and cards' },
  'people.manage': { roles: ['per'], label: 'Add, edit, review and remove people' },
  'cards.manage': { roles: ['per'], label: 'Issue, revoke and reactivate cards' },
  'zone.authorize': { roles: ['per'], label: 'Grant, review and revoke need-to-access authorizations for restricted zones' },
  'rules.edit': { roles: LEAD, label: 'Edit alert rules' },
  'site.edit': { roles: LEAD, label: 'Change site mode, gate policy, detection zones and delete recordings' },
  'assessment.view': { roles: [...LEAD, 'ciso', 'per', 'cro'], label: 'View the facility assessment, proposals and impact checks' },
  'policy.draft': { roles: ['psm', 'ciso'], label: 'Prepare and adjust the facility assessment draft' },
  // UNRESOLVED (D3): provisional default; no second approver is defined when the CSO is unavailable.
  'policy.approve': { roles: ['cso'], label: 'Approve the assessment draft as the active security policy' },
  'remediation.manage': { roles: LEAD, label: 'Assign and track remediation of protection weaknesses' },
  // UNRESOLVED (D2): provisional default, taken from the team's earlier screen design; not approved.
  'risk.accept': { roles: ['psm'], label: 'Record an exception: accept a protection weakness or a requirement below the rule' },
  'system.control': { roles: ['adm'], label: 'Release the USB port, scan the network, back up, directory sync, training reset' },
  'audit.view': { roles: ['soc', 'cso', 'ciso', 'per', 'ins', 'leg', 'adm'], label: 'View the audit log' },
  'reports.view': { roles: [...LEAD, 'ciso', 'ins', 'leg', 'cro'], label: 'View and export reports' },
  'maintenance.record': { roles: ['opr', 'gto', 'psm', 'adm'], label: 'Record maintenance, function tests and sign inspections' },
  'risk.view': { roles: ['cso', 'ins'], label: 'See insider-risk scores and their events' },
  'investigations.manage': { roles: ['ins'], label: 'Open, annotate and close insider-threat investigation cases (each read is audited)' },
  // UNRESOLVED (D4): provisional default; not approved.
  'settings.fourEyes': { roles: ['cso'], label: 'Choose which actions need a second approver' },
  'users.manage': { roles: ['adm'], label: 'Manage user accounts and roles' },
});

export const isRole = (r) => ROLES.includes(r);

/** Accounts made before the 12 roles held one of four roles; this is how they are carried over. */
export const LEGACY_ROLE = { admin: 'adm', supervisor: 'psm', officer: 'opr', viewer: 'cro' };

// SAWN demo decision (2026-11-23): the system administrator holds every permission, as before the 12 roles.
// The two-person rule still applies: nobody approves their own request.
export const FULL_ACCESS_ROLE = 'adm';

export function permissionsFor(role) {
  return Object.entries(PERMISSIONS)
    .filter(([, p]) => role === FULL_ACCESS_ROLE || p.roles.includes(role))
    .map(([name]) => name);
}

export const can = (role, permission) => Boolean(PERMISSIONS[permission] && (role === FULL_ACCESS_ROLE || PERMISSIONS[permission].roles.includes(role)));

/** The roles that hold a permission, for "needs …" messages ("Gate officer or Physical security manager"). */
export function roleNeeded(permission) {
  const roles = ROLES.filter((r) => PERMISSIONS[permission]?.roles.includes(r)).map((r) => ROLE_LABEL[r]);
  if (!roles.length) return 'no role (not assigned)';
  return roles.length === 1 ? roles[0] : `${roles.slice(0, -1).join(', ')} or ${roles.at(-1)}`;
}
