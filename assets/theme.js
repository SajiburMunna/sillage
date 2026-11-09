/* ==========================================================================
   Sillage — global scripts (no dependencies)
   ========================================================================== */

/* ---------- Utilities ---------- */

const Theme = {
  debounce(fn, wait = 300) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  },

  fetchConfig(type = 'json') {
    return {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: `application/${type}` }
    };
  },

  announce(message) {
    const region = document.getElementById('a11y-status');
    if (!region) return;
    region.textContent = '';
    setTimeout(() => (region.textContent = message), 50);
  },

  focusable(container) {
    return Array.from(
      container.querySelectorAll(
        'summary, a[href], button:enabled, [tabindex]:not([tabindex^="-"]), [draggable], area, input:not([type=hidden]):enabled, select:enabled, textarea:enabled, object, iframe'
      )
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
  },

  trapFocus(container, elementToFocus = container) {
    Theme.removeTrapFocus();
    const handler = (event) => {
      if (event.key !== 'Tab') return;
      const elements = Theme.focusable(container);
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    Theme._trap = handler;
    document.addEventListener('keydown', handler);
    elementToFocus?.focus({ preventScroll: true });
  },

  removeTrapFocus(elementToFocus = null) {
    if (Theme._trap) document.removeEventListener('keydown', Theme._trap);
    Theme._trap = null;
    elementToFocus?.focus({ preventScroll: true });
  },

  parseHTML(text) {
    return new DOMParser().parseFromString(text, 'text/html');
  },

  /** Replace the inner HTML of `selector` in the document with the same element from `html`. */
  swap(html, selector, root = document) {
    const source = html.querySelector(selector);
    const target = root.querySelector(selector);
    if (source && target) target.innerHTML = source.innerHTML;
  }
};

window.Theme = Theme;

/* ---------- Header: scroll state, disclosure menus ---------- */

class StickyHeader extends HTMLElement {
  connectedCallback() {
    this.mode = this.dataset.stickyMode || 'reveal';
    this.lastY = window.scrollY;
    this.queued = false;
    this.onScroll = () => {
      if (this.queued) return;
      this.queued = true;
      requestAnimationFrame(() => {
        this.queued = false;
        this.update();
      });
    };
    window.addEventListener('scroll', this.onScroll, { passive: true });
    this.addEventListener('focusin', () => this.show());

    // Height of the announcement bar, used to stack the sticky header below it
    const bar = document.querySelector('.section-announcement');
    const setBar = () => document.documentElement.style.setProperty('--ann-h', (bar ? bar.offsetHeight : 0) + 'px');
    setBar();
    if (bar) new ResizeObserver(setBar).observe(bar);
    this.update();
  }

  disconnectedCallback() {
    window.removeEventListener('scroll', this.onScroll);
  }

  update() {
    const y = Math.max(0, window.scrollY);
    this.classList.toggle('is-scrolled', y > 8);
    document.documentElement.classList.toggle('page-scrolled', y > 8);
    if (this.mode !== 'reveal') return;

    const delta = y - this.lastY;
    const busy =
      this.contains(document.activeElement) ||
      this.querySelector('details[open]') ||
      document.body.classList.contains('overflow-hidden');

    if (y < 160 || busy) {
      this.show();
      this.lastY = y;
    } else if (delta > 8) {
      this.hide();
      this.lastY = y;
    } else if (delta < -8) {
      this.show();
      this.lastY = y;
    }
  }

  hide() {
    if (!this.classList.contains('is-hidden')) this.classList.add('is-hidden');
  }

  show() {
    if (this.classList.contains('is-hidden')) this.classList.remove('is-hidden');
  }
}
customElements.define('sticky-header', StickyHeader);

class DetailsDisclosure extends HTMLElement {
  connectedCallback() {
    this.details = this.querySelector('details');
    this.summary = this.querySelector('summary');
    this.summary.setAttribute('aria-expanded', this.details.open);
    this.details.addEventListener('toggle', () => this.summary.setAttribute('aria-expanded', this.details.open));
    this.addEventListener('focusout', (event) => {
      if (!this.contains(event.relatedTarget)) this.details.open = false;
    });
    this.addEventListener('keyup', (event) => {
      if (event.key === 'Escape' && this.details.open) {
        this.details.open = false;
        this.summary.focus();
      }
    });
    if (this.dataset.hover === 'true') {
      this.addEventListener('mouseenter', () => (this.details.open = true));
      this.addEventListener('mouseleave', () => (this.details.open = false));
    }
  }
}
customElements.define('details-disclosure', DetailsDisclosure);

/* ---------- Drawers (menu, cart, filters) ---------- */

class DrawerComponent extends HTMLElement {
  connectedCallback() {
    this.addEventListener('keyup', (event) => event.key === 'Escape' && this.close());
    this.addEventListener('click', (event) => {
      if (event.target.closest('[data-drawer-close]')) this.close();
    });
  }

  open(opener) {
    if (opener) this.opener = opener;
    this.setAttribute('open', '');
    this.opener?.setAttribute('aria-expanded', 'true');
    document.body.classList.add('overflow-hidden');
    const panel = this.querySelector('.drawer__panel');
    requestAnimationFrame(() => Theme.trapFocus(panel, panel.querySelector('[data-drawer-focus]') || panel));
  }

  close() {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.opener?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('overflow-hidden');
    Theme.removeTrapFocus(this.opener);
  }
}
customElements.define('drawer-component', DrawerComponent);

// Delegated openers: any element with data-open-drawer + aria-controls="<drawer id>"
document.addEventListener('click', (event) => {
  const opener = event.target.closest('[data-open-drawer]');
  if (!opener) return;
  const target = document.getElementById(opener.getAttribute('aria-controls'));
  if (target && typeof target.open === 'function') {
    event.preventDefault();
    target.open(opener);
  }
});

/* ---------- Search modal & predictive search ---------- */

class SearchModal extends HTMLElement {
  connectedCallback() {
    this.input = this.querySelector('input[type="search"]');
    this.querySelectorAll('[data-search-close]').forEach((el) => el.addEventListener('click', () => this.close()));
    this.addEventListener('click', (event) => event.target === this && this.close());
    this.addEventListener('keyup', (event) => event.key === 'Escape' && this.close());
  }
  open(opener) {
    this.opener = opener;
    this.setAttribute('open', '');
    document.body.classList.add('overflow-hidden');
    Theme.trapFocus(this, this.input);
  }
  close() {
    this.removeAttribute('open');
    document.body.classList.remove('overflow-hidden');
    Theme.removeTrapFocus(this.opener);
  }
}
customElements.define('search-modal', SearchModal);

class PredictiveSearch extends HTMLElement {
  connectedCallback() {
    this.input = this.querySelector('input[type="search"]');
    this.results = this.querySelector('[data-predictive-results]');
    this.cache = new Map();
    this.input.addEventListener('input', Theme.debounce(() => this.onChange(), 300));
    this.input.addEventListener('keydown', (event) => this.onKeydown(event));
  }

  onChange() {
    const term = this.input.value.trim();
    if (!term.length) {
      this.close();
      return;
    }
    this.fetchResults(term);
  }

  async fetchResults(term) {
    if (this.cache.has(term)) {
      this.render(this.cache.get(term));
      return;
    }
    this.controller?.abort();
    this.controller = new AbortController();
    try {
      const url = `${window.routes.predictive_search_url}?q=${encodeURIComponent(term)}&section_id=predictive-search&resources[limit]=4&resources[limit_scope]=each`;
      const response = await fetch(url, { signal: this.controller.signal });
      if (!response.ok) throw new Error(response.status);
      const html = Theme.parseHTML(await response.text()).querySelector('#shopify-section-predictive-search')?.innerHTML || '';
      this.cache.set(term, html);
      this.render(html);
    } catch (error) {
      if (error.name !== 'AbortError') this.close();
    }
  }

  render(html) {
    this.results.innerHTML = html;
    this.results.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
    const status = this.results.querySelector('[data-predictive-status]');
    if (status) Theme.announce(status.textContent.trim());
  }

  close() {
    this.results.hidden = true;
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
  }

  onKeydown(event) {
    if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return;
    const options = Array.from(this.results.querySelectorAll('[role="option"]'));
    if (!options.length) return;
    const current = this.results.querySelector('[aria-selected="true"]');
    if (event.key === 'Enter') {
      const link = current?.querySelector('a') || (current?.tagName === 'A' ? current : null);
      if (link) {
        event.preventDefault();
        link.click();
      }
      return;
    }
    event.preventDefault();
    let index = options.indexOf(current);
    index = event.key === 'ArrowDown' ? (index + 1) % options.length : (index - 1 + options.length) % options.length;
    current?.setAttribute('aria-selected', 'false');
    options[index].setAttribute('aria-selected', 'true');
    this.input.setAttribute('aria-activedescendant', options[index].id);
    options[index].scrollIntoView({ block: 'nearest' });
  }
}
customElements.define('predictive-search', PredictiveSearch);

/* ---------- Quantity input ---------- */

class QuantityInput extends HTMLElement {
  connectedCallback() {
    this.input = this.querySelector('input');
    this.querySelectorAll('button').forEach((button) =>
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const previous = this.input.value;
        button.name === 'plus' ? this.input.stepUp() : this.input.stepDown();
        if (previous !== this.input.value) this.input.dispatchEvent(new Event('change', { bubbles: true }));
      })
    );
  }
}
customElements.define('quantity-input', QuantityInput);

