// @ts-check
import { ImageExporter } from '../core/contracts.js';
import { paint } from './canvas-utils.js';

const MIME = { png: 'image/png', jpeg: 'image/jpeg' };

/** Exporta imágenes a PNG o JPEG usando un canvas. */
export class CanvasExporter extends ImageExporter {
  export(image, { format, quality = 0.92 }) {
    const canvas = document.createElement('canvas');
    paint(image, canvas);
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen'))),
        MIME[format],
        quality,
      );
    });
  }
}
