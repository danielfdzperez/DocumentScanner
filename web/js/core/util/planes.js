// @ts-check
/**
 * Utilidades sobre "planos" (imágenes de un solo canal) usadas por los filtros.
 * Un plano es `{ width, height, data }` con `data` numérico de longitud width*height.
 */

/**
 * @typedef {{ width: number, height: number, data: Float32Array }} Plane
 */

/** Pesos de luminancia (aprox. Rec.601) en enteros: Y = (77R + 150G + 29B) / 256. */
export function lumaOf(r, g, b) {
  return (77 * r + 150 * g + 29 * b) >> 8;
}

/**
 * Plano de luminancia a resolución completa.
 * @param {import('../image-buffer.js').ImageBuffer} image
 * @returns {Uint8ClampedArray}
 */
export function extractLuma(image) {
  const { data } = image;
  const out = new Uint8ClampedArray(image.pixelCount);
  for (let i = 0, p = 0; p < out.length; i += 4, p++) {
    out[p] = lumaOf(data[i], data[i + 1], data[i + 2]);
  }
  return out;
}

/**
 * Reduce un plano a bloques de `factor`×`factor` quedándose con el MÁXIMO de cada bloque.
 * Equivale a reducir y dilatar a la vez: los trazos oscuros finos desaparecen
 * y solo queda el fondo claro (el papel).
 * @param {Uint8ClampedArray} src
 * @param {number} width
 * @param {number} height
 * @param {number} factor
 * @returns {Plane}
 */
export function downscaleMax(src, width, height, factor) {
  const w = Math.max(1, Math.ceil(width / factor));
  const h = Math.max(1, Math.ceil(height / factor));
  const out = new Float32Array(w * h);
  for (let by = 0; by < h; by++) {
    const y0 = by * factor;
    const y1 = Math.min(height, y0 + factor);
    for (let bx = 0; bx < w; bx++) {
      const x0 = bx * factor;
      const x1 = Math.min(width, x0 + factor);
      let max = 0;
      for (let y = y0; y < y1; y++) {
        const row = y * width;
        for (let x = x0; x < x1; x++) {
          const v = src[row + x];
          if (v > max) max = v;
        }
      }
      out[by * w + bx] = max;
    }
  }
  return { width: w, height: h, data: out };
}

/**
 * Filtro de máximo (dilatación) separable con ventana cuadrada de lado 2*radius+1.
 * @param {Plane} plane
 * @param {number} radius
 * @returns {Plane}
 */
export function maxFilter(plane, radius) {
  if (radius <= 0) return plane;
  const { width, height, data } = plane;
  const tmp = new Float32Array(data.length);
  const out = new Float32Array(data.length);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const a = Math.max(0, x - radius);
      const b = Math.min(width - 1, x + radius);
      let m = 0;
      for (let k = a; k <= b; k++) if (data[row + k] > m) m = data[row + k];
      tmp[row + x] = m;
    }
  }
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const a = Math.max(0, y - radius);
      const b = Math.min(height - 1, y + radius);
      let m = 0;
      for (let k = a; k <= b; k++) if (tmp[k * width + x] > m) m = tmp[k * width + x];
      out[y * width + x] = m;
    }
  }
  return { width, height, data: out };
}

/**
 * Desenfoque de caja separable. Varias pasadas se aproximan a un desenfoque gaussiano.
 * Los bordes se tratan repitiendo el píxel del borde.
 * @param {Plane} plane
 * @param {number} radius
 * @param {number} [passes]
 * @returns {Plane}
 */
export function boxBlur(plane, radius, passes = 2) {
  if (radius <= 0 || passes <= 0) return plane;
  const { width, height } = plane;
  let src = plane.data;
  for (let p = 0; p < passes; p++) {
    const tmp = new Float32Array(src.length);
    const dst = new Float32Array(src.length);
    const size = 2 * radius + 1;
    // Horizontal
    for (let y = 0; y < height; y++) {
      const row = y * width;
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += src[row + clamp(k, 0, width - 1)];
      for (let x = 0; x < width; x++) {
        tmp[row + x] = sum / size;
        sum += src[row + Math.min(width - 1, x + radius + 1)] - src[row + Math.max(0, x - radius)];
      }
    }
    // Vertical
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += tmp[clamp(k, 0, height - 1) * width + x];
      for (let y = 0; y < height; y++) {
        dst[y * width + x] = sum / size;
        sum +=
          tmp[Math.min(height - 1, y + radius + 1) * width + x] -
          tmp[Math.max(0, y - radius) * width + x];
      }
    }
    src = dst;
  }
  return { width, height, data: src };
}

/**
 * Amplía un plano a `width`×`height` con interpolación bilineal.
 * @param {Plane} plane
 * @param {number} width
 * @param {number} height
 * @returns {Float32Array}
 */
export function upscaleBilinear(plane, width, height) {
  const { width: sw, height: sh, data } = plane;
  const out = new Float32Array(width * height);
  const x0s = new Int32Array(width);
  const x1s = new Int32Array(width);
  const fxs = new Float32Array(width);
  for (let x = 0; x < width; x++) {
    const sx = Math.min(sw - 1, Math.max(0, ((x + 0.5) * sw) / width - 0.5));
    const x0 = Math.floor(sx);
    x0s[x] = x0;
    x1s[x] = Math.min(sw - 1, x0 + 1);
    fxs[x] = sx - x0;
  }
  for (let y = 0; y < height; y++) {
    const sy = Math.min(sh - 1, Math.max(0, ((y + 0.5) * sh) / height - 0.5));
    const y0 = Math.floor(sy);
    const y1 = Math.min(sh - 1, y0 + 1);
    const fy = sy - y0;
    const r0 = y0 * sw;
    const r1 = y1 * sw;
    for (let x = 0; x < width; x++) {
      const fx = fxs[x];
      const top = data[r0 + x0s[x]] * (1 - fx) + data[r0 + x1s[x]] * fx;
      const bottom = data[r1 + x0s[x]] * (1 - fx) + data[r1 + x1s[x]] * fx;
      out[y * width + x] = top * (1 - fy) + bottom * fy;
    }
  }
  return out;
}

/**
 * Valor por debajo del cual queda la fracción `fraction` (0-1) de un histograma de 256 casillas.
 * @param {ArrayLike<number>} histogram
 * @param {number} total
 * @param {number} fraction
 * @returns {number}
 */
export function percentileFromHistogram(histogram, total, fraction) {
  const target = total * fraction;
  let acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += histogram[v];
    if (acc >= target) return v;
  }
  return 255;
}

/** @param {number} v @param {number} lo @param {number} hi */
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
