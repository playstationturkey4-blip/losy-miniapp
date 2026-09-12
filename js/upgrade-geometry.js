/* One coordinate system: 0° top, 90° right, 180° bottom, 270° left.
   Only the lower semicircle [90,270) is the outcome domain. */
export function upgradeGeometry(chance) {
  if (!Number.isFinite(chance) || chance < 0 || chance > 1) throw new RangeError('chance must be in [0,1]');
  const degrees = chance * 180;
  const start = 180 - degrees / 2, end = 180 + degrees / 2;
  const point = angle => {
    const a = (angle - 90) * Math.PI / 180;
    return `${(50 + 48 * Math.cos(a)).toFixed(8)} ${(50 + 48 * Math.sin(a)).toFixed(8)}`;
  };
  return { degrees, start, end, length: chance * Math.PI * 48,
    path: chance > 0 ? `M ${point(start)} A 48 48 0 0 1 ${point(end)}` : '' };
}
export function sampleUpgrade(chance, random = Math.random()) {
  if (!Number.isFinite(random) || random < 0 || random >= 1) throw new RangeError('random must be in [0,1)');
  const zone = upgradeGeometry(chance);
  const angle = 90 + 180 * random;
  return { angle, won: chance > 0 && angle >= zone.start && angle < zone.end };
}
