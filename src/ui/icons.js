// Inline stroke icons (24×24 grid, currentColor). No external assets or fonts.
export const PATHS = {
  shield: 'M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z',
  shieldCheck: 'M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z M8.5 12l2.5 2.5 4.5-5',
  shieldAlert: 'M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z M12 8v5 M12 16.5v.01',
  alert: 'M12 4 2.5 20h19L12 4Z M12 10v4.5 M12 17.5v.01',
  unknown: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6 M12 17v.01',
  check: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M8 12.5l2.7 2.7L16 9.8',
  block: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M5.6 5.6l12.8 12.8',
  wifi: 'M2.5 9a14 14 0 0 1 19 0 M5.5 12.3a9.5 9.5 0 0 1 13 0 M8.6 15.5a5 5 0 0 1 6.8 0 M12 19v.01',
  bluetooth: 'M7 7l10 10-5 4V3l5 4L7 17',
  phone: 'M8 2.5h8a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5Z M11 18.5h2',
  tablet: 'M5.5 2.5h13A1.5 1.5 0 0 1 20 4v16a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20V4a1.5 1.5 0 0 1 1.5-1.5Z M11 18.5h2',
  laptop: 'M4.5 5h15v10h-15Z M2 19h20',
  watch: 'M8 7h8v10H8Z M9 7l.6-4h4.8l.6 4 M9 17l.6 4h4.8l.6-4',
  wearable: 'M9 4h6v16H9Z M9 9h6 M9 15h6',
  audio: 'M4 14v-2a8 8 0 0 1 16 0v2 M4 14h3v6H5a1 1 0 0 1-1-1v-5Z M20 14h-3v6h2a1 1 0 0 0 1-1v-5Z',
  tracker: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  tv: 'M3 6h18v11H3Z M8 21h8 M12 17v4',
  router: 'M3 14h18v5H3Z M7 16.5h.01 M11 16.5h.01 M17 14l2-6 M8.5 10.5a5 5 0 0 1 7 0 M6 8a8.5 8.5 0 0 1 12 0',
  iot: 'M3 11 12 4l9 7 M5.5 9.5V20h13V9.5 M10 20v-5h4v5',
  accessory: 'M3 7h18v10H3Z M7 11h.01 M11 11h.01 M15 11h.01 M8 14.5h8',
  device: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 12h.01',
  sensor: 'M12 12.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z M8.5 14.5a5 5 0 0 1 0-7 M15.5 7.5a5 5 0 0 1 0 7 M5.6 17.4a9 9 0 0 1 0-12.8 M18.4 4.6a9 9 0 0 1 0 12.8 M12 12.5V21',
  refresh: 'M20 11a8 8 0 0 0-14.3-4.9L4 8 M4 4v4h4 M4 13a8 8 0 0 0 14.3 4.9L20 16 M20 20v-4h-4',
  chevron: 'M9 6l6 6-6 6',
  volume: 'M4 9.5h4L13 5v14l-5-4.5H4Z M16.5 9a4 4 0 0 1 0 6 M19 6.5a7.5 7.5 0 0 1 0 11',
  mute: 'M4 9.5h4L13 5v14l-5-4.5H4Z M17 9.5l5 5 M22 9.5l-5 5',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
  gate: 'M4 21V7l8-4 8 4v14 M8 21v-8h8v8 M12 13v8',
  rule: 'M4 6h16 M7 12h10 M10 18h4',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8 M3 3v5h5 M12 7v5l3 2',
  chart: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
  table: 'M3 5h18v14H3Z M3 10h18 M3 15h18 M9 5v14',
  filter: 'M3 5h18l-7 8v6l-4-2v-4L3 5Z',
  plus: 'M12 5v14 M5 12h14',
  close: 'M6 6l12 12 M18 6 6 18',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7v5l3.5 2',
  registry: 'M5 3h11l3 3v15H5Z M9 9h6 M9 13h6 M9 17h3',
  demo: 'M5 3h14v18H5Z M9 8l6 4-6 4V8Z',
  person: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4 21a8 8 0 0 1 16 0',
  people: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M2 21a7 7 0 0 1 14 0 M16 3.5a4 4 0 0 1 0 7 M18 14a6 6 0 0 1 4 7',
  card: 'M3 6h18v12H3Z M3 10h18 M7 15h4',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z M9 4v14 M15 6v14',
  cube: 'M12 2 3 7v10l9 5 9-5V7l-9-5Z M3 7l9 5 9-5 M12 12v10',
  drone: 'M5 5h3 M16 5h3 M6.5 5v2 M17.5 5v2 M8 9h8v4H8Z M6.5 7 9 9 M17.5 7 15 9 M10 13l-1 3 M14 13l1 3',
  dashboard: 'M3 3h8v8H3Z M13 3h8v5h-8Z M13 10h8v11h-8Z M3 13h8v8H3Z',
  layers: 'M12 3 2 8l10 5 10-5-10-5Z M2 13l10 5 10-5 M2 18l10 5 10-5',
  key: 'M15 8a5 5 0 1 1-4.6 7H8v2H6v2H3v-3l6.4-6.4A5 5 0 0 1 15 8Z M16 10h.01',
  logout: 'M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4 M10 17l-5-5 5-5 M5 12h11',
  play: 'M7 4l12 8-12 8V4Z',
  pause: 'M7 4h3v16H7Z M14 4h3v16h-3Z',
  copy: 'M9 9h11v11H9Z M5 15H4V4h11v1',
  satellite: 'M10 10l4-4 4 4-4 4Z M9 9 5 5 2 8l4 4 3-3 M15 15l4 4-3 3-4-4 3-3 M4 20a6 6 0 0 1 2-4',
  external: 'M14 4h6v6 M20 4l-9 9 M18 14v6H4V6h6',
  monitor: 'M3 5h18v11H3Z M8 20h8 M12 16v4 M7 9l3 3-3 3',
  // Nose up (north); the radar rotates it by the aircraft's track.
  plane: 'M12 2.5c.9 0 1.5.8 1.5 1.8v5.2l7.5 4.3v2.1l-7.5-2.3v4.6l2.2 1.7v1.6L12 20.6l-3.7.9v-1.6l2.2-1.7v-4.6L3 15.9v-2.1l7.5-4.3V4.3c0-1 .6-1.8 1.5-1.8Z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0V4Z M8 6H4v1a3 3 0 0 0 4 3 M16 6h4v1a3 3 0 0 1-4 3 M12 13v4 M8 21h8 M9 17h6v4H9Z',
  pc: 'M3 4h18v12H3Z M8 20h8 M12 16v4',
  edit: 'M4 20h4L19 9l-4-4L4 16v4Z M13.5 6.5l4 4',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v6 M14 11v6',
  download: 'M12 4v11 M7 10l5 5 5-5 M5 20h14',
  copy: 'M9 9h10v11H9Z M5 15V4h10',
  report: 'M6 3h9l4 4v14H6Z M14 3v5h5 M9 12h7 M9 16h7',
  team: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6 M16 5.5a3 3 0 0 1 0 5.5 M17.5 14.5c2 .8 3.5 2.9 3.5 5.5',
  lock: 'M6 11h12v10H6Z M8 11V7a4 4 0 0 1 8 0v4',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M12 12h.01',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2Z M10 20a2 2 0 0 0 4 0',
  camera: 'M4 7h3l2-2h6l2 2h3v12H4Z M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  glasses: 'M2 10h20 M6.5 15a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M17.5 15a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M10 11.5h4',
  hotspot: 'M12 13a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z M8.5 15a5 5 0 0 1 0-7 M15.5 8a5 5 0 0 1 0 7 M5.6 17.4a9 9 0 0 1 0-12.8 M18.4 4.6a9 9 0 0 1 0 12.8 M12 13v8',
  hacktool: 'M12 3a7 7 0 0 0-4 12.7V19h8v-3.3A7 7 0 0 0 12 3Z M9.5 11h.01 M14.5 11h.01 M10 19v2 M14 19v2 M11 15h2',
  chip: 'M7 7h10v10H7Z M10 10h4v4h-4Z M9 3v4 M15 3v4 M9 17v4 M15 17v4 M3 9h4 M3 15h4 M17 9h4 M17 15h4',
  medical: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z',
  vehicle: 'M5 16l1.5-6h11l1.5 6 M3 16h18v3H3Z M7 19v2 M17 19v2 M7.5 13h.01 M16.5 13h.01',
  radio: 'M12 12.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z M8 15.5a5.5 5.5 0 0 1 0-9 M16 6.5a5.5 5.5 0 0 1 0 9 M4.5 19a10 10 0 0 1 0-16 M19.5 3a10 10 0 0 1 0 16',
};

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Returns an <svg> icon element. `label` makes it announced; otherwise it is decorative. */
export function icon(name, { size = 18, label = null, className = '' } = {}) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.75');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('class', `icon ${className}`.trim());
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
  for (const d of (PATHS[name] ?? PATHS.device).split(' M').map((p, i) => (i ? `M${p}` : p))) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

/** Replaces every <i data-icon="name"> placeholder in the static HTML with its SVG. */
export function hydrateIcons(root = document) {
  for (const ph of root.querySelectorAll('i[data-icon]')) {
    ph.replaceWith(icon(ph.dataset.icon, { size: Number(ph.dataset.size) || 18, className: ph.className }));
  }
}

export const TYPE_ICON = {
  phone: 'phone',
  tablet: 'tablet',
  computer: 'laptop',
  watch: 'watch',
  wearable: 'wearable',
  audio: 'audio',
  tracker: 'tracker',
  tv: 'tv',
  router: 'router',
  iot: 'iot',
  accessory: 'accessory',
  drone: 'drone',
  camera: 'camera',
  glasses: 'glasses',
  hotspot: 'hotspot',
  attacktool: 'hacktool',
  devboard: 'chip',
  medical: 'medical',
  vehicle: 'vehicle',
  lock: 'lock',
  payment: 'card',
  unknown: 'device',
};

export const STATUS_ICON = { AUTHORIZED: 'check', UNKNOWN: 'unknown', VERIFIED_UNAUTHORIZED: 'block' };
