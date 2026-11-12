/* Sillage home page chapters. Loaded by the sections that need it; every
   element is defined once even when several sections include this file. */
(() => {
  const define = (name, element) => {
    if (!customElements.get(name)) customElements.define(name, element);
  };

  /* ---------- Scrolling promises: pause control (WCAG 2.2.2) ---------- */

  class PromiseRibbon extends HTMLElement {
    connectedCallback() {
      this.toggle = this.querySelector('.ribbon__toggle');
      this.toggle?.addEventListener('click', () => {
        const paused = this.classList.toggle('is-paused');
        this.toggle.setAttribute('aria-pressed', String(paused));
        this.toggle.setAttribute('aria-label', paused ? this.toggle.dataset.labelPlay : this.toggle.dataset.labelPause);
      });
    }
  }

  /* ---------- Tabs (WAI-ARIA tabs pattern), shared by collection tabs and press quotes ---------- */

  class TabGroup extends HTMLElement {
    connectedCallback() {
      this.tabs = [...this.querySelectorAll('[data-tab]')];
      this.panels = [...this.querySelectorAll('[data-panel]')];
      if (this.tabs.length < 2) return;
      this.tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => this.select(index));
        tab.addEventListener('keydown', (event) => this.onKey(event, index));
      });
      // Theme editor: selecting a block shows its tab
      this.addEventListener('shopify:block:select', (event) => {
        const index = this.tabs.indexOf(event.target);
        if (index > -1) this.select(index);
      });
    }

    onKey(event, index) {
      const last = this.tabs.length - 1;
      const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: last }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      this.select(next < 0 ? last : next > last ? 0 : next, true);
    }

    select(index, focus = false) {
      this.tabs.forEach((tab, n) => {
        const active = n === index;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
      });
      this.panels.forEach((panel, n) => {
        panel.hidden = n !== index;
        panel.classList.toggle('is-active', n === index);
      });
      if (focus) this.tabs[index].focus();
    }
  }

  class CollectionTabs extends TabGroup {}
  class PressQuotes extends TabGroup {}

  /* ---------- Product spotlight: price and button follow the chosen size ---------- */

  class SpotlightForm extends HTMLElement {
    connectedCallback() {
      this.select = this.querySelector('[data-spotlight-select]');
      this.price = this.querySelector('[data-spotlight-price]');
      this.button = this.querySelector('button[name="add"]');
      this.select?.addEventListener('change', () => this.update());
    }

    update() {
      const option = this.select.selectedOptions[0];
      if (!option) return;
      if (this.price) this.price.textContent = option.dataset.price;
      const available = option.dataset.available === 'true';
      const label = this.button?.querySelector('.button__label');
      if (!this.button || !label) return;
      label.textContent = available ? this.button.dataset.labelAdd : this.button.dataset.labelSold;
      if (available) {
        this.button.removeAttribute('aria-disabled');
        this.button.removeAttribute('data-sold-out');
      } else {
        this.button.setAttribute('aria-disabled', 'true');
        this.button.setAttribute('data-sold-out', '');
      }
    }
  }

  /* ---------- Ritual steps: the sticky image follows the step in view ---------- */

  class RitualSteps extends HTMLElement {
    connectedCallback() {
      this.steps = [...this.querySelectorAll('[data-ritual-step]')];
      this.frames = [...this.querySelectorAll('[data-ritual-frame]')];
      this.counter = this.querySelector('[data-ritual-current]');
      if (!this.steps.length || !('IntersectionObserver' in window)) return;
      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) this.activate(this.steps.indexOf(entry.target));
          });
        },
        { rootMargin: '-45% 0px -45% 0px' }
      );
      this.steps.forEach((step) => this.observer.observe(step));
      this.addEventListener('shopify:block:select', (event) => {
        const index = this.steps.indexOf(event.target);
        if (index > -1) this.activate(index);
      });
    }

    disconnectedCallback() {
      this.observer?.disconnect();
    }

    activate(index) {
      if (index < 0 || index === this.index) return;
      this.index = index;
      this.steps.forEach((step, n) => step.classList.toggle('is-active', n === index));
      this.frames.forEach((frame, n) => frame.classList.toggle('is-active', n === index));
      if (this.counter) this.counter.textContent = String(index + 1).padStart(2, '0');
    }
  }

  define('promise-ribbon', PromiseRibbon);
  define('collection-tabs', CollectionTabs);
  define('press-quotes', PressQuotes);
  define('spotlight-form', SpotlightForm);
  define('ritual-steps', RitualSteps);
})();
