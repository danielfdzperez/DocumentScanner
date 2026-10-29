// @ts-check
import { cloneSettings, getPreset } from '../core/settings.js';

/**
 * Panel de estilos (presets) y sliders. Se construye a partir de la descripción
 * declarativa de `core/settings.js`, de modo que no hay HTML escrito a mano por filtro.
 */
export class ControlsPanel {
  /**
   * @param {object} deps
   * @param {HTMLElement} deps.presetsContainer
   * @param {HTMLElement} deps.slidersContainer
   * @param {import('../core/contracts.js').Translator} deps.translator
   * @param {readonly import('../core/settings.js').ControlSpec[]} deps.controls
   * @param {readonly import('../core/settings.js').Preset[]} deps.presets
   * @param {(settings: import('../core/pipeline.js').PipelineSettings) => void} deps.onChange
   */
  constructor({ presetsContainer, slidersContainer, translator, controls, presets, onChange }) {
    this.presetsContainer = presetsContainer;
    this.slidersContainer = slidersContainer;
    this.translator = translator;
    this.controls = controls;
    this.presets = presets;
    this.onChange = onChange;
    /** @type {Record<string, Record<string, number>>} */
    this.settings = {};
    /** @type {string | null} */
    this.activePresetId = null;
    /** @type {Map<ControlKey, { input: HTMLInputElement, output: HTMLOutputElement }>} */
    this.sliders = new Map();
    /** @type {Map<string, HTMLButtonElement>} */
    this.presetButtons = new Map();
    this.build();
  }

  /** @returns {import('../core/pipeline.js').PipelineSettings} */
  getSettings() {
    return this.settings;
  }

  /** Aplica un preset y avisa del cambio. @param {string} id */
  selectPreset(id) {
    this.settings = cloneSettings(getPreset(id).settings);
    this.activePresetId = id;
    this.syncUi();
    this.onChange(this.settings);
  }

  build() {
    const t = this.translator;

    for (const preset of this.presets) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip';
      button.textContent = t.t(`presets.${preset.id}`);
      button.addEventListener('click', () => this.selectPreset(preset.id));
      this.presetsContainer.append(button);
      this.presetButtons.set(preset.id, button);
    }

    for (const spec of this.controls) {
      const key = controlKey(spec);
      const id = `ctl-${spec.filterId}`;

      const row = document.createElement('div');
      row.className = 'slider';

      const label = document.createElement('label');
      label.htmlFor = id;
      const name = document.createElement('span');
      name.textContent = t.t(`controls.${spec.filterId}`);
      const output = document.createElement('output');
      output.htmlFor = id;
      label.append(name, output);

      const input = document.createElement('input');
      input.type = 'range';
      input.id = id;
      input.min = String(spec.min);
      input.max = String(spec.max);
      input.step = String(spec.step);
      input.addEventListener('input', () => {
        this.settings[spec.filterId] = { ...this.settings[spec.filterId], [spec.option]: Number(input.value) };
        this.activePresetId = null;
        this.syncUi();
        this.onChange(this.settings);
      });

      row.append(label, input);
      this.slidersContainer.append(row);
      this.sliders.set(key, { input, output });
    }
  }

  /** Refleja `settings` y el preset activo en los controles. */
  syncUi() {
    for (const spec of this.controls) {
      const ui = this.sliders.get(controlKey(spec));
      if (!ui) continue;
      const value = this.settings[spec.filterId]?.[spec.option] ?? spec.min;
      ui.input.value = String(value);
      ui.output.textContent = `${value}${spec.unit}`;
      const span = spec.max - spec.min;
      ui.input.style.setProperty('--fill', `${span === 0 ? 0 : ((value - spec.min) / span) * 100}%`);
    }
    for (const [id, button] of this.presetButtons) {
      button.setAttribute('aria-pressed', String(id === this.activePresetId));
    }
  }
}

/** @typedef {string} ControlKey */
/** @param {import('../core/settings.js').ControlSpec} spec @returns {ControlKey} */
function controlKey(spec) {
  return `${spec.filterId}.${spec.option}`;
}
