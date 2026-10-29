// @ts-check
import { ImageFilter } from '../contracts.js';
import { clamp, percentileFromHistogram } from '../util/planes.js';

const SAMPLE_SIDE = 160; // lado mayor de la muestra con la que se estima el color del papel
const WHITE_PERCENTILE = 0.99; // percentil usado como "blanco" (ignora reflejos puntuales)
const MIN_WHITE = 20; // si la imagen es casi negra no se corrige
const MAX_GAIN = 2.5;

/**
 * Balance de blancos tipo "white-patch": se asume que lo más claro de la imagen
 * (el papel) debe ser blanco y se escala cada canal en consecuencia.
 * Compensa luces cálidas o frías.
 *
 * Opciones: `strength` 0-100 (%). 0 = sin cambios, 100 = corrección completa.
 */
export class WhiteBalanceFilter extends ImageFilter {
  get id() {
    return 'whiteBalance';
  }

  isActive(options) {
    return options.strength > 0;
  }

  apply(image, options) {
    const strength = clamp(options.strength, 0, 100) / 100;
    const gains = estimateGains(image);
    const r = 1 + (gains[0] - 1) * strength;
    const g = 1 + (gains[1] - 1) * strength;
    const b = 1 + (gains[2] - 1) * strength;
    const { data } = image;
    for (let i = 0; i < data.length; i += 4) {
      data[i] *= r; // Uint8ClampedArray satura solo
      data[i + 1] *= g;
      data[i + 2] *= b;
    }
    return image;
  }
}

/**
 * Ganancia por canal [r, g, b] para que el "blanco" de la imagen llegue a 255.
 * Se estima sobre una muestra submuestreada, no sobre todos los píxeles.
 * @param {import('../image-buffer.js').ImageBuffer} image
 * @returns {[number, number, number]}
 */
export function estimateGains(image) {
  const step = Math.max(1, Math.floor(Math.max(image.width, image.height) / SAMPLE_SIDE));
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  let total = 0;
  const { data, width, height } = image;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      hist[0][data[i]]++;
      hist[1][data[i + 1]]++;
      hist[2][data[i + 2]]++;
      total++;
    }
  }
  /** @type {[number, number, number]} */
  const gains = [1, 1, 1];
  for (let c = 0; c < 3; c++) {
    const white = percentileFromHistogram(hist[c], total, WHITE_PERCENTILE);
    gains[c] = white > MIN_WHITE ? clamp(255 / white, 1, MAX_GAIN) : 1;
  }
  return gains;
}
