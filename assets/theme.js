/* ==========================================================================
   Sillage — global scripts (no dependencies)
   ========================================================================== */

/* ---------- Utilities ---------- */

const Theme = {
  loadStylesheet(href) {
    const url = new URL(href, window.location.href);
    const existing = [...document.querySelectorAll('link[rel="stylesheet"]')].find((l) => new URL(l.href, window.location.href).pathname === url.pathname);
    if (existing) return Promise.resolve();
    return new Promise((resolve) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url.href;
      link.onload = link.onerror = () => resolve();
      document.head.appendChild(link);
    });
  },

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
    // Lets other sticky UI (like the collection toolbar) sit right under the header
    this.sticky = this.classList.contains('header-wrapper--sticky');
    new ResizeObserver(() => this.publishOffset()).observe(this);
    this.update();
  }

  publishOffset() {
    const visible = this.sticky && !this.classList.contains('is-hidden');
    document.documentElement.style.setProperty('--header-offset', visible ? `${this.offsetHeight}px` : '0px');
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
    this.publishOffset();
  }

  show() {
    if (this.classList.contains('is-hidden')) this.classList.remove('is-hidden');
    this.publishOffset();
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
      const quickAdd = this.closest('drawer-component, quick-view');
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
    // Keep the thumbnail highlight in step with swipes on the main carousel
    this.viewer?.addEventListener(
      'scroll',
      Theme.debounce(() => {
        if (this.viewer.scrollWidth <= this.viewer.clientWidth) return;
        const items = [...this.viewer.querySelectorAll('[data-media-id]')];
        const left = this.viewer.scrollLeft;
        const current = items.reduce((best, el) => (Math.abs(el.offsetLeft - this.viewer.offsetLeft - left) < Math.abs(best.offsetLeft - this.viewer.offsetLeft - left) ? el : best), items[0]);
        if (!current) return;
        this.thumbs.forEach((thumb) => thumb.setAttribute('aria-current', String(thumb.dataset.mediaId === current.dataset.mediaId)));
      }, 80),
      { passive: true }
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

    // Inline sort on the toolbar drives the drawer form
    this.querySelector('[data-sort-proxy]')?.addEventListener('change', (event) => {
      const sort = this.form.elements.sort_by;
      if (sort) sort.value = event.target.value;
      this.submit();
    });

    // Grid density, remembered per device type
    this.layoutKey = window.matchMedia('(min-width: 750px)').matches ? 'grid-cols-desktop' : 'grid-cols-mobile';
    this.layoutButtons = [...this.querySelectorAll('[data-grid-cols]')];
    let saved = null;
    try {
      saved = localStorage.getItem(this.layoutKey);
    } catch (e) {
      /* storage unavailable */
    }
    this.setLayout(saved, false);
    this.layoutButtons.forEach((button) => button.addEventListener('click', () => this.setLayout(button.dataset.gridCols, true)));
  }

  setLayout(cols, save) {
    const root = document.documentElement;
    const desktop = this.layoutKey === 'grid-cols-desktop';
    if (cols) root.style.setProperty(desktop ? '--user-cols' : '--user-cols-mobile', cols);
    const current = cols || getComputedStyle(document.querySelector('#ProductGridContainer .grid') || root).getPropertyValue(desktop ? '--cols' : '--cols-mobile').trim();
    this.layoutButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.gridCols === current)));
    if (save) {
      try {
        localStorage.setItem(this.layoutKey, cols);
      } catch (e) {
        /* storage unavailable */
      }
    }
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
      const proxy = this.querySelector('[data-sort-proxy]');
      const sort = this.form.elements.sort_by;
      if (proxy && sort) proxy.value = sort.value;
      this.updateFilterCount(html);
      const count = document.getElementById('ProductCount');
      if (count) Theme.announce(count.textContent.trim());
    } finally {
      container?.classList.remove('is-loading');
      container?.removeAttribute('aria-busy');
    }
  }
}
FacetForm.prototype.updateFilterCount = function (html) {
  const fresh = html.querySelector('.facets__button');
  const current = this.querySelector('.facets__button');
  if (fresh && current) current.innerHTML = fresh.innerHTML;
};
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
    document.querySelectorAll('body [data-header-tone]').forEach((el) => {
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

/* ---------- Quick view ---------- */

class QuickView extends DrawerComponent {
  connectedCallback() {
    super.connectedCallback();
    this.body = this.querySelector('[data-quick-view-body]');
    this.cache = new Map();
  }

  async show(url, opener) {
    const key = url.split('?')[0];
    this.body.innerHTML = '<div class="quick-view__loading" aria-hidden="true"><span class="loading-spinner"></span></div>';
    this.open(opener);
    try {
      let html = this.cache.get(key);
      if (!html) {
        const response = await fetch(`${key}?section_id=quick-view`);
        if (!response.ok) throw new Error(response.status);
        const doc = Theme.parseHTML(await response.text());
        // The section ships its own stylesheet; pages like collections don't load it.
        // Add it to <head> and wait, so the product never flashes unstyled.
        await Promise.all([...doc.querySelectorAll('link[rel="stylesheet"]')].map((link) => Theme.loadStylesheet(link.href)));
        html = doc.querySelector('.quick-view')?.outerHTML || '';
        this.cache.set(key, html);
      }
      // Ids inside the quick view are unique per section; replace the rendered section wrapper only
      this.body.innerHTML = html;
      this.body.querySelectorAll('img[loading="lazy"]').forEach((img) => img.classList.add('is-loaded'));
      Theme.trapFocus(this.querySelector('.drawer__panel'), this.querySelector('[data-drawer-focus]'));
    } catch (error) {
      window.location.href = url;
    }
  }
}
customElements.define('quick-view', QuickView);

document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-quick-view]');
  if (!trigger || event.metaKey || event.ctrlKey || event.shiftKey) return;
  const modal = document.getElementById('QuickView');
  if (!modal) return;
  event.preventDefault();
  modal.show(trigger.dataset.quickView, trigger);
});

