// @ts-check
import { ImageFilter } from '../contracts.js';
import { clamp, extractLuma, percentileFromHistogram } from '../util/planes.js';

const LOW_PERCENTILE = 0.01; // el 1 % más oscuro se considera "negro"
const HIGH_PERCENTILE = 0.99; // el 1 % más claro se considera "blanco"
const MIN_RANGE = 16; // si el rango es menor, la imagen es casi plana y no se toca

/**
 * Niveles automáticos: estira el histograma para que lo más oscuro llegue a 0 y lo más
 * claro a 255. Se calcula sobre la luminancia y se aplica igual a los tres canales,
 * de modo que no cambia el tono del color.
 *
 * Opciones: `strength` 0-100 (%) = cuánto se acercan los puntos de negro/blanco a los extremos.
 */
export class AutoLevelsFilter extends ImageFilter {
  get id() {
    return 'levels';
  }

  isActive(options) {
    return options.strength > 0;
  }

  apply(image, options) {
    const strength = clamp(options.strength, 0, 100) / 100;
    const luma = extractLuma(image);
    const hist = new Uint32Array(256);
    for (let i = 0; i < luma.length; i++) hist[luma[i]]++;

    const low = percentileFromHistogram(hist, luma.length, LOW_PERCENTILE);
    const high = percentileFromHistogram(hist, luma.length, HIGH_PERCENTILE);
    if (high - low < MIN_RANGE) return image;

    const black = low * strength;
    const white = 255 - (255 - high) * strength;
    const scale = 255 / (white - black);

    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) lut[v] = (v - black) * scale;

    const { data } = image;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = lut[data[i]];
      data[i + 1] = lut[data[i + 1]];
      data[i + 2] = lut[data[i + 2]];
    }
    return image;
  }
}