/* ---------- Cart (drawer + page) ---------- */

const CartAPI = {
  sectionsToRender() {
    const ids = ['cart-icon-bubble'];
    if (document.querySelector('cart-drawer')) ids.push('cart-drawer');
    if (document.getElementById('main-cart')) ids.push(document.getElementById('main-cart').dataset.sectionId);
    return ids;
  },

  applySections(sections) {
    if (!sections) return;
    Object.entries(sections).forEach(([id, html]) => {
      if (!html) return;
      const doc = Theme.parseHTML(html);
      if (id === 'cart-icon-bubble') {
        Theme.swap(doc, '#cart-icon-bubble');
      } else if (id === 'cart-drawer') {
        Theme.swap(doc, '#CartDrawer-Inner');
      } else {
        Theme.swap(doc, `#main-cart`);
      }
    });
  }
};
window.CartAPI = CartAPI;

class CartItems extends HTMLElement {
  connectedCallback() {
    this.addEventListener(
      'change',
      Theme.debounce((event) => {
        if (event.target.matches('[data-line-quantity]')) {
          this.update(event.target.dataset.line, event.target.value, event.target);
        }
      }, 350)
    );
    this.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-line-remove]');
      if (remove) {
        event.preventDefault();
        this.update(remove.dataset.line, 0);
      }
    });
  }

  async update(line, quantity, input) {
    this.classList.add('is-loading');
    this.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(window.routes.cart_change_url, {
        ...Theme.fetchConfig(),
        body: JSON.stringify({ line, quantity, sections: CartAPI.sectionsToRender(), sections_url: window.location.pathname })
      });
      const state = await response.json();
      if (state.errors || state.status) {
        this.showError(state.description || state.errors || window.themeStrings.cartError);
        if (input) input.value = input.dataset.previous || input.value;
        return;
      }
      CartAPI.applySections(state.sections);
      Theme.announce(window.themeStrings.addedToCart);
      document.dispatchEvent(new CustomEvent('cart:updated', { detail: state }));
    } catch (error) {
      this.showError(window.themeStrings.cartError);
    } finally {
      this.classList.remove('is-loading');
      this.removeAttribute('aria-busy');
    }
  }

  showError(message) {
    const errors = this.closest('[data-cart-root]')?.querySelector('[data-cart-errors]') || document.querySelector('[data-cart-errors]');
    if (errors) {
      errors.textContent = message;
      errors.hidden = false;
    }
    Theme.announce(message);
  }
}
customElements.define('cart-items', CartItems);

