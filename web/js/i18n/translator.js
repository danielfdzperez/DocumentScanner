// @ts-check
import { Translator } from '../core/contracts.js';

/**
 * @typedef {{ [key: string]: string | Dictionary }} Dictionary
 * @typedef {(language: string) => Promise<Dictionary>} DictionaryLoader
 */

/**
 * Traductor basado en diccionarios JSON anidados (`web/locales/<idioma>.json`).
 * Si falta una clave en el idioma activo se usa la del idioma de reserva
 * y, como último recurso, la propia clave (así un hueco se nota pero no rompe nada).
 */
export class I18n extends Translator {
  /**
   * @param {string} language
   * @param {Dictionary} dictionary
   * @param {Dictionary} [fallbackDictionary]
   */
  constructor(language, dictionary, fallbackDictionary = {}) {
    super();
    this._language = language;
    this.dictionary = dictionary;
    this.fallbackDictionary = fallbackDictionary;
  }

  /**
   * @param {string} language idioma ya resuelto
   * @param {string} fallbackLanguage
   * @param {DictionaryLoader} load
   * @returns {Promise<I18n>}
   */
  static async create(language, fallbackLanguage, load) {
    const dictionary = await load(language);
    const fallback = language === fallbackLanguage ? dictionary : await load(fallbackLanguage);
    return new I18n(language, dictionary, fallback);
  }

  get language() {
    return this._language;
  }

  t(key, params) {
    const raw = lookup(this.dictionary, key) ?? lookup(this.fallbackDictionary, key) ?? key;
    if (!params) return raw;
    return raw.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
  }
}

/**
 * @param {Dictionary} dictionary
 * @param {string} key  p. ej. `controls.contrast`
 * @returns {string | undefined}
 */
function lookup(dictionary, key) {
  /** @type {string | Dictionary | undefined} */
  let node = dictionary;
  for (const part of key.split('.')) {
    if (node === undefined || typeof node === 'string') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}
