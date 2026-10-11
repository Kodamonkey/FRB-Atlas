export type ObservationCaseId = 'arecibo-lf' | 'alma-hf';

export interface ObservationCase {
  id: ObservationCaseId;
  label: string;
  eventId: string;
  observatory: 'arecibo' | 'alma';
  origin: 'extragalactic' | 'galactic';
  dm: number;
  dmMax: number;
  frequencyLowMHz: number;
  frequencyHighMHz: number;
  channels: number;
  dtNativeSeconds: number;
  downTimeRate: number;
  widthMs: number;
  source: { title: string; url: string };
  provenance: string;
}

export const OBSERVATIONS: Record<ObservationCaseId, ObservationCase> = {
  'arecibo-lf': {
    id: 'arecibo-lf', label: 'Arecibo · LF', eventId: 'LF-241032', observatory: 'arecibo', origin: 'extragalactic',
    dm: 500, dmMax: 1000, frequencyLowMHz: 1200, frequencyHighMHz: 1600, channels: 64,
    dtNativeSeconds: .001, downTimeRate: 1, widthMs: 6,
    source: { title: 'Spitler et al. 2014: descubrimiento de FRB 121102 en Arecibo', url: 'https://arxiv.org/abs/1404.2934' },
    provenance: 'Fixture LF sintético. Arecibo es referencia histórica de FRB 121102, no origen de estos datos.',
  },
  'alma-hf': {
    id: 'alma-hf', label: 'ALMA · HF', eventId: 'HF-17452900', observatory: 'alma', origin: 'galactic',
    dm: 1770, dmMax: 3000, frequencyLowMHz: 85268, frequencyHighMHz: 87268, channels: 32,
    dtNativeSeconds: .000032, downTimeRate: 128, widthMs: 20,
    source: { title: 'Vera-Casanova et al.: pulsos del magnetar con phased ALMA', url: 'https://arxiv.org/html/2504.06234v4' },
    provenance: 'Pulso HF sintético inspirado en PSR J1745−2900. No es una observación de FRB ni inferencia neuronal.',
  },
};

export const DEFAULT_OBSERVATION: ObservationCaseId = 'arecibo-lf';
export const isObservationCase = (value: string | null): value is ObservationCaseId => value === 'arecibo-lf' || value === 'alma-hf';
export const effectiveDt = (observation: ObservationCase) => observation.dtNativeSeconds * observation.downTimeRate;
export const channelCentre = (observation: ObservationCase, channel: number) => observation.frequencyLowMHz
  + (channel + .5) * (observation.frequencyHighMHz - observation.frequencyLowMHz) / observation.channels;
export const dispersionSeconds = (dm: number, lowMHz: number, highMHz: number) => 4148.808 * dm
  * Math.abs(lowMHz ** -2 - highMHz ** -2);
export function resolutionRatio(observation: ObservationCase, dm = observation.dmMax) {
  return dispersionSeconds(dm, channelCentre(observation, 0), channelCentre(observation, observation.channels - 1)) / effectiveDt(observation);
}
