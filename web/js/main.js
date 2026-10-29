// @ts-check
/**
 * Punto de entrada y "composition root": aquí (y solo aquí) se eligen las
 * implementaciones concretas que se inyectan en el resto de la aplicación.
 */
import { createDefaultPipeline } from './core/pipeline.js';
import { CameraFrameSource } from './infra/camera-frame-source.js';
import { CanvasExporter } from './infra/canvas-exporter.js';
import { FileFrameSource } from './infra/file-frame-source.js';
import { translateDom } from './i18n/dom.js';
import { createFetchLoader } from './i18n/fetch-loader.js';
import { FALLBACK_LANGUAGE, preferredLanguages, resolveLanguage } from './i18n/language.js';
import { I18n } from './i18n/translator.js';
import { App } from './ui/app.js';

async function main() {
  const language = resolveLanguage(
    preferredLanguages({
      search: location.search,
      languages: navigator.languages,
      language: navigator.language,
    }),
  );
  const translator = await I18n.create(language, FALLBACK_LANGUAGE, createFetchLoader());

  document.documentElement.lang = translator.language;
  document.title = translator.t('app.title');
  document.querySelector('meta[name="description"]')?.setAttribute('content', translator.t('app.description'));
  translateDom(document, translator);

  new App({
    document,
    translator,
    pipeline: createDefaultPipeline(),
    exporter: new CanvasExporter(),
    openFile: (file) => FileFrameSource.fromFile(file),
    openCamera: (video) => CameraFrameSource.open(video),
  });
}

main()
  .catch((error) => {
    console.error(error);
    const status = document.getElementById('status');
    if (status) {
      status.dataset.kind = 'error';
      status.textContent = 'Error loading the app / Error al cargar la aplicación.';
    }
  })
  .finally(() => document.documentElement.classList.remove('is-loading'));