class CartDrawer extends DrawerComponent {}
customElements.define('cart-drawer', CartDrawer);

class CartNote extends HTMLElement {
  connectedCallback() {
    this.querySelector('textarea')?.addEventListener(
      'input',
      Theme.debounce((event) => {
        fetch(window.routes.cart_update_url, { ...Theme.fetchConfig(), body: JSON.stringify({ note: event.target.value }) });
      }, 400)
    );
  }
}
customElements.define('cart-note', CartNote);

/* ---------- Product form ---------- */

class ProductForm extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('form');
    this.form.querySelector('[name="id"]')?.removeAttribute('disabled');
    this.submitButton = this.querySelector('[type="submit"]');
    this.errorWrapper = this.querySelector('[data-product-form-error]');
    if (window.cartType === 'drawer' && document.querySelector('cart-drawer')) {
      this.form.addEventListener('submit', (event) => this.onSubmit(event));
    }
  }

  async onSubmit(event) {
    event.preventDefault();
    if (this.submitButton.getAttribute('aria-disabled') === 'true') return;
    this.setError();
    this.submitButton.setAttribute('aria-busy', 'true');
    this.submitButton.setAttribute('aria-disabled', 'true');

    const formData = new FormData(this.form);
    formData.append('sections', CartAPI.sectionsToRender().join(','));
    formData.append('sections_url', window.location.pathname);

    try {
      const response = await fetch(window.routes.cart_add_url, {
        method: 'POST',
        headers: { Accept: 'application/javascript', 'X-Requested-With': 'XMLHttpRequest' },
        body: formData
      });
      const state = await response.json();
      if (state.status) {
        this.setError(state.description || state.message);
        return;
      }
      CartAPI.applySections(state.sections);
      Theme.announce(window.themeStrings.addedToCart);
      document.dispatchEvent(new CustomEvent('cart:updated', { detail: state }));
      const quickAdd = this.closest('drawer-component');
      if (quickAdd && quickAdd.tagName !== 'CART-DRAWER') quickAdd.close();
      document.querySelector('cart-drawer')?.open(this.submitButton);
    } catch (error) {
      this.setError(window.themeStrings.cartError);
    } finally {
      this.submitButton.removeAttribute('aria-busy');
      if (!this.submitButton.hasAttribute('data-sold-out')) this.submitButton.removeAttribute('aria-disabled');
    }
  }

  setError(message = false) {
    if (!this.errorWrapper) return;
    this.errorWrapper.hidden = !message;
    this.errorWrapper.textContent = message || '';
    if (message) Theme.announce(message);
  }
}
customElements.define('product-form', ProductForm);

