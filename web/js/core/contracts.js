// @ts-check
/**
 * Contratos (interfaces) de la aplicación.
 *
 * JavaScript no tiene `interface`, así que cada contrato es una clase base abstracta:
 * documenta qué debe implementarse y falla con un error claro si falta algo.
 * El resto del código depende SOLO de estos contratos, nunca de implementaciones concretas
 * (cámara, canvas, fetch...). Así la web, los tests o una futura app pueden aportar
 * su propia implementación.
 */

/** @param {string} owner @param {string} member */
function notImplemented(owner, member) {
  return new Error(`${owner}.${member} no está implementado`);
}

/**
 * Un paso de procesado de imagen. Trabaja IN SITU sobre el buffer que recibe
 * (el pipeline ya se encarga de clonar el original una sola vez).
 *
 * @typedef {Record<string, number>} FilterOptions
 */
export class ImageFilter {
  /** Identificador único; coincide con la clave de sus ajustes. @returns {string} */
  get id() {
    throw notImplemented('ImageFilter', 'id');
  }

  /**
   * ¿Cambiaría algo la imagen con estas opciones? Permite saltarse el paso.
   * @param {FilterOptions} _options
   * @returns {boolean}
   */
  isActive(_options) {
    throw notImplemented('ImageFilter', 'isActive');
  }

  /**
   * @param {import('./image-buffer.js').ImageBuffer} _image modificada en el sitio
   * @param {FilterOptions} _options
   * @returns {import('./image-buffer.js').ImageBuffer} normalmente la misma imagen
   */
  apply(_image, _options) {
    throw notImplemented('ImageFilter', 'apply');
  }
}

/**
 * Origen de imágenes (un archivo, la cámara, un fotograma de vídeo...).
 */
export class FrameSource {
  /**
   * Devuelve la imagen actual, reducida (sin ampliar) para que su lado mayor
   * no supere `maxSide` píxeles.
   * @param {number} _maxSide
   * @returns {Promise<import('./image-buffer.js').ImageBuffer>}
   */
  grab(_maxSide) {
    throw notImplemented('FrameSource', 'grab');
  }

  /** Libera recursos (stream de cámara, bitmaps...). */
  dispose() {
    throw notImplemented('FrameSource', 'dispose');
  }
}

/**
 * Convierte una imagen procesada en un archivo descargable.
 */
export class ImageExporter {
  /**
   * @param {import('./image-buffer.js').ImageBuffer} _image
   * @param {{ format: 'png' | 'jpeg', quality?: number }} _options
   * @returns {Promise<Blob>}
   */
  export(_image, _options) {
    throw notImplemented('ImageExporter', 'export');
  }
}

/**
 * Traductor de textos de la interfaz.
 */
export class Translator {
  /** Código de idioma activo, p. ej. `es`. @returns {string} */
  get language() {
    throw notImplemented('Translator', 'language');
  }

  /**
   * @param {string} _key clave con puntos, p. ej. `controls.contrast`
   * @param {Record<string, string | number>} [_params] valores para `{nombre}`
   * @returns {string}
   */
  t(_key, _params) {
    throw notImplemented('Translator', 't');
  }
}
