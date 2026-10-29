// @ts-check
import { ImageFilter } from '../contracts.js';
import { clamp, extractLuma } from '../util/planes.js';

const GRID = 8; // 8x8 teselas, como en el prototipo de DrawinGame
const BINS = 256;
const CLIP_PER_LEVEL = 0.5; // nivel 1-10 -> límite de recorte 0.5-5 (igual que el prototipo)

/**
 * CLAHE: ecualización adaptativa del histograma con límite de contraste.
 * Realza el contraste LOCAL (letras tenues, trazos de lápiz) sin quemar las zonas lisas.
 * Se aplica sobre la luminancia y la diferencia se suma a los tres canales para conservar el color.
 *
 * Opciones: `level` 0-10. 0 = desactivado.
 */
export class ClaheFilter extends ImageFilter {
  get id() {
    return 'clahe';
  }

  isActive(options) {
    return options.level > 0;
  }

  apply(image, options) {
    const clip = clamp(options.level, 0, 10) * CLIP_PER_LEVEL;
    const { width, height, data } = image;
    const luma = extractLuma(image);
    const luts = buildTileLuts(luma, width, height, clip);

    // Centros de tesela en coordenadas de píxel, para interpolar entre las 4 más cercanas.
    const tileW = width / GRID;
    const tileH = height / GRID;

    for (let y = 0; y < height; y++) {
      const fy = clamp(y / tileH - 0.5, 0, GRID - 1);
      const ty0 = Math.floor(fy);
      const ty1 = Math.min(GRID - 1, ty0 + 1);
      const wy = fy - ty0;
      for (let x = 0; x < width; x++) {
        const fx = clamp(x / tileW - 0.5, 0, GRID - 1);
        const tx0 = Math.floor(fx);
        const tx1 = Math.min(GRID - 1, tx0 + 1);
        const wx = fx - tx0;

        const p = y * width + x;
        const v = luma[p];
        const top = luts[ty0 * GRID + tx0][v] * (1 - wx) + luts[ty0 * GRID + tx1][v] * wx;
        const bottom = luts[ty1 * GRID + tx0][v] * (1 - wx) + luts[ty1 * GRID + tx1][v] * wx;
        const delta = top * (1 - wy) + bottom * wy - v;

        const i = p * 4;
        data[i] += delta;
        data[i + 1] += delta;
        data[i + 2] += delta;
      }
    }
    return image;
  }
}

/**
 * Tabla de conversión (256 entradas) para cada tesela.
 * @param {Uint8ClampedArray} luma
 * @param {number} width
 * @param {number} height
 * @param {number} clip límite de recorte relativo (como `clipLimit` de OpenCV)
 * @returns {Float32Array[]}
 */
function buildTileLuts(luma, width, height, clip) {
  const luts = [];
  for (let ty = 0; ty < GRID; ty++) {
    const y0 = Math.floor((ty * height) / GRID);
    const y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * height) / GRID));
    for (let tx = 0; tx < GRID; tx++) {
      const x0 = Math.floor((tx * width) / GRID);
      const x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * width) / GRID));
      luts.push(tileLut(luma, width, x0, x1, y0, y1, clip));
    }
  }
  return luts;
}

/** @returns {Float32Array} */
function tileLut(luma, width, x0, x1, y0, y1, clip) {
  const hist = new Float64Array(BINS);
  for (let y = y0; y < y1; y++) {
    const row = y * width;
    for (let x = x0; x < x1; x++) hist[luma[row + x]]++;
  }
  const area = (x1 - x0) * (y1 - y0);

  // Recorta el histograma y reparte el exceso por igual entre todas las casillas.
  const limit = Math.max(1, (clip * area) / BINS);
  let excess = 0;
  for (let b = 0; b < BINS; b++) {
    if (hist[b] > limit) {
      excess += hist[b] - limit;
      hist[b] = limit;
    }
  }
  const share = excess / BINS;
  for (let b = 0; b < BINS; b++) hist[b] += share;

  // Función de distribución acumulada -> tabla 0..255.
  const lut = new Float32Array(BINS);
  let acc = 0;
  const scale = 255 / area;
  for (let b = 0; b < BINS; b++) {
    acc += hist[b];
    lut[b] = acc * scale;
  }
  return lut;
}
