// Simulated subsystems of the wider SAWN facility (metal detector, cameras, card readers,
// environment, perimeter). There is no hardware for these yet: the server turns a scenario into
// an incident flagged `simulated`, so training and demos use the real incident workflow while
// the record stays clearly separate from live detections (the airspace sensor).
// DOM-free: imported by the server (incident creation) and the browser (labels, 3D focus).

export const Severity = Object.freeze({ CRIT: 'crit', HIGH: 'high', MID: 'mid', LOW: 'low' });
export const SEVERITY_LABEL = { crit: 'Critical', high: 'High', mid: 'Medium', low: 'Info' };
export const SEVERITY_RANK = { crit: 0, high: 1, mid: 2, low: 3 };

export const IncidentStatus = Object.freeze({
  NEW: 'new',
  ACK: 'ack',
  ESCALATED: 'escalated',
  CONFIRMED: 'confirmed',
  DISMISSED: 'dismissed',
});
export const STATUS_LABEL = { new: 'New', ack: 'Acknowledged', escalated: 'Escalated', confirmed: 'Confirmed', dismissed: 'Dismissed' };
export const OPEN_STATUSES = Object.freeze(['new', 'ack', 'escalated']);
export const isOpen = (status) => OPEN_STATUSES.includes(status);

export const DISMISS_REASONS = Object.freeze(['Test or drill', 'Sensor fault', 'Normal behaviour after check', 'Device registered after check', 'Other']);

/**
 * Each scenario: label, type (incident title), zone, device, severity, `at` (plan position in
 * cm on the 120 × 80 site plan), the devices it puts in alarm, optional camera / card /
 * inference confidence, the reason shown to the officer, evidence and a timeline in seconds
 * relative to the detection.
 */
