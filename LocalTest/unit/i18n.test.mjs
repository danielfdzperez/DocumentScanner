import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { translateDom } from '../../web/js/i18n/dom.js';
import { FALLBACK_LANGUAGE, preferredLanguages, resolveLanguage } from '../../web/js/i18n/language.js';
import { I18n } from '../../web/js/i18n/translator.js';

const localeUrl = (lang) => new URL(`../../web/locales/${lang}.json`, import.meta.url);
const loadLocale = async (lang) => JSON.parse(await readFile(localeUrl(lang), 'utf8'));

test('resolveLanguage detecta el idioma del navegador', () => {
  assert.equal(resolveLanguage(['es-ES', 'en']), 'es');
  assert.equal(resolveLanguage(['es_MX']), 'es');
  assert.equal(resolveLanguage(['EN-us']), 'en');
  assert.equal(resolveLanguage(['fr-FR', 'es']), 'es', 'salta los no soportados');
  assert.equal(resolveLanguage(['fr', 'de']), FALLBACK_LANGUAGE);
  assert.equal(resolveLanguage([]), FALLBACK_LANGUAGE);
});

test('preferredLanguages: ?lang= manda sobre el navegador', () => {
  assert.deepEqual(preferredLanguages({ search: '?lang=en', languages: ['es-ES'] }), ['en', 'es-ES']);
  assert.deepEqual(preferredLanguages({ languages: ['es'] }), ['es']);
  assert.deepEqual(preferredLanguages({ language: 'en-GB' }), ['en-GB']);
  assert.deepEqual(preferredLanguages({}), []);
});

test('I18n: claves anidadas, parámetros y reserva', async () => {
  const i18n = new I18n('es', { a: { b: 'Hola {name}' } }, { a: { b: 'Hello' }, only: 'fallback' });
  assert.equal(i18n.t('a.b', { name: 'Ana' }), 'Hola Ana');
  assert.equal(i18n.t('only'), 'fallback');
  assert.equal(i18n.t('missing.key'), 'missing.key');
  assert.equal(i18n.t('a'), 'a', 'un nodo que no es texto no se devuelve');
  assert.equal(i18n.language, 'es');

  const created = await I18n.create('es', 'en', async (lang) => ({ lang }));
  assert.equal(created.language, 'es');
});

function flatten(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'string' ? [prefix + k] : flatten(v, `${prefix}${k}.`),
  );
}

test('es.json y en.json tienen exactamente las mismas claves y ninguna vacía', async () => {
  const [es, en] = [await loadLocale('es'), await loadLocale('en')];
  assert.deepEqual(flatten(es).sort(), flatten(en).sort());
  for (const dict of [es, en]) {
    for (const key of flatten(dict)) assert.ok(new I18n('x', dict).t(key).trim().length > 0, key);
  }
});

test('el HTML solo usa claves que existen', async () => {
  const html = await readFile(new URL('../../web/index.html', import.meta.url), 'utf8');
  const es = new I18n('es', await loadLocale('es'));
  const keys = [...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]);
  for (const [, spec] of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
    keys.push(...spec.split(';').map((p) => p.split(':')[1].trim()));
  }
  assert.ok(keys.length > 8);
  for (const key of keys) assert.notEqual(es.t(key), key, `falta la clave ${key}`);
});

test('translateDom aplica texto y atributos', () => {
  const makeEl = (attrs) => ({
    attrs: { ...attrs },
    textContent: '',
    getAttribute(n) {
      return this.attrs[n] ?? null;
    },
    setAttribute(n, v) {
      this.attrs[n] = v;
    },
  });
  const a = makeEl({ 'data-i18n': 'k1' });
  const b = makeEl({ 'data-i18n-attr': 'title:k2; aria-label:k1' });
  const root = {
    querySelectorAll: (sel) => (sel === '[data-i18n]' ? [a] : [b]),
  };
  translateDom(root, new I18n('en', { k1: 'One', k2: 'Two' }));
  assert.equal(a.textContent, 'One');
  assert.equal(b.attrs.title, 'Two');
  assert.equal(b.attrs['aria-label'], 'One');
});
