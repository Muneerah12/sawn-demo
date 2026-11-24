// Gives the main interface the platform's shared modules: Arabic dictionary, scenarios, response rules.
import { toArabic } from '../shared/i18n-core.js';
import { SCENARIOS, SCENARIO_GROUPS } from '../shared/scenarios.js';
import { FAILURES, failureEffects, playbook, suggestedAuthorities } from '../shared/playbooks.js';
import { PERMISSIONS, ROLES, ROLE_DESCRIPTION, ROLE_LABEL, ROLE_LABEL_AR, ROLE_TIER } from '../shared/iam.js';
import { RESPONSE_DEADLINE_MIN, TASK_STATUS, TEAMS, formatDuration, responseMetrics, routeIncident } from '../shared/response.js';
import { createVoiceAlerts } from '../ui/voiceAlerts.js';
import { detectIntent } from '../shared/nashdanIntents.js';
import { najdiSpeech, spokenTime, PRONUNCIATION_TEST } from '../shared/najdiSpeech.js';
window.SAWN_AR = toArabic;
window.SAWN_VOICE = createVoiceAlerts({ ownOnly: true });
// One loudspeaker: an alert waits while Abdullah is talking (core2.js psTalking sets the flag).
window.SAWN_VOICE.setOtherBusy(() => Boolean(window.SAWN_ASSISTANT_TALKING));
// Nashdan: platform questions (cameras, threats, drone, a person, an incident) and how he says things in Najdi.
window.SAWN_NASHDAN = { detectIntent, najdiSpeech, spokenTime, PRONUNCIATION_TEST };
window.SAWN_SCEN = { list: SCENARIOS, groups: SCENARIO_GROUPS };
window.SAWN_SH = { FAILURES, failureEffects, playbook, suggestedAuthorities, RESPONSE_DEADLINE_MIN, TASK_STATUS, TEAMS, formatDuration, responseMetrics, routeIncident, PERMISSIONS, ROLES, ROLE_DESCRIPTION, ROLE_LABEL, ROLE_LABEL_AR, ROLE_TIER };
window.dispatchEvent(new Event('sawn-shared'));