/* ---------- Sticky add to cart ---------- */

class StickyAtc extends HTMLElement {
  connectedCallback() {
    this.form = document.getElementById(this.dataset.form);
    const mainButton = this.form?.querySelector('[type="submit"][name="add"]');
    if (!mainButton) return;
    this.hidden = false;
    // Lets the page reserve room at the bottom so the bar never covers the footer
    this.resizeObserver = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--sticky-atc-height', `${this.offsetHeight}px`);
    });
    this.resizeObserver.observe(this);
    this.observer = new IntersectionObserver(([entry]) => {
      // Show once the main button has scrolled above the viewport
      const past = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      this.classList.toggle('is-visible', past);
      this.setAttribute('aria-hidden', String(!past));
      const button = this.querySelector('button');
      if (button) button.tabIndex = past ? 0 : -1;
    });
    this.observer.observe(mainButton);
    this.onVariant = () => this.sync(mainButton);
    document.addEventListener('variant:change', this.onVariant);
    this.sync(mainButton);
  }

  disconnectedCallback() {
    this.observer?.disconnect();
    this.resizeObserver?.disconnect();
    document.removeEventListener('variant:change', this.onVariant);
  }

  sync(mainButton) {
    const button = this.querySelector('button');
    const root = this.closest('[data-product-root]');
    const price = root?.querySelector('[data-product-update="price"] .price');
    const target = this.querySelector('[data-product-update="sticky-price"]');
    if (price && target) target.innerHTML = price.outerHTML;
    const live = this.form.querySelector('[type="submit"][name="add"]') || mainButton;
    button.textContent = live.querySelector('.button__label')?.textContent.trim() || button.textContent;
    const disabled = live.getAttribute('aria-disabled') === 'true';
    button.toggleAttribute('disabled', disabled);
  }
}
customElements.define('sticky-atc', StickyAtc);

/* ---------- Cart gift options ---------- */

class GiftWrap extends HTMLElement {
  connectedCallback() {
    this.input = this.querySelector('input[type="checkbox"]');
    this.input?.addEventListener('change', () => this.toggle());
  }

