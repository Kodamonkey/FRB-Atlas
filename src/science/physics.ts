// Operadores puros copiados de frb-explorer para construir este sitio sin ese proyecto hermano.
export const DISPERSION_SECONDS_MHZ = 4.148808e3;

export function dispersionDelaySeconds(dm: number, lowMHz: number, highMHz: number): number {
  if (lowMHz <= 0 || highMHz <= 0) return 0;
  const low = Math.min(lowMHz, highMHz);
  const high = Math.max(lowMHz, highMHz);
  return DISPERSION_SECONDS_MHZ * dm * (low ** -2 - high ** -2);
}

export function roundTiesToEven(value: number): number {
  const floor = Math.floor(value);
  const fraction = value - floor;
  if (fraction < 0.5) return floor;
  if (fraction > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

export function observedDM(foreground: number, hostRest: number, redshift: number): number {
  return foreground + hostRest / (1 + redshift);
}

export function plasmaFrequencyHz(electronDensityPerM3: number): number {
  const charge = 1.602176634e-19;
  const permittivity = 8.8541878128e-12;
  const electronMass = 9.1093837015e-31;
  return Math.sqrt(electronDensityPerM3 * charge ** 2 / (permittivity * electronMass)) / (2 * Math.PI);
}

export function groupVelocity(electronDensityPerM3: number, frequencyHz: number): number {
  const ratio = plasmaFrequencyHz(electronDensityPerM3) / frequencyHz;
  return ratio >= 1 ? 0 : 299792458 * Math.sqrt(1 - ratio ** 2);
}

export function intrachannelSmearingSeconds(dm: number, channelWidthMHz: number, frequencyMHz: number): number {
  return 8.3e-6 * dm * channelWidthMHz * (frequencyMHz / 1000) ** -3;
}

export function gaussianEnvelope(time: number, center: number, sigma: number): number {
  return Math.exp(-0.5 * ((time - center) / Math.max(sigma, 1e-12)) ** 2);
}

// Five-point Gauss-Legendre quadrature integrates an intensity bin without
// materialising the native high-rate voltage or intensity observation.
export function integratedGaussian(time: number, center: number, sigma: number, duration: number): number {
  const offsets = [-0.906179845938664, -0.538469310105683, 0, 0.538469310105683, 0.906179845938664];
  const weights = [0.236926885056189, 0.478628670499366, 0.568888888888889, 0.478628670499366, 0.236926885056189];
  let value = 0;
  for (let i = 0; i < offsets.length; i++) {
    value += weights[i] * gaussianEnvelope(time + offsets[i] * duration / 2, center, sigma);
  }
  return value / 2;
}
