// @ts-check

/**
 * Crea un cargador de diccionarios que lee `web/locales/<idioma>.json`.
 * La ruta se calcula respecto a este módulo (no al HTML), por lo que funciona igual
 * en la raíz de un dominio, en `usuario.github.io/DocumentScanner/web/` o en local.
 *
 * @param {URL} [baseUrl]
 * @returns {import('./translator.js').DictionaryLoader}
 */
export function createFetchLoader(baseUrl = new URL('../../locales/', import.meta.url)) {
  return async (language) => {
    const response = await fetch(new URL(`${language}.json`, baseUrl));
    if (!response.ok) throw new Error(`No se pudo cargar el idioma "${language}" (${response.status})`);
    return response.json();
  };
}
