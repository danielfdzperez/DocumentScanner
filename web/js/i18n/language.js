// @ts-check

export const SUPPORTED_LANGUAGES = Object.freeze(['es', 'en']);
export const FALLBACK_LANGUAGE = 'en';

/**
 * Elige el primer idioma preferido que esté soportado.
 * `es-ES`, `es_MX` o `ES` cuentan como `es`. Si ninguno encaja se usa `fallback`.
 *
 * @param {readonly string[]} preferred idiomas en orden de preferencia (p. ej. `navigator.languages`)
 * @param {readonly string[]} [supported]
 * @param {string} [fallback]
 * @returns {string}
 */
export function resolveLanguage(preferred, supported = SUPPORTED_LANGUAGES, fallback = FALLBACK_LANGUAGE) {
  for (const tag of preferred) {
    const base = String(tag).toLowerCase().split(/[-_]/)[0];
    if (supported.includes(base)) return base;
  }
  return fallback;
}

/**
 * Lista de idiomas a considerar: primero `?lang=xx` (útil para probar), luego los del navegador.
 * @param {{ search?: string, languages?: readonly string[], language?: string }} env
 * @returns {string[]}
 */
export function preferredLanguages({ search = '', languages = [], language } = {}) {
  const forced = new URLSearchParams(search).get('lang');
  const fromBrowser = languages.length > 0 ? [...languages] : language ? [language] : [];
  return forced ? [forced, ...fromBrowser] : fromBrowser;
}
