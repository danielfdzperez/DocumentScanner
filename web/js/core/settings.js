// @ts-check
/**
 * Descripción declarativa de los ajustes: qué sliders existen, sus rangos y los presets.
 * La interfaz se genera a partir de esto, así que añadir un filtro nuevo
 * solo requiere una entrada aquí (y sus textos en los locales).
 */

/**
 * @typedef {object} ControlSpec
 * @property {string} filterId  id del filtro al que pertenece
 * @property {string} option    nombre de la opción dentro del filtro
 * @property {number} min
 * @property {number} max
 * @property {number} step
 * @property {string} unit      sufijo mostrado junto al valor ('%' o '')
 */

/** @type {readonly ControlSpec[]} */
export const CONTROLS = Object.freeze([
  { filterId: 'whiteBalance', option: 'strength', min: 0, max: 100, step: 1, unit: '%' },
  { filterId: 'illumination', option: 'strength', min: 0, max: 100, step: 1, unit: '%' },
  { filterId: 'clahe', option: 'level', min: 0, max: 10, step: 1, unit: '' },
  { filterId: 'levels', option: 'strength', min: 0, max: 100, step: 1, unit: '%' },
  { filterId: 'contrast', option: 'amount', min: 0, max: 100, step: 1, unit: '%' },
  { filterId: 'saturation', option: 'percent', min: 0, max: 300, step: 5, unit: '%' },
]);

/** Ajustes que no cambian nada (imagen original). */
export const NEUTRAL_SETTINGS = Object.freeze({
  whiteBalance: Object.freeze({ strength: 0 }),
  illumination: Object.freeze({ strength: 0 }),
  clahe: Object.freeze({ level: 0 }),
  levels: Object.freeze({ strength: 0 }),
  contrast: Object.freeze({ amount: 0 }),
  saturation: Object.freeze({ percent: 100 }),
});

/**
 * @typedef {object} Preset
 * @property {string} id  también es la clave de traducción `presets.<id>`
 * @property {import('./pipeline.js').PipelineSettings} settings
 */

/** @type {readonly Preset[]} */
export const PRESETS = Object.freeze([
  { id: 'original', settings: NEUTRAL_SETTINGS },
  {
    id: 'document',
    settings: {
      whiteBalance: { strength: 100 },
      illumination: { strength: 85 },
      clahe: { level: 2 },
      levels: { strength: 70 },
      contrast: { amount: 15 },
      saturation: { percent: 110 },
    },
  },
  {
    id: 'vivid',
    settings: {
      whiteBalance: { strength: 100 },
      illumination: { strength: 60 },
      clahe: { level: 4 },
      levels: { strength: 50 },
      contrast: { amount: 20 },
      saturation: { percent: 200 },
    },
  },
  {
    id: 'gray',
    settings: {
      whiteBalance: { strength: 100 },
      illumination: { strength: 90 },
      clahe: { level: 2 },
      levels: { strength: 80 },
      contrast: { amount: 25 },
      saturation: { percent: 0 },
    },
  },
  {
    id: 'blackWhite',
    settings: {
      whiteBalance: { strength: 100 },
      illumination: { strength: 100 },
      clahe: { level: 2 },
      levels: { strength: 100 },
      contrast: { amount: 100 },
      saturation: { percent: 0 },
    },
  },
]);

export const DEFAULT_PRESET_ID = 'document';

/**
 * Copia profunda y editable de unos ajustes.
 * @param {import('./pipeline.js').PipelineSettings} settings
 * @returns {Record<string, Record<string, number>>}
 */
export function cloneSettings(settings) {
  /** @type {Record<string, Record<string, number>>} */
  const copy = {};
  for (const [id, options] of Object.entries(settings)) copy[id] = { ...options };
  return copy;
}

/**
 * @param {string} id
 * @returns {Preset}
 */
export function getPreset(id) {
  const preset = PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`Preset desconocido: ${id}`);
  return preset;
}