  async toggle() {
    this.setAttribute('aria-busy', 'true');
    this.input.disabled = true;
    const sections = CartAPI.sectionsToRender();
    const line = parseInt(this.dataset.line, 10) || 0;
    try {
      const response = this.input.checked
        ? await fetch(`${window.routes.cart_add_url}.js`, {
            ...Theme.fetchConfig(),
            body: JSON.stringify({ items: [{ id: Number(this.dataset.variant), quantity: 1 }], sections, sections_url: window.location.pathname })
          })
        : await fetch(`${window.routes.cart_change_url}.js`, {
            ...Theme.fetchConfig(),
            body: JSON.stringify({ line, quantity: 0, sections, sections_url: window.location.pathname })
          });
      const state = await response.json();
      if (state.status) throw new Error(state.description);
      CartAPI.applySections(state.sections);
      document.dispatchEvent(new CustomEvent('cart:updated', { detail: state }));
    } catch (error) {
      this.input.checked = !this.input.checked;
      Theme.announce(window.themeStrings.cartError);
    } finally {
      this.removeAttribute('aria-busy');
      if (this.input) this.input.disabled = false;
    }
  }
}
customElements.define('gift-wrap', GiftWrap);

class GiftMessage extends HTMLElement {
  connectedCallback() {
    this.querySelector('textarea')?.addEventListener(
      'input',
      Theme.debounce((event) => {
        fetch(`${window.routes.cart_update_url}.js`, {
          ...Theme.fetchConfig(),
          body: JSON.stringify({ attributes: { 'Gift message': event.target.value } })
        });
      }, 500)
    );
  }
}
customElements.define('gift-message', GiftMessage);

/* ---------- Remember viewed products (for the Recently viewed section) ---------- */

(() => {
  const el = document.querySelector('[data-viewed-handle]');
  if (!el) return;
  try {
    const key = 'recently-viewed';
    const list = (JSON.parse(localStorage.getItem(key)) || []).filter((h) => h !== el.dataset.viewedHandle);
    list.unshift(el.dataset.viewedHandle);
    localStorage.setItem(key, JSON.stringify(list.slice(0, 12)));
  } catch (e) {
    /* storage unavailable */
  }
})();

/* ---------- Product media lightbox (full-screen zoom) ---------- */