/* ---------- Variant picker (option value section rendering) ---------- */

class VariantPicker extends HTMLElement {
  connectedCallback() {
    this.addEventListener('change', (event) => this.onChange(event));
  }

  selectedOptionValues() {
    return Array.from(this.querySelectorAll('select option:checked, input:checked'))
      .map((el) => el.dataset.optionValueId)
      .filter(Boolean);
  }

  async onChange(event) {
    const target = event.target.tagName === 'SELECT' ? event.target.selectedOptions[0] : event.target;
    const productUrl = target?.dataset.productUrl || this.dataset.url;
    const sectionId = this.dataset.section;
    const params = new URLSearchParams({ section_id: this.dataset.originalSection || sectionId, option_values: this.selectedOptionValues().join(',') });
    const root = this.closest('[data-product-root]');
    root?.setAttribute('aria-busy', 'true');

    try {
      const response = await fetch(`${productUrl}?${params}`);
      const html = Theme.parseHTML(await response.text());
      const variantJson = html.querySelector('[data-selected-variant]')?.textContent;
      const variant = variantJson ? JSON.parse(variantJson) : null;

      // Different product (combined listing) — swap the whole section.
      if (productUrl !== this.dataset.url) {
        const section = html.querySelector('[data-product-root]');
        if (section && root) root.replaceWith(section);
        window.history.replaceState({}, '', productUrl + (variant ? `?variant=${variant.id}` : ''));
        return;
      }

      root?.querySelectorAll('[data-product-update]').forEach((el) => {
        const key = el.dataset.productUpdate;
        const source = html.querySelector(`[data-product-update="${key}"]`);
        if (!source) return;
        if (key === 'picker') {
          // Keep focus position while refreshing availability states
          const focusedId = document.activeElement?.id;
          el.innerHTML = source.innerHTML;
          if (focusedId) document.getElementById(focusedId)?.focus();
        } else {
          el.innerHTML = source.innerHTML;
        }
      });

      if (variant) {
        root?.querySelectorAll('input[name="id"]').forEach((input) => {
          input.value = variant.id;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        if (this.dataset.updateUrl !== 'false') {
          window.history.replaceState({}, '', `${productUrl}?variant=${variant.id}`);
        }
        if (variant.featured_media) {
          root?.querySelector('media-gallery')?.setActive(String(variant.featured_media.id));
        }
      }
      document.dispatchEvent(new CustomEvent('variant:change', { detail: { variant, sectionId } }));
    } finally {
      root?.removeAttribute('aria-busy');
    }
  }
}
customElements.define('variant-picker', VariantPicker);

/* ---------- Media gallery ---------- */

class MediaGallery extends HTMLElement {
  connectedCallback() {
    this.viewer = this.querySelector('[data-gallery-viewer]');
    this.thumbs = this.querySelectorAll('[data-gallery-thumb]');
    this.thumbs.forEach((thumb) =>
      thumb.addEventListener('click', () => {
        this.setActive(thumb.dataset.mediaId, true);
      })
    );
  }

  setActive(mediaId, fromThumb = false) {
    const item = this.viewer?.querySelector(`[data-media-id="${mediaId}"]`);
    if (!item) return;
    this.viewer.querySelectorAll('[data-media-id]').forEach((el) => el.classList.remove('is-active'));
    item.classList.add('is-active');
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    if (this.viewer.scrollWidth > this.viewer.clientWidth) {
      this.viewer.scrollTo({ left: item.offsetLeft - this.viewer.offsetLeft, behavior });
    } else if (!fromThumb) {
      // Desktop stacked layout: bring the variant image to the top of the list
      this.viewer.prepend(item);
    } else {
      item.scrollIntoView({ behavior, block: 'nearest' });
    }
    this.thumbs.forEach((thumb) => thumb.setAttribute('aria-current', String(thumb.dataset.mediaId === mediaId)));
  }
}
customElements.define('media-gallery', MediaGallery);

/* ---------- Deferred media (videos, 3D models) ---------- */

class DeferredMedia extends HTMLElement {
  connectedCallback() {
    this.querySelector('[data-deferred-poster]')?.addEventListener('click', () => this.load(true));
  }
  load(focus) {
    if (this.hasAttribute('loaded')) return;
    const template = this.querySelector('template');
    if (!template) return;
    const content = template.content.firstElementChild.cloneNode(true);
    this.setAttribute('loaded', '');
    this.appendChild(content);
    if (content.tagName === 'VIDEO') content.play?.();
    if (focus) content.focus?.();
    if (content.tagName === 'MODEL-VIEWER' || content.querySelector?.('model-viewer')) {
      window.Shopify?.loadFeatures?.([{ name: 'model-viewer-ui', version: '1.0', onLoad: () => {} }]);
    }
  }
}
customElements.define('deferred-media', DeferredMedia);

/* ---------- Pickup availability ---------- */

class PickupAvailability extends HTMLElement {
  connectedCallback() {
    if (this.dataset.variantId) this.fetch(this.dataset.variantId);
    this.onVariant = (event) => {
      if (!event.detail.variant) {
        this.innerHTML = '';
        return;
      }
      this.fetch(event.detail.variant.id);
    };
    document.addEventListener('variant:change', this.onVariant);
  }
  disconnectedCallback() {
    document.removeEventListener('variant:change', this.onVariant);
  }
  async fetch(variantId) {
    try {
      const response = await fetch(`${this.dataset.rootUrl}variants/${variantId}/?section_id=pickup-availability`);
      const html = Theme.parseHTML(await response.text());
      const content = html.querySelector('[data-pickup-availability]');
      this.innerHTML = content ? content.outerHTML : '';
      const drawer = this.querySelector('drawer-component');
      this.querySelector('[data-pickup-open]')?.addEventListener('click', (event) => drawer?.open(event.currentTarget));
    } catch (error) {
      this.innerHTML = '';
    }
  }
}
customElements.define('pickup-availability', PickupAvailability);

/* ---------- Product recommendations ---------- */

class ProductRecommendations extends HTMLElement {
  connectedCallback() {
    const observer = new IntersectionObserver(
      (entries, obs) => {
        if (!entries[0].isIntersecting) return;
        obs.disconnect();
        this.load();
      },
      { rootMargin: '0px 0px 400px 0px' }
    );
    observer.observe(this);
  }
  async load() {
    try {
      const response = await fetch(this.dataset.url);
      const html = Theme.parseHTML(await response.text());
      const content = html.querySelector('product-recommendations');
      if (content && content.innerHTML.trim().length) {
        this.innerHTML = content.innerHTML;
      } else {
        this.closest('.shopify-section')?.classList.add('hidden');
        this.hidden = true;
      }
    } catch (error) {
      this.hidden = true;
    }
  }
}
customElements.define('product-recommendations', ProductRecommendations);

/* ---------- Faceted filtering ---------- */

class FacetForm extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('form');
    this.form.addEventListener('input', Theme.debounce(() => this.submit(), 500));
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.submit();
    });
    this.addEventListener('click', (event) => {
      const link = event.target.closest('[data-facet-remove]');
      if (link) {
        event.preventDefault();
        this.render(new URL(link.href).searchParams.toString());
      }
    });
    window.addEventListener('popstate', () => this.render(window.location.search.slice(1), false));
  }

  submit() {
    const params = new URLSearchParams(new FormData(this.form));
    // Drop empty price inputs so they don't filter
    ['filter.v.price.gte', 'filter.v.price.lte'].forEach((key) => {
      if (params.get(key) === '') params.delete(key);
    });
    this.render(params.toString());
  }

  async render(query, push = true) {
    const sectionId = this.dataset.sectionId;
    const container = document.getElementById('ProductGridContainer');
    container?.classList.add('is-loading');
    container?.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(`${window.location.pathname}?section_id=${sectionId}&${query}`);
      const html = Theme.parseHTML(await response.text());
      ['#ProductGridContainer', '#FacetsActive', '#ProductCount', '#FacetFiltersBody'].forEach((selector) => {
        // Keep the user's in-progress price input focused
        if (selector === '#FacetFiltersBody' && this.contains(document.activeElement) && document.activeElement.type === 'number') return;
        Theme.swap(html, selector);
      });
      if (push) window.history.pushState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
      const count = document.getElementById('ProductCount');
      if (count) Theme.announce(count.textContent.trim());
    } finally {
      container?.classList.remove('is-loading');
      container?.removeAttribute('aria-busy');
    }
  }
}
customElements.define('facet-form', FacetForm);

