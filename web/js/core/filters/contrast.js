// @ts-check
import { ImageFilter } from '../contracts.js';
import { clamp } from '../util/planes.js';

const PIVOT = 128;
const GAIN_PER_PERCENT = 1 / 25; // 100 % -> contraste x5

/**
 * Contraste global lineal alrededor del gris medio.
 *
 * Opciones: `amount` 0-100 (%). 0 = sin cambios, 100 = contraste x5 (casi blanco y negro puro).
 */
export class ContrastFilter extends ImageFilter {
  get id() {
    return 'contrast';
  }

  isActive(options) {
    return options.amount > 0;
  }

  apply(image, options) {
    const gain = 1 + clamp(options.amount, 0, 100) * GAIN_PER_PERCENT;
    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) lut[v] = (v - PIVOT) * gain + PIVOT;

    const { data } = image;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = lut[data[i]];
      data[i + 1] = lut[data[i + 1]];
      data[i + 2] = lut[data[i + 2]];
    }
    return image;
  }
}