class MediaLightbox extends HTMLElement {
  connectedCallback() {
    this.dialog = this.querySelector('dialog');
    this.track = this.querySelector('[data-lightbox-track]');
    this.slides = [...this.querySelectorAll('.lightbox__slide')];
    this.counter = this.querySelector('[data-lightbox-counter]');
    this.prev = this.querySelector('[data-lightbox-prev]');
    this.next = this.querySelector('[data-lightbox-next]');
    this.index = 0;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    this.root = this.closest('[data-product-root]') || document;
    this.onRootClick = (event) => {
      const trigger = event.target.closest('[data-lightbox-open]');
      const image = !trigger && event.target.closest('.product__media-item .media > img');
      const id = trigger?.dataset.lightboxOpen || image?.closest('[data-media-id]')?.dataset.mediaId;
      if (!id || !this.slides.some((s) => s.dataset.mediaId === id)) return;
      event.preventDefault();
      this.open(id);
    };
    this.root.addEventListener('click', this.onRootClick);

    this.querySelector('[data-lightbox-close]')?.addEventListener('click', () => this.dialog.close());
    this.prev?.addEventListener('click', () => this.go(this.index - 1));
    this.next?.addEventListener('click', () => this.go(this.index + 1));
    this.dialog.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') this.go(this.index - 1);
      if (event.key === 'ArrowRight') this.go(this.index + 1);
    });
    // Clicking the dimmed backdrop closes the viewer
    this.dialog.addEventListener('click', (event) => {
      if (event.target === this.dialog) this.dialog.close();
    });
    this.dialog.addEventListener('close', () => this.onClose());

    this.track.addEventListener(
      'scroll',
      Theme.debounce(() => {
        const i = Math.round(this.track.scrollLeft / this.track.clientWidth);
        if (i !== this.index) {
          this.resetZoom();
          this.setIndex(i);
        }
      }, 80),
      { passive: true }
    );

    this.querySelectorAll('[data-lightbox-zoom]').forEach((button) => {
      button.addEventListener('click', (event) => this.toggleZoom(button, event));
      button.addEventListener('pointermove', (event) => this.pan(button, event));
    });
  }

  disconnectedCallback() {
    this.root?.removeEventListener('click', this.onRootClick);
  }

  open(mediaId) {
    this.opener = document.activeElement;
    this.dialog.showModal();
    document.body.classList.add('overflow-hidden');
    const i = Math.max(0, this.slides.findIndex((s) => s.dataset.mediaId === mediaId));
    this.go(i, true);
    this.dialog.querySelector('[data-lightbox-close]')?.focus();
  }

  onClose() {
    this.resetZoom();
    document.body.classList.remove('overflow-hidden');
    this.opener?.focus?.({ preventScroll: true });
  }

  go(i, instant = false) {
    const index = Math.min(Math.max(i, 0), this.slides.length - 1);
    this.resetZoom();
    const behavior = instant || this.reduced.matches ? 'instant' : 'smooth';
    this.track.scrollTo({ left: this.slides[index].offsetLeft, behavior });
    this.setIndex(index);
  }

  setIndex(index) {
    this.index = index;
    if (this.counter) this.counter.textContent = `${index + 1} / ${this.slides.length}`;
    if (this.prev) this.prev.disabled = index === 0;
    if (this.next) this.next.disabled = index === this.slides.length - 1;
  }

  toggleZoom(button, event) {
    const zoomed = !button.classList.contains('is-zoomed');
    this.resetZoom();
    if (!zoomed) return;
    this.pan(button, event, true);
    button.classList.add('is-zoomed');
    button.setAttribute('aria-pressed', 'true');
  }

  pan(button, event, force = false) {
    if (!force && !button.classList.contains('is-zoomed')) return;
    const img = button.querySelector('img');
    if (!img) return;
    const rect = button.getBoundingClientRect();
    // Keyboard activation has no pointer position: zoom into the centre
    const x = event.clientX ? ((event.clientX - rect.left) / rect.width) * 100 : 50;
    const y = event.clientY ? ((event.clientY - rect.top) / rect.height) * 100 : 50;
    img.style.transformOrigin = `${x}% ${y}%`;
  }

  resetZoom() {
    this.querySelectorAll('.is-zoomed').forEach((button) => {
      button.classList.remove('is-zoomed');
      button.setAttribute('aria-pressed', 'false');
    });
  }
}
customElements.define('media-lightbox', MediaLightbox);

/* ---------- Share button: native share sheet, falls back to copying the link ---------- */

class ShareButton extends HTMLElement {
  connectedCallback() {
    this.button = this.querySelector('button');
    this.label = this.querySelector('[data-share-label]');
    this.status = this.querySelector('[data-share-status]');
    this.originalLabel = this.label?.textContent;
    this.button?.addEventListener('click', () => this.share());
  }

  async share() {
    const { url, title } = this.dataset;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      const message = this.status?.dataset.success || '';
      if (this.label) this.label.textContent = message;
      if (this.status) this.status.textContent = message;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        if (this.label) this.label.textContent = this.originalLabel;
        if (this.status) this.status.textContent = '';
      }, 2500);
    } catch (error) {
      window.prompt('', url);
    }
  }
}
customElements.define('share-button', ShareButton);

/* ---------- Slideshow (WAI-ARIA carousel pattern) ---------- */

