// @ts-check
import { ImageFilter } from './contracts.js';
import { AutoLevelsFilter } from './filters/auto-levels.js';
import { ClaheFilter } from './filters/clahe.js';
import { ContrastFilter } from './filters/contrast.js';
import { IlluminationFilter } from './filters/illumination.js';
import { SaturationFilter } from './filters/saturation.js';
import { WhiteBalanceFilter } from './filters/white-balance.js';

/**
 * @typedef {Record<string, import('./contracts.js').FilterOptions>} PipelineSettings
 *   Opciones de cada filtro, indexadas por `filter.id`.
 */

/**
 * Ejecuta una lista ordenada de filtros. No conoce ningún filtro concreto:
 * solo el contrato `ImageFilter`.
 */
export class Pipeline {
  /** @param {ImageFilter[]} filters en orden de ejecución */
  constructor(filters) {
    const ids = new Set();
    for (const filter of filters) {
      if (!(filter instanceof ImageFilter)) throw new TypeError('Todos los pasos deben ser ImageFilter');
      if (ids.has(filter.id)) throw new Error(`Filtro duplicado: ${filter.id}`);
      ids.add(filter.id);
    }
    this.filters = [...filters];
  }

  /**
   * Procesa una imagen. El original NO se modifica.
   * Si ningún filtro está activo se devuelve el propio original: tratarlo como solo lectura.
   * @param {import('./image-buffer.js').ImageBuffer} source
   * @param {PipelineSettings} settings
   * @returns {import('./image-buffer.js').ImageBuffer}
   */
  run(source, settings) {
    let image = source;
    let owned = false;
    for (const filter of this.filters) {
      const options = settings[filter.id];
      if (!options || !filter.isActive(options)) continue;
      if (!owned) {
        image = source.clone();
        owned = true;
      }
      image = filter.apply(image, options) ?? image;
    }
    return image;
  }
}

/**
 * Cadena por defecto. El orden importa: primero se corrige el color y la luz
 * y, con la imagen ya uniforme, se realza el contraste y por último el color.
 * @returns {Pipeline}
 */
export function createDefaultPipeline() {
  return new Pipeline([
    new WhiteBalanceFilter(),
    new IlluminationFilter(),
    new ClaheFilter(),
    new AutoLevelsFilter(),
    new ContrastFilter(),
    new SaturationFilter(),
  ]);
}
