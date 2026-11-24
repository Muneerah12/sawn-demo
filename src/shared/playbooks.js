// Response playbooks for the WHAT-IF analysis: the recommended steps for a scenario, which outside
// authority to think of, and what a failed component changes. Plain rules written for this site —
// review them with your security and safety leads before relying on them.

const TEAM_STEPS = {
  security: [
    'Open the incident and acknowledge it so the clock stops',
    'Assign the nearest officer; check the camera picture and access records',
    'Send the drone if the place is outdoors or hard to reach',
    'Confirm or dismiss with a reason; escalate to the supervisor if unsure',
  ],
  safety: [
    'Acknowledge and assign the safety officer on duty',
    'Check the camera picture before raising the building alarm',
    'Keep people away; start the evacuation plan if it is confirmed',
    'Call the fire / gas authority if it is confirmed or growing',
  ],
  emergency: [
    'Acknowledge immediately and assign two responders',
    'Hold the person and the item; keep the area clear',
    'Call the response team and the police',
    'Do not close it alone: a critical dismissal needs a second approver',
  ],
};

const SCENARIO_STEPS = {
  fire: ['Raise the fire alarm and evacuate Level 3', 'Use an extinguisher only if it is small and safe to do so', 'Call Civil Defense; meet them at the gate with the floor plan', 'Cut power to the affected racks if the plan says so'],
  smoke: ['Send someone to look before raising the alarm (dust or steam look the same on camera)', 'If it is smoke from a fire: follow the fire steps', 'Ventilate only if there is no fire'],
  gas: ['Keep every ignition source away: no switches, no phones in the room', 'Close the supply valve only if it is safe to reach', 'Evacuate Zone D and keep people upwind', 'Call the gas emergency number and Civil Defense'],
  etd: ['Hold the person and the bag at the checkpoint', 'Keep 100 m clear around the bag', 'Call the response team and the police — the screener does not decide alone'],
  weapon: ['Do not approach alone; keep sight of the person', 'Lock down the doors between the person and others', 'Call the police'],
  fight: ['Send two officers; check the camera first', 'Separate the people and call first aid if needed'],
  breach: ['Track the person with T-1 and the perimeter cameras', 'Send the drone and the nearest guard', 'Lock Gate A and the level doors until the person is found'],
  circling: ['Send a guard to talk to the person politely', 'Keep the camera track and save the clips'],
  drone: ['Note the operator position from Remote ID', 'Inform the police; drones are not allowed over the site', 'Move people indoors if the drone is low over them'],
  door: ['Send an officer to the Level 4 door now', 'Check camera G4 and who badged in last'],
  'zone-entry': ['Check the camera picture and who it is', 'Ask the person to leave the zone or escort them out', 'If the badge is wrong or missing: hold them and check their ID'],
};

/** Outside authority to consider (matched against the administrator's contact list by name). */
const AUTHORITY_HINT = { fire: ['civil defense', 'fire'], smoke: ['civil defense', 'fire'], gas: ['gas', 'civil defense'], etd: ['police', 'civil defense'], weapon: ['police'], fight: ['police', 'red crescent', 'ambulance'], breach: ['police'], drone: ['police', 'aviation'] };
const TEAM_AUTHORITY = { safety: ['civil defense', 'fire'], emergency: ['police', 'civil defense'], security: ['police'] };

export const FAILURES = Object.freeze({
  directory: 'Central directory unreachable',
  sensor: 'Airspace sensor offline',
  face: 'Face camera down',
  metal: 'Metal detector down',
  network: 'Network cut (nodes on USB)',
  drone: 'Drone unavailable',
  night: 'Night shift (fewer people on site)',
});

const FAILURE_EFFECT = {
  directory: 'Gate A decides from its local directory copy; after its validity runs out, identity checks fail secure (officer checks by hand).',
  sensor: 'The airspace stage at Gate A goes to an officer: devices are checked by hand; no wireless incidents are raised.',
  face: 'The face stage goes to an officer, who compares the person with the ID photo.',
  metal: 'Manual search at the checkpoint; switched-off devices are not found automatically.',
  network: 'Nodes fall back to USB; consoles still get incidents. Expect a few seconds of delay.',
  drone: 'No aerial check: send a guard instead and use T-1 and the perimeter cameras.',
  night: 'Fewer responders: assign early; supervisors are alerted at the deadline if nobody responds.',
};

export function playbook(scenarioKey, team) {
  return [...(SCENARIO_STEPS[scenarioKey] ?? []), ...TEAM_STEPS[team]];
}

export function failureEffects(failures) {
  return failures.filter((f) => FAILURE_EFFECT[f]).map((f) => ({ failure: FAILURES[f], effect: FAILURE_EFFECT[f] }));
}

/** Contacts from the administrator's list that fit this scenario. */
export function suggestedAuthorities(scenarioKey, team, contacts) {
  const words = AUTHORITY_HINT[scenarioKey] ?? TEAM_AUTHORITY[team] ?? [];
  return contacts.filter((c) => words.some((w) => c.agency.toLowerCase().includes(w)));
}