/* ---------- Localization (country / language) ---------- */

class LocalizationForm extends HTMLElement {
  connectedCallback() {
    this.querySelectorAll('select').forEach((select) =>
      select.addEventListener('change', () => this.querySelector('form').submit())
    );
  }
}
customElements.define('localization-form', LocalizationForm);

/* ---------- Reveal on scroll ---------- */

(() => {
  if (!document.body?.classList.contains('has-reveal')) {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  function init() {
    if (!document.body.classList.contains('has-reveal')) return;
    const items = () => document.querySelectorAll('[data-reveal]:not(.is-revealed)');
    if (!('IntersectionObserver' in window)) {
      items().forEach((el) => el.classList.add('is-revealed'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px' }
    );
    const observeAll = () => items().forEach((el) => observer.observe(el));
    observeAll();
    document.addEventListener('shopify:section:load', observeAll);
    // Content swapped by filters / cart
    new MutationObserver(Theme.debounce(observeAll, 100)).observe(document.body, { childList: true, subtree: true });
  }
})();

/* ---------- Theme editor support ---------- */

document.addEventListener('shopify:section:select', (event) => {
  const drawer = event.target.querySelector('cart-drawer');
  drawer?.open();
});
document.addEventListener('shopify:section:deselect', (event) => {
  event.target.querySelector('cart-drawer')?.close();
});

/* ---------- Header tone: light text over dark sections ---------- */

(() => {
  const update = () => {
    const probe = 40;
    let tone = null;
    document.querySelectorAll('[data-header-tone]').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) tone = el.dataset.headerTone;
    });
    if (tone) document.documentElement.dataset.headerTone = tone;
    else delete document.documentElement.dataset.headerTone;
  };
  let queued = false;
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      update();
    });
  };
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);
  document.addEventListener('header-tone:refresh', queue);
  queue();
  Theme.updateHeaderTone = queue;
})();