export const SCENARIOS = Object.freeze({
  // Fire, smoke and gas: video analytics on the warehouse camera W3 and the OGI camera OG-1
  // (optical gas imaging). The frames and the model output are simulated.
  fire: {
    label: 'Fire (camera)', type: 'Fire detected (camera)', zone: 'Level 3 · Warehouses', dev: 'W3 / local computer', sev: 'crit', at: [58, 10], alarm: ['W3'], cam: 'W3', conf: 0.91,
    reason: 'Video inference: visible flames at the base of rack 4 in camera W3, growing over 6 s and confirmed in 5 consecutive frames. Flame detection sees only visible fire; send someone to check and start the fire plan.',
    ev: ['W3 frames with flame region (5 of 5)', 'Flame area grew from 0.4 % to 1.8 % of the frame', 'Rack 4 · east aisle'],
    tl: [[-6, 'W3 · first flame region'], [-3, 'W3 · region growing'], [0, 'W3 · confirmed in 5 frames'], [0.5, 'W3 · snapshot saved']],
    extra: { Camera: 'W3 · Warehouse', 'Model class': 'flame', 'Frames confirming': '5 of 5' },
  },
  smoke: {
    label: 'Smoke (camera)', type: 'Smoke detected (camera)', zone: 'Level 3 · Warehouses', dev: 'W3 / local computer', sev: 'high', at: [58, 10], alarm: ['W3'], cam: 'W3', conf: 0.84,
    reason: 'Video inference: a grey plume rising from the packing area in camera W3 for 25 s, spreading towards the ceiling. Smoke can come from fire, dust or steam; check the area before raising the fire alarm.',
    ev: ['W3 smoke region present for 25 s', 'Region spreading upwards (×3 in area)', 'No flame visible yet'],
    tl: [[-25, 'W3 · faint haze'], [-10, 'W3 · plume spreading'], [0, 'W3 · smoke persists 25 s'], [0.4, 'W3 · snapshot saved']],
    extra: { Camera: 'W3 · Warehouse', 'Model class': 'smoke', Persistence: '25 s' },
  },
  gas: {
    label: 'Gas leak (OGI camera)', type: 'Methane leak (OGI camera)', zone: 'D · Gas meter room', dev: 'OG-1 / local computer', sev: 'crit', at: [12, 60], alarm: ['OG-1', 'D4'], cam: 'OG', conf: 0.88,
    reason: 'Segmentation of the optical gas imaging (OGI) video shows a methane plume leaving the regulator flange on the meter skid, growing for 20 s and drifting east. Keep ignition sources away, isolate the supply if it is safe, and call the gas emergency number.',
    ev: ['OG-1 plume mask over 20 s', 'Plume area 2.1 % → 6.4 % of the frame', 'Source: regulator flange, drift east'],
    tl: [[-20, 'OG-1 · plume first segmented'], [-8, 'OG-1 · plume growing'], [0, 'OG-1 · leak confirmed'], [0.5, 'D4 · warning light']],
    extra: { Camera: 'OG-1 · OGI', Gas: 'Methane (CH4)', 'Plume area': '6.4 % of frame', Drift: 'east' },
  },
  metal: {
    label: 'Metal detection', type: 'Metal presence', zone: 'A · Checkpoint', dev: 'MD-A1 / N1', sev: 'high', at: [57, 61], alarm: ['MD-A1', 'A6'], cam: 'C2',
    reason: 'Metal-presence alarm from detector MD-A1 for 0.8 s during a tray pass (beam A6 broken). The detector reports metal only and does not identify the object.',
    ev: ['MD-A1 alarm signal · 0.8 s', 'Tray pass event from A6', 'CAM-2 snapshot (separate evidence)'],
    tl: [[-0.4, 'A6 · tray entry beam broken'], [0, 'MD-A1 · alarm starts'], [0.8, 'MD-A1 · alarm ends'], [1.1, 'CAM-2 · tray snapshot']],
    extra: { Checkpoint: 'Checkpoint A', 'Detector status': 'Armed', 'Daily function test': 'Passed today, logged (simulated)' },
  },
  revoked: {
    label: 'Revoked card', type: 'Revoked card', zone: 'A · Pedestrian gate', dev: 'A1 / N1', sev: 'mid', at: [81.8, 70.6], alarm: ['A1'], card: 'C-1017',
    reason: 'Card C-1017 is revoked in the access system and is on the Do Not Admit list. It was presented at pedestrian gate A. Entry was denied and barrier A3 stayed closed.',
    ev: ['NFC read at A1', 'Revocation record for C-1017'],
    tl: [[0, 'A1 · read card C-1017'], [0.1, 'Access register · card revoked'], [0.2, 'A3 · barrier stayed closed']],
  },
  door: {
    label: 'Door without badge', type: 'Door opened without badge', zone: 'Level 4 · Server room and labs', dev: 'C2 / N2', sev: 'crit', at: [80, 24], alarm: ['C2', 'C3', 'C4', 'G4'],
    reason: 'The Level 4 door opened with no card + PIN at reader C1 in the previous 10 s. Motion sensor C3 detected movement 2 s later.',
    ev: ['C2 state changed: open', 'No reads at C1 in 10 s', 'Motion at C3 after 2 s'],
    tl: [[-10, 'C1 · check window opens'], [0, 'C2 · door open'], [2, 'C3 · motion detected'], [2.2, 'C4 · beacon on']],
  },
  intr: {
    label: 'Staff-zone entry', type: 'Restricted-zone entry (camera)', zone: 'Level 3 · staff corridor B3', dev: 'B1 / local computer', sev: 'high', at: [73, 22], alarm: ['B1'], cam: 'B1', conf: 0.87,
    reason: 'Camera inference: an object inside staff-only zone B3 for 3 s. No matching card + PIN event for Level 4.',
    ev: ['B1 snapshot with box', 'Zone B3 boundary'],
    tl: [[0, 'B1 · object entered zone B3'], [3, 'B1 · 3 s limit exceeded']],
  },
  env: {
    label: 'Environmental anomaly', type: 'Environmental anomaly', zone: 'D · Environmental monitoring', dev: 'D2 / N3', sev: 'mid', at: [22, 55], alarm: ['D2', 'D4'],
    reason: 'VOC index rose from 100 to 245 in 40 s (threshold 200) while humidity stayed stable. This shows a change in air quality; it does not identify any substance.',
    ev: ['D2 readings: 100 → 245', 'D1: humidity stable at 40%', 'Configured threshold 200'],
    tl: [[-40, 'D2 · VOC 100'], [-15, 'D2 · VOC 180'], [0, 'D2 · VOC 245 above threshold'], [0.3, 'D4 · warning light']],
  },
  cross: {
    label: 'Card at two gates', type: 'Cross-gate conflict', zone: 'Gate A + Level 4', dev: 'A1 · C1', sev: 'high', at: [79, 17.5], alarm: ['A1', 'C1'], card: 'C-1042',
    reason: 'Card C-1042 was read at pedestrian gate A and then at reader C1 8 s later; the configured minimum walking time is 45 s. Possible cloned card.',
    ev: ['A1 read card C-1042', 'C1 read the same card 8 s later', 'Configured limit 45 s'],
    tl: [[-8, 'A1 · read C-1042'], [0, 'C1 · read C-1042']],
  },
  loiter: {
    label: 'Loitering', type: 'Odd behaviour: loitering', zone: 'Level 3 · near the Level 4 door', dev: 'B1 / local computer', sev: 'mid', at: [76, 26], alarm: ['B1'], cam: 'B1', conf: 0.84,
    reason: 'Camera inference: a person stayed 75 s near the Level 4 door (limit 60 s) with no badge event at C1.',
    ev: ['Movement path from B1', 'Dwell time 75 s', 'No event at C1'],
    tl: [[-75, 'B1 · tracking starts'], [-15, 'B1 · 60 s limit exceeded'], [0, 'Incident raised']],
  },
  fight: {
    label: 'Possible altercation', type: 'Possible violence: altercation', zone: 'Sidewalk at the gate', dev: 'CAM-2 / local computer', sev: 'crit', at: [36, 70.5], alarm: ['CAM-2'], cam: 'C2', conf: 0.72,
    reason: 'Pose-estimation inference: rapid, repeated limb movement between two people standing close, for 4 s. Needs human verification.',
    ev: ['5 s clip from CAM-2', 'Pose skeletons of both people'],
    tl: [[-4, 'CAM-2 · two people close'], [0, 'CAM-2 · altercation movement pattern']],
  },
  bag: {
    label: 'Unattended object', type: 'Unattended object', zone: 'Sidewalk by the checkpoint', dev: 'CAM-2 / local computer', sev: 'high', at: [41, 70.5], alarm: ['CAM-2'], cam: 'C2', conf: 0.9,
    reason: 'A bag stayed in place for 60 s after its owner left the camera’s view. This is a behavioural indicator only; it says nothing about the bag’s contents.',
    ev: ['Snapshot when left', 'Snapshot now', 'Owner’s path'],
    tl: [[-60, 'CAM-2 · bag left'], [-52, 'CAM-2 · owner left the view'], [0, '60 s limit exceeded']],
  },
  weapon: {
    label: 'Visible bladed weapon', type: 'Visible bladed weapon (camera)', zone: 'Sidewalk at the gate', dev: 'CAM-2 / local computer', sev: 'crit', at: [38, 69.5], alarm: ['CAM-2'], cam: 'C2', conf: 0.81,
    reason: 'Camera inference: a knife-like object visible in a person’s hand. Visual detection cannot see concealed objects; the officer decides.',
    ev: ['Snapshot with object box', 'Model class: knife'],
    tl: [[0, 'CAM-2 · class knife detected'], [1, 'CAM-2 · confirmed over 3 frames']],
  },
  breach: {
    label: 'Perimeter breach', type: 'Perimeter breach: fence climb', zone: 'Perimeter · east fence', dev: 'T-1 tower PTZ · P1', sev: 'crit', at: [106, 64], alarm: ['T-1', 'P1'], cam: 'T1', conf: 0.88,
    reason: 'Camera inference: the watchtower PTZ and perimeter camera P1 tracked a person climbing over the east fence between the gates. No gate, card or barrier event matches the crossing.',
    ev: ['T-1 PTZ track with box', 'P1 clip · 6 s', 'No gate or card event at that time'],
    tl: [[-3, 'P1 · person at the fence line'], [-1, 'T-1 · PTZ turns and locks on'], [0, 'T-1 · fence crossed'], [0.5, 'T-1 · searchlight on target']],
  },
  circling: {
    label: 'Circling the perimeter (proactive)', type: 'Hostile reconnaissance: circling the perimeter', zone: 'Perimeter · around the site', dev: 'T-1 · P1–P3 · CAM-2', sev: 'high', at: [104, 72], alarm: ['T-1', 'P1', 'P2', 'P3'], cam: 'T1', conf: 0.82,
    reason: 'Proactive detection: the same person (re-identified by appearance, not by face) passed cameras P2, T-1, CAM-2 and P1 within 7 minutes, covering three quarters of a lap around the site and stopping twice at the fence without approaching any gate. Circling and repeated stops are typical of hostile reconnaissance. Send a guard to engage politely and ask what they need; nobody has broken in.',
    ev: ['Re-identification track across 4 cameras', 'Two stops at the fence line (40 s, 65 s)', 'No gate, card or reception event'],
    tl: [[-420, 'P2 · person enters view (west fence)'], [-300, 'T-1 · stop at the fence, 40 s'], [-180, 'CAM-2 · passes the gate without entering'], [-60, 'P1 · stop at the east fence, 65 s'], [0, '3/4 lap completed — reconnaissance pattern']],
  },
  etd: {
    label: 'Explosive trace (ETD)', type: 'Explosive trace detected', zone: 'A · Checkpoint', dev: 'ETD-A1 / N1', sev: 'crit', at: [55, 60], alarm: ['MD-A1', 'A6'], cam: 'C2',
    reason: 'The explosive trace detector found a nitrate-based trace on the swab from a bag. Hold the person and the bag, keep the area clear and call the response team. Traces can also come from legitimate sources (medication, fertiliser); the response team decides — never the screener alone.',
    ev: ['ETD-A1 alarm · nitrate class', 'Swab taken from bag handles', 'CAM-2 snapshot of the tray'],
    tl: [[-25, 'A6 · bag on the tray'], [-12, 'ETD-A1 · swab analysed'], [0, 'ETD-A1 · trace alarm'], [2, 'Lane closed']],
  },
  drone: {
    label: 'Drone over the site (Remote ID)', type: 'Drone detected (Remote ID)', zone: 'Airspace above the site', dev: 'AS-1 airspace sensor', sev: 'crit', at: [96, 30], alarm: ['AS-1', 'T-1'], cam: 'T1', conf: 0.99,
    reason: 'A multirotor drone is broadcasting Remote ID (ASTM F3411) as serial 1581F5FKD229400A, 120 m from the site at 60 m above take-off, heading towards the building. The broadcast also gives the operator position, 400 m away on the street side. Inform the response team; drones are not allowed over the site.',
    ev: ['Remote ID over Wi-Fi beacon (vendor element FA:0B:BC, type 0x0D)', 'Basic ID: serial number, multirotor', 'Location: 60 m, 6 m/s, heading 200°', 'System: operator position'],
    tl: [[-40, 'AS-1 · first Remote ID beacon'], [-20, 'AS-1 · position inside the 300 m radius'], [0, 'Incident raised']],
  },
  hacktool: {
    label: 'Hacking tool at the gate', type: 'Hacking tool detected', zone: 'A · Checkpoint', dev: 'AS-1 airspace sensor', sev: 'crit', at: [70, 56], alarm: ['AS-1'],
    reason: 'A Bluetooth device advertising as “Flipper 7Ghost” — a multi-tool that can read and clone access cards and spam phones — is inside the gate zone. Find and confiscate it; authorize it only if it belongs to your own security team.',
    ev: ['Bluetooth name “Flipper 7Ghost”', 'Type: hacking tool, 90 % sure', 'Signal −52 dBm (≈1 m)'],
    tl: [[-6, 'AS-1 · first advertisement'], [0, 'Inside the gate zone']],
  },
  deauth: {
    label: 'Wi-Fi deauthentication attack', type: 'Wi-Fi deauthentication attack', zone: 'A · Checkpoint (airspace sensor)', dev: 'AS-1 airspace sensor', sev: 'high', at: [70, 56], alarm: ['AS-1'],
    reason: 'About 45 disconnect frames per second — normally fewer than 1. Phones and laptops near the gate are being knocked off Wi-Fi, often the first step of an evil-twin attack. The sender address can be forged; look for the device with the strongest signal.',
    ev: ['86 deauthentication + 4 disassociation frames in 2 s', 'Sender (may be forged) DE:AD:BE:EF:13:37', 'Baseline < 1 per second'],
    tl: [[-4, 'AS-1 · burst starts'], [0, 'Threshold 10/s exceeded']],
  },
  jamming: {
    label: 'Possible radio jamming', type: 'Possible radio jamming', zone: 'A · Checkpoint (airspace sensor)', dev: 'AS-1 airspace sensor', sev: 'high', at: [70, 56], alarm: ['AS-1'],
    reason: 'Wi-Fi traffic fell from ≈180 to 9 frames per second while the noise floor rose from −95 to −68 dBm, two reports in a row. Jamming is illegal and also blinds the sensor; use manual device checks at the gate until it stops.',
    ev: ['Traffic 9 vs ≈180 frames/s', 'Noise −68 vs ≈−95 dBm', 'Sensor heartbeat still arriving over USB'],
    tl: [[-4, 'AS-1 · traffic collapses'], [-2, 'AS-1 · noise floor +27 dB'], [0, 'Second report confirms']],
  },
  eviltwin: {
    label: 'Evil twin access point', type: 'Evil twin access point', zone: 'A · Checkpoint (airspace sensor)', dev: 'AS-1 airspace sensor', sev: 'high', at: [70, 56], alarm: ['AS-1'],
    reason: 'An unknown access point (DE:AD:BE:EF:00:01) is broadcasting “SAWN-Office”, the name of your authorized access point. People who connect to it can have their traffic captured. Locate it by signal strength and remove it.',
    ev: ['Rogue BSSID DE:AD:BE:EF:00:01', 'Authorized BSSID AA:AA:AA:00:00:01 “SAWN-Office”'],
    tl: [[0, 'AS-1 · beacon with a protected network name']],
  },
  blespam: {
    label: 'Bluetooth advertisement flood', type: 'Bluetooth advertisement flood', zone: 'A · Checkpoint (airspace sensor)', dev: 'AS-1 airspace sensor', sev: 'mid', at: [70, 56], alarm: ['AS-1'],
    reason: '≈160 different Bluetooth addresses advertised in 2 s (normally ≈15) — typical of a “BLE spam” tool that floods phones with fake pairing pop-ups and hides other devices.',
    ev: ['2,400 advertisements from ≈160 addresses', 'Baseline ≈15 addresses'],
    tl: [[0, 'AS-1 · flood detected']],
  },
  bio: {
    label: 'Fingerprint mismatch (Level 5)', type: 'Level 5 fingerprint mismatch', zone: 'Level 5 · Vault room', dev: 'C6 / N2', sev: 'crit', at: [99, 15.6], alarm: ['C6', 'C4', 'G5'], card: 'C-1001',
    reason: 'Card C-1001 and its PIN were accepted at the Level 5 door, but the fingerprint did not match the card holder’s enrolled template on 2 attempts. The door stayed locked: Level 5 needs all three factors.',
    ev: ['C6 card read · C-1001', 'PIN accepted', 'Fingerprint mismatch × 2', 'Level 5 door stayed locked'],
    tl: [[-12, 'C6 · card C-1001 read'], [-9, 'C6 · PIN accepted'], [-6, 'C6 · fingerprint mismatch 1'], [0, 'C6 · fingerprint mismatch 2'], [0.2, 'C4 · beacon on']],
  },
  escort: {
    label: 'Visitor without escort', type: 'Visitor without escort', zone: 'Gate 4 · Level 4 (Limited area)', dev: 'C1 / N2 · G4', sev: 'high', at: [79, 22], alarm: ['C1', 'G4'], card: 'C-1101', cam: 'B1', conf: 0.83,
    reason: 'Visitor card C-1101 was presented at Gate 4 with no escort card read in the previous 10 s, and the Gate 4 camera shows no escort within 3 m. Level 4 is a Limited area, where visitors need a continuous, close escort. Entry was denied.',
    ev: ['C1 read · visitor card C-1101', 'No escort card read within 10 s', 'G4 frame: one person at the gate'],
    tl: [[-10, 'C1 · escort check window opens'], [0, 'C1 · visitor card C-1101'], [0.4, 'G4 · no escort within 3 m'], [0.6, 'Gate 4 stayed locked']],
  },
  pattern: {
    label: 'Suspicious pattern', type: 'Suspicious behaviour pattern', zone: 'A · Pedestrian gate', dev: 'A1 / N1 · CAM-2', sev: 'high', at: [82, 71], alarm: ['A1', 'CAM-2'], card: 'C-1088', cam: 'C2', conf: 0.78,
    reason: '3 denied attempts at A1 with card C-1088 within 2 minutes, then the person stayed near the gate for 90 s. The assessment is based on events and behaviour, not on appearance.',
    ev: ['3 denied reads at A1', 'Dwell time from CAM-2'],
    tl: [[-120, 'A1 · denied 1'], [-70, 'A1 · denied 2'], [-30, 'A1 · denied 3'], [0, 'CAM-2 · stayed 90 s near the gate']],
  },
});

/** Scenario picker groups; `granted` and `net` are events without an incident. */
export const SCENARIO_GROUPS = Object.freeze([
  ['Entry and cards', ['granted', 'revoked', 'cross', 'pattern']],
  ['Screening, doors and levels', ['metal', 'etd', 'door', 'bio', 'escort', 'intr']],
  ['Perimeter', ['breach', 'circling']],
  ['Airspace & radio', ['drone', 'hacktool', 'deauth', 'jamming', 'eviltwin', 'blespam']],
  ['Camera and behaviour', ['loiter', 'fight', 'bag', 'weapon']],
  ['Fire, smoke and gas', ['fire', 'smoke', 'gas']],
  ['Environment', ['env']],
  ['System', ['net']],
]);

export const scenarioLabel = (key) =>
  key === 'granted' ? 'Authorised card (normal entry)' : key === 'net' ? 'Cut / restore network' : (SCENARIOS[key]?.label ?? key);

/** Plan position and focus key of the airspace checkpoint (sensor N1 / AS-1 at Gate A). */
export const AIRSPACE_ZONE = Object.freeze({ zone: 'A · Checkpoint (airspace sensor)', at: [64, 52], dev: 'AS-1 airspace sensor' });
