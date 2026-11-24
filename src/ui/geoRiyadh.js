// Offline vector backdrop for the aircraft view: built-in coordinates, no map tiles.
// Runway ends are from public aeronautical databases (SkyVector); the city outline and the
// highways are hand-traced approximations for orientation only — not for navigation.

export const AIRFIELDS = Object.freeze([
  {
    code: 'RUH',
    name: 'King Khalid Intl (RUH)',
    runways: [
      { name: '15L/33R', ends: [[24.9769, 46.702], [24.944, 46.7228]] },
      { name: '15R/33L', ends: [[24.9709, 46.6749], [24.938, 46.6957]] },
    ],
  },
  {
    code: 'OERY',
    name: 'King Salman Air Base',
    runways: [{ name: '01/19', ends: [[24.7051, 46.7245], [24.7418, 46.7302]] }],
  },
]);

// Built-up area of Riyadh (approximate).
export const CITY_OUTLINE = Object.freeze([
  [24.93, 46.56], [24.9, 46.66], [24.86, 46.76], [24.82, 46.84], [24.74, 46.89], [24.64, 46.88], [24.56, 46.84],
  [24.5, 46.76], [24.49, 46.66], [24.53, 46.57], [24.6, 46.52], [24.69, 46.5], [24.78, 46.51], [24.86, 46.52],
]);

export const ROADS = Object.freeze([
  { name: 'King Fahd Rd', pts: [[24.59, 46.73], [24.64, 46.71], [24.69, 46.686], [24.7136, 46.6744], [24.76, 46.648], [24.81, 46.625], [24.87, 46.6]] },
  { name: 'Northern Ring Rd', pts: [[24.75, 46.55], [24.775, 46.6], [24.79, 46.64], [24.8, 46.69], [24.795, 46.74], [24.785, 46.78]] },
  { name: 'Eastern Ring Rd', pts: [[24.785, 46.78], [24.74, 46.79], [24.7, 46.795], [24.65, 46.8], [24.6, 46.795]] },
  { name: 'Southern Ring Rd', pts: [[24.6, 46.795], [24.575, 46.74], [24.57, 46.68], [24.58, 46.62], [24.6, 46.57]] },
  { name: 'Airport Rd', pts: [[24.79, 46.72], [24.84, 46.715], [24.89, 46.708], [24.93, 46.705]] },
]);