class SlideShow extends HTMLElement {
  connectedCallback() {
    this.slides = [...this.querySelectorAll('[data-slide]')];
    this.dots = [...this.querySelectorAll('[data-slide-to]')];
    this.toggle = this.querySelector('[data-slideshow-toggle]');
    this.index = 0;
    this.speed = Number(this.dataset.speed) || 7000;
    this.style.setProperty('--slideshow-speed', `${this.speed}ms`);
    if (this.slides.length < 2) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Autoplay never starts for people who asked for less motion
    this.userPaused = this.dataset.autoplay !== 'true' || reduced;

    this.querySelector('[data-slide-prev]')?.addEventListener('click', () => this.go(this.index - 1));
    this.querySelector('[data-slide-next]')?.addEventListener('click', () => this.go(this.index + 1));
    this.dots.forEach((dot) => dot.addEventListener('click', () => this.go(Number(dot.dataset.slideTo))));
    this.toggle?.addEventListener('click', () => {
      this.userPaused = !this.userPaused;
      this.sync();
    });

    // Pause while the shopper is reading or using the controls
    this.hovering = false;
    this.focused = false;
    this.addEventListener('mouseenter', () => ((this.hovering = true), this.sync()));
    this.addEventListener('mouseleave', () => ((this.hovering = false), this.sync()));
    this.addEventListener('focusin', () => ((this.focused = true), this.sync()));
    this.addEventListener('focusout', (e) => {
      if (!this.contains(e.relatedTarget)) {
        this.focused = false;
        this.sync();
      }
    });

    this.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') this.go(this.index - 1);
      if (event.key === 'ArrowRight') this.go(this.index + 1);
    });

    // Swipe
    let startX = null;
    const track = this.querySelector('[data-slideshow-track]');
    track.addEventListener('pointerdown', (e) => (startX = e.clientX), { passive: true });
    track.addEventListener(
      'pointerup',
      (e) => {
        if (startX === null) return;
        const dx = e.clientX - startX;
        startX = null;
        if (Math.abs(dx) > 50) this.go(this.index + (dx < 0 ? 1 : -1));
      },
      { passive: true }
    );

    this.visible = true;
    this.observer = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      this.sync();
    });
    this.observer.observe(this);
    this.onVisibility = () => this.sync();
    document.addEventListener('visibilitychange', this.onVisibility);

    // Theme editor: show the selected slide
    this.addEventListener('shopify:block:select', (e) => {
      this.userPaused = true;
      this.go(this.slides.indexOf(e.target));
    });

    this.sync();
  }

  disconnectedCallback() {
    clearTimeout(this.timer);
    this.observer?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  get playing() {
    return !this.userPaused && !this.hovering && !this.focused && this.visible && !document.hidden;
  }

  sync() {
    clearTimeout(this.timer);
    this.classList.toggle('is-playing', this.playing);
    if (this.toggle) {
      this.toggle.setAttribute('aria-label', this.userPaused ? this.toggle.dataset.labelPlay : this.toggle.dataset.labelPause);
    }
    if (this.playing) this.timer = setTimeout(() => this.go(this.index + 1), this.speed);
  }

  go(i) {
    const count = this.slides.length;
    const index = ((i % count) + count) % count;
    this.slides.forEach((slide, n) => {
      const active = n === index;
      slide.classList.toggle('is-active', active);
      slide.toggleAttribute('inert', !active);
    });
    this.dots.forEach((dot, n) => {
      if (n === index) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
    this.index = index;
    // Restart the progress bar animation on the new dot
    this.classList.remove('is-playing');
    void this.offsetWidth;
    this.sync();
  }
}
customElements.define('slide-show', SlideShow);

/* ---------- Delivery estimate: dates in the shopper's own calendar and language ---------- */

class DeliveryEstimate extends HTMLElement {
  connectedCallback() {
    const { min, max, weekends, cutoff, locale, template, templateSingle } = this.dataset;
    const skipWeekends = weekends === 'true';
    const start = new Date();
    if (start.getHours() >= Number(cutoff || 24)) start.setDate(start.getDate() + 1);
    const addDays = (from, days) => {
      const date = new Date(from);
      let left = Number(days) || 0;
      while (left > 0) {
        date.setDate(date.getDate() + 1);
        const day = date.getDay();
        if (!skipWeekends || (day !== 0 && day !== 6)) left -= 1;
      }
      // Never land on a weekend when only business days count
      while (skipWeekends && (date.getDay() === 0 || date.getDay() === 6)) date.setDate(date.getDate() + 1);
      return date;
    };
    let format;
    try {
      format = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' });
    } catch (error) {
      format = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    }
    const first = format.format(addDays(start, min));
    const last = format.format(addDays(start, max));
    const text = first === last ? templateSingle : template;
    const target = this.querySelector('[data-delivery-text]');
    if (!target || !text) return;
    target.textContent = text.replace('{{ start }}', first).replace('{{ end }}', last);
    this.hidden = false;
  }
}
customElements.define('delivery-estimate', DeliveryEstimate);
