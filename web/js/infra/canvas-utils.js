// @ts-check
import { ImageBuffer } from '../core/image-buffer.js';

/**
 * Tamaño final al reducir (nunca ampliar) para que el lado mayor no supere `maxSide`.
 * @param {number} width
 * @param {number} height
 * @param {number} maxSide
 * @returns {{ width: number, height: number }}
 */
export function fitWithin(width, height, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Dibuja una fuente (imagen, bitmap o vídeo) en un canvas y devuelve sus píxeles.
 * @param {CanvasImageSource} source
 * @param {number} sourceWidth
 * @param {number} sourceHeight
 * @param {number} maxSide
 * @returns {ImageBuffer}
 */
export function rasterize(source, sourceWidth, sourceHeight, maxSide) {
  const { width, height } = fitWithin(sourceWidth, sourceHeight, maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d', { willReadFrequently: true }));
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  return new ImageBuffer(width, height, data);
}

/**
 * Pinta un buffer en un canvas (ajustando su tamaño si hace falta).
 * @param {ImageBuffer} image
 * @param {HTMLCanvasElement} canvas
 */
export function paint(image, canvas) {
  if (canvas.width !== image.width || canvas.height !== image.height) {
    canvas.width = image.width;
    canvas.height = image.height;
  }
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  ctx.putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
}
