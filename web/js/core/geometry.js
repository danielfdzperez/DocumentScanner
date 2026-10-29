// @ts-check
import { ImageBuffer } from './image-buffer.js';

/**
 * Geometría de imagen: giros de 90° y recorte con corrección de perspectiva.
 * Código puro (sin DOM). Los puntos se expresan de dos formas:
 *  - normalizados: x e y entre 0 y 1 respecto al tamaño de la imagen (lo que usa la interfaz);
 *  - en píxeles: coordenadas reales sobre un ImageBuffer concreto.
 *
 * @typedef {{ x: number, y: number }} Point
 */

/** Esquinas por defecto: la imagen entera con un pequeño margen. @param {number} [inset] */
export function defaultCorners(inset = 0.04) {
  return [
    { x: inset, y: inset },
    { x: 1 - inset, y: inset },
    { x: 1 - inset, y: 1 - inset },
    { x: inset, y: 1 - inset },
  ];
}

/**
 * Ordena cuatro puntos como [arriba-izq, arriba-der, abajo-der, abajo-izq],
 * da igual el orden en que el usuario los haya movido.
 * @param {Point[]} points
 * @returns {Point[]}
 */
export function orderCorners(points) {
  if (points.length !== 4) throw new RangeError('Se necesitan exactamente 4 puntos');
  const cx = points.reduce((s, p) => s + p.x, 0) / 4;
  const cy = points.reduce((s, p) => s + p.y, 0) / 4;
  // Orden horario empezando por la esquina superior izquierda (eje y hacia abajo).
  const byAngle = [...points].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  // Con el ángulo en [-π, π] y y hacia abajo, el primero es el de la izquierda-arriba (ángulo ≈ -3π/4)
  // sólo en un cuadrado; en general se busca el que minimiza x + y.
  let start = 0;
  for (let i = 1; i < 4; i++) {
    if (byAngle[i].x + byAngle[i].y < byAngle[start].x + byAngle[start].y) start = i;
  }
  return [0, 1, 2, 3].map((i) => byAngle[(start + i) % 4]);
}

/**
 * ¿Es un cuadrilátero convexo, no degenerado y con un área mínima?
 * @param {Point[]} corners ordenados
 * @param {number} [minArea] área mínima (en las mismas unidades al cuadrado)
 */
export function isValidQuad(corners, minArea = 1e-4) {
  let sign = 0;
  let area2 = 0;
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    const c = corners[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross !== 0) {
      if (sign === 0) sign = Math.sign(cross);
      else if (Math.sign(cross) !== sign) return false;
    }
    area2 += a.x * b.y - b.x * a.y;
  }
  return sign !== 0 && Math.abs(area2) / 2 >= minArea;
}

/**
 * Gira un punto normalizado un cuarto de vuelta.
 * @param {Point} p
 * @param {1 | -1} direction 1 = horario, -1 = antihorario
 * @returns {Point}
 */
export function rotatePointQuarter(p, direction) {
  return direction === 1 ? { x: 1 - p.y, y: p.x } : { x: p.y, y: 1 - p.x };
}

/**
 * Gira la imagen 90° (horario) o -90° (antihorario). Devuelve una imagen nueva.
 * @param {ImageBuffer} image
 * @param {1 | -1} direction
 * @returns {ImageBuffer}
 */
export function rotateQuarter(image, direction) {
  const { width: w, height: h, data: src } = image;
  const out = new ImageBuffer(h, w);
  const dst = out.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // horario: (x, y) -> (h-1-y, x); antihorario: (x, y) -> (y, w-1-x)
      const nx = direction === 1 ? h - 1 - y : y;
      const ny = direction === 1 ? x : w - 1 - x;
      const s = (y * w + x) * 4;
      const d = (ny * h + nx) * 4;
      dst[d] = src[s];
      dst[d + 1] = src[s + 1];
      dst[d + 2] = src[s + 2];
      dst[d + 3] = src[s + 3];
    }
  }
  return out;
}

/**
 * Reduce la imagen (promedio por bloques) para que su lado mayor no supere `maxSide`.
 * Si ya cabe, devuelve la misma imagen. No amplía nunca.
 * @param {ImageBuffer} image
 * @param {number} maxSide
 * @returns {ImageBuffer}
 */
export function resizeToFit(image, maxSide) {
  const scale = maxSide / Math.max(image.width, image.height);
  if (scale >= 1) return image;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const out = new ImageBuffer(width, height);
  const sx = image.width / width;
  const sy = image.height / height;
  const s = image.data;
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor(y * sy);
    const y1 = Math.max(y0 + 1, Math.min(image.height, Math.ceil((y + 1) * sy)));
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor(x * sx);
      const x1 = Math.max(x0 + 1, Math.min(image.width, Math.ceil((x + 1) * sx)));
      let r = 0;
      let g = 0;
      let b = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * image.width + xx) * 4;
          r += s[i];
          g += s[i + 1];
          b += s[i + 2];
        }
      }
      const n = (y1 - y0) * (x1 - x0);
      out.data.set([r / n, g / n, b / n, 255], (y * width + x) * 4);
    }
  }
  return out;
}