/* ---------- Custom cursor (theme setting) ---------- */

(() => {
  const dot = document.querySelector('.cursor-dot');
  if (!dot) return;
  if (window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let x = -100, y = -100, sx = -100, sy = -100, hover = 0, hs = 0, running = false, last = 0;
  const loop = (now) => {
    const dt = Math.min((now - (last || now)) / 1000, 0.05);
    last = now;
    const k = 1 - Math.exp(-dt * 13);
    sx += (x - sx) * k;
    sy += (y - sy) * k;
    hs += (hover - hs) * (1 - Math.exp(-dt * 11));
    dot.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) scale(${((14 + hs * 48) / 64).toFixed(4)})`;
    if (Math.abs(x - sx) > 0.1 || Math.abs(y - sy) > 0.1 || Math.abs(hover - hs) > 0.001) {
      requestAnimationFrame(loop);
    } else {
      running = false;
    }
  };
  window.addEventListener(
    'mousemove',
    (e) => {
      x = e.clientX;
      y = e.clientY;
      if (sx < 0) {
        sx = x;
        sy = y;
      }
      hover = e.target.closest?.('a, button, [role="button"], summary, label, .ss-bottle__item') ? 1 : 0;
      dot.style.opacity = '1';
      if (!running) {
        running = true;
        last = 0;
        requestAnimationFrame(loop);
      }
    },
    { passive: true }
  );
  document.addEventListener('mouseleave', () => (dot.style.opacity = '0'));
})();

/* ---------- Fade in lazy images as they arrive ---------- */

(() => {
  const mark = (img) => img.classList.add('is-loaded');
  const watch = (img) => {
    if (img.complete && img.naturalWidth) mark(img);
    else img.addEventListener('load', () => mark(img), { once: true });
  };
  document.querySelectorAll('img[loading="lazy"]').forEach(watch);
  new MutationObserver((records) => {
    records.forEach((r) =>
      r.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        if (n.matches?.('img[loading="lazy"]')) watch(n);
        n.querySelectorAll?.('img[loading="lazy"]').forEach(watch);
      })
    );
  }).observe(document.body, { childList: true, subtree: true });
})();
