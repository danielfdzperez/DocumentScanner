// @ts-check
import { FrameSource } from '../core/contracts.js';
import { rasterize } from './canvas-utils.js';

/**
 * Origen de imagen a partir de un archivo elegido por el usuario (galería, arrastrar y soltar...).
 */
export class FileFrameSource extends FrameSource {
  /** @param {ImageBitmap} bitmap */
  constructor(bitmap) {
    super();
    this.bitmap = bitmap;
  }

  /**
   * Decodifica el archivo respetando la orientación EXIF.
   * @param {File | Blob} file
   * @returns {Promise<FileFrameSource>}
   */
  static async fromFile(file) {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return new FileFrameSource(bitmap);
  }

  grab(maxSide) {
    return Promise.resolve(rasterize(this.bitmap, this.bitmap.width, this.bitmap.height, maxSide));
  }

  dispose() {
    this.bitmap.close();
  }
}