/**
 * Tamaño natural del rectángulo resultante de enderezar un cuadrilátero:
 * el mayor de cada par de lados opuestos.
 * @param {Point[]} corners ordenados, en píxeles
 * @returns {{ width: number, height: number }}
 */
export function quadOutputSize(corners) {
  const dist = (/** @type {Point} */ a, /** @type {Point} */ b) => Math.hypot(a.x - b.x, a.y - b.y);
  const [tl, tr, br, bl] = corners;
  return {
    width: Math.max(1, Math.round(Math.max(dist(tl, tr), dist(bl, br)))),
    height: Math.max(1, Math.round(Math.max(dist(tl, bl), dist(tr, br)))),
  };
}

/**
 * Recorta el cuadrilátero `corners` (normalizado, en cualquier orden) y lo endereza a un
 * rectángulo (corrección de perspectiva). El tamaño de salida sale de las longitudes de los lados.
 * @param {ImageBuffer} image
 * @param {Point[]} corners normalizados 0-1
 * @returns {ImageBuffer}
 */
export function cropPerspective(image, corners) {
  const px = orderCorners(corners).map((p) => ({ x: p.x * image.width, y: p.y * image.height }));
  if (!isValidQuad(px, 4)) throw new RangeError('El cuadrilátero no es válido');
  const { width, height } = quadOutputSize(px);
  return warpToRect(image, px, width, height);
}

/**
 * Muestrea `image` dentro del cuadrilátero `src` (píxeles, ordenado TL,TR,BR,BL)
 * para rellenar un rectángulo `width`×`height` (interpolación bilineal).
 * @param {ImageBuffer} image
 * @param {Point[]} src
 * @param {number} width
 * @param {number} height
 * @returns {ImageBuffer}
 */
export function warpToRect(image, src, width, height) {
  const h = homographyFromRect(width, height, src);
  const out = new ImageBuffer(width, height);
  const d = out.data;
  const s = image.data;
  const maxX = image.width - 1;
  const maxY = image.height - 1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const w = h[6] * px + h[7] * py + 1;
      let sx = (h[0] * px + h[1] * py + h[2]) / w - 0.5;
      let sy = (h[3] * px + h[4] * py + h[5]) / w - 0.5;
      sx = sx < 0 ? 0 : sx > maxX ? maxX : sx;
      sy = sy < 0 ? 0 : sy > maxY ? maxY : sy;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(maxX, x0 + 1);
      const y1 = Math.min(maxY, y0 + 1);
      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = (y0 * image.width + x0) * 4;
      const i10 = (y0 * image.width + x1) * 4;
      const i01 = (y1 * image.width + x0) * 4;
      const i11 = (y1 * image.width + x1) * 4;
      const o = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const top = s[i00 + c] * (1 - fx) + s[i10 + c] * fx;
        const bottom = s[i01 + c] * (1 - fx) + s[i11 + c] * fx;
        d[o + c] = top * (1 - fy) + bottom * fy;
      }
      d[o + 3] = 255;
    }
  }
  return out;
}

/**
 * Homografía [h0..h7] (h8 = 1) que lleva el rectángulo (0,0)-(width,height)
 * al cuadrilátero `quad` (TL, TR, BR, BL).
 * @param {number} width
 * @param {number} height
 * @param {Point[]} quad
 * @returns {number[]}
 */
export function homographyFromRect(width, height, quad) {
  const dst = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ];
  /** @type {number[][]} */
  const m = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = dst[i];
    const { x: u, y: v } = quad[i];
    m.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    m.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  return solveLinear(m);
}

/**
 * Resuelve un sistema n×(n+1) por eliminación gaussiana con pivote parcial.
 * @param {number[][]} m matriz ampliada (se modifica)
 * @returns {number[]}
 */
function solveLinear(m) {
  const n = m.length;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    if (Math.abs(m[pivot][col]) < 1e-12) throw new RangeError('Sistema singular');
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let r = col + 1; r < n; r++) {
      const f = m[r][col] / m[col][col];
      for (let c = col; c <= n; c++) m[r][c] -= f * m[col][c];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let sum = m[r][n];
    for (let c = r + 1; c < n; c++) sum -= m[r][c] * x[c];
    x[r] = sum / m[r][r];
  }
  return x;
}
