// @ts-check
/**
 * Imagen RGBA en memoria, independiente del navegador (no usa DOM ni canvas).
 * Es el único tipo de imagen que entienden los filtros del núcleo, de modo que
 * la misma lógica pueda reutilizarse en tests (Node) o en una futura app.
 */
export class ImageBuffer {
  /**
   * @param {number} width
   * @param {number} height
   * @param {Uint8ClampedArray} [data] RGBA, 4 bytes por píxel. Si falta se crea vacío.
   */
  constructor(width, height, data) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
      throw new RangeError(`Tamaño de imagen no válido: ${width}x${height}`);
    }
    const expected = width * height * 4;
    if (data && data.length !== expected) {
      throw new RangeError(`Se esperaban ${expected} bytes y llegaron ${data.length}`);
    }
    this.width = width;
    this.height = height;
    this.data = data ?? new Uint8ClampedArray(expected);
  }

  /** @returns {ImageBuffer} copia independiente */
  clone() {
    return new ImageBuffer(this.width, this.height, new Uint8ClampedArray(this.data));
  }

  /** Número de píxeles. */
  get pixelCount() {
    return this.width * this.height;
  }
}
