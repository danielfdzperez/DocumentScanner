// @ts-check

/**
 * Traduce los elementos marcados con atributos `data-i18n*` dentro de `root`:
 *
 *  - `data-i18n="clave"`                       -> textContent
 *  - `data-i18n-attr="title:clave;alt:otra"`   -> atributos
 *
 * @param {ParentNode} root
 * @param {import('../core/contracts.js').Translator} translator
 */
export function translateDom(root, translator) {
  for (const el of root.querySelectorAll('[data-i18n]')) {
    el.textContent = translator.t(/** @type {string} */ (el.getAttribute('data-i18n')));
  }
  for (const el of root.querySelectorAll('[data-i18n-attr]')) {
    const spec = /** @type {string} */ (el.getAttribute('data-i18n-attr'));
    for (const pair of spec.split(';')) {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, translator.t(key));
    }
  }
}
