// @ts-check
import { ImageFilter } from '../contracts.js';
import { clamp, lumaOf } from '../util/planes.js';

/**
 * Saturación del color: multiplica la distancia de cada canal a su gris.
 *
 * Opciones: `percent` 0-300. 100 = sin cambios, 0 = escala de grises, 300 = colores muy vivos.
 */
export class SaturationFilter extends ImageFilter {
  get id() {
    return 'saturation';
  }

  isActive(options) {
    return options.percent !== 100;
  }

  apply(image, options) {
    const gain = clamp(options.percent, 0, 300) / 100;
    const { data } = image;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = lumaOf(r, g, b);
      data[i] = gray + (r - gray) * gain;
      data[i + 1] = gray + (g - gray) * gain;
      data[i + 2] = gray + (b - gray) * gain;
    }
    return image;
  }
}
