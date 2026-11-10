/* Promo popup, countdown timer, recently viewed products */
(() => {
  const store = {
    get(key) {
      try {
        return JSON.parse(localStorage.getItem(key));
      } catch (e) {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        /* storage unavailable */
      }
    }
  };

  /* ---------- Promo popup ---------- */
  if (!customElements.get('promo-popup')) {
    class PromoPopup extends HTMLElement {
      connectedCallback() {
        this.key = `promo-popup:${this.dataset.id}`;
        this.dialog = this.querySelector('.pp__dialog');
        this.addEventListener('click', (e) => {
          if (e.target.closest('[data-pp-close]')) this.close();
          const copy = e.target.closest('[data-pp-copy]');
          if (copy) this.copy(copy);
        });
        this.addEventListener('keyup', (e) => e.key === 'Escape' && this.close());

        if (window.Shopify?.designMode) {
          document.addEventListener('shopify:section:select', (e) => e.target.contains(this) && this.open());
          document.addEventListener('shopify:section:deselect', (e) => e.target.contains(this) && this.close(false));
          return;
        }
        // Keep the popup open after a newsletter submit so the success message shows
        if (this.querySelector('.form__message')) {
          this.open();
          return;
        }
        const last = store.get(this.key);
        const days = parseInt(this.dataset.days, 10) || 7;
        if (last && Date.now() - last < days * 86400000) return;
        // Never interrupt a shopper who has the bag, menu, search or quick view open: wait until they're done
        const tryOpen = () => {
          if (document.body.classList.contains('overflow-hidden') || document.querySelector('.drawer[open], .search-modal[open]')) {
            setTimeout(tryOpen, 4000);
          } else {
            this.open();
          }
        };
        setTimeout(tryOpen, (parseInt(this.dataset.delay, 10) || 8) * 1000);
      }

      open() {
        this.opener = document.activeElement;
        this.hidden = false;
        requestAnimationFrame(() => this.classList.add('is-open'));
        Theme.trapFocus(this.dialog, this.dialog);
      }

      close(remember = true) {
        if (remember) store.set(this.key, Date.now());
        this.classList.remove('is-open');
        Theme.removeTrapFocus(this.opener);
        setTimeout(() => (this.hidden = true), 400);
      }

      async copy(button) {
        try {
          await navigator.clipboard.writeText(button.dataset.ppCopy);
          const hint = button.querySelector('.pp__code-hint');
          hint.textContent = hint.dataset.copied;
          Theme.announce(hint.dataset.copied);
        } catch (e) {
          /* clipboard blocked: the code stays visible to copy manually */
        }
      }
    }
    customElements.define('promo-popup', PromoPopup);
  }

  /* ---------- Countdown ---------- */
  if (!customElements.get('countdown-timer')) {
    class CountdownTimer extends HTMLElement {
      connectedCallback() {
        this.end = new Date(this.dataset.end).getTime();
        this.values = {};
        this.querySelectorAll('[data-cd]').forEach((el) => (this.values[el.dataset.cd] = el));
        if (Number.isNaN(this.end)) {
          this.finish();
          return;
        }
        this.tick();
        this.timer = setInterval(() => this.tick(), 1000);
      }

      disconnectedCallback() {
        clearInterval(this.timer);
      }

      tick() {
        let left = Math.max(0, this.end - Date.now());
        if (left === 0) {
          this.finish();
          return;
        }
        const parts = { days: 86400000, hours: 3600000, minutes: 60000, seconds: 1000 };
        Object.entries(parts).forEach(([unit, ms]) => {
          const v = Math.floor(left / ms);
          left -= v * ms;
          if (this.values[unit]) this.values[unit].textContent = String(v).padStart(2, '0');
        });
      }

      finish() {
        clearInterval(this.timer);
        this.querySelector('[data-cd-timer]')?.setAttribute('hidden', '');
        this.querySelector('[data-cd-ended]')?.removeAttribute('hidden');
      }
    }
    customElements.define('countdown-timer', CountdownTimer);
  }

  /* ---------- Recently viewed ---------- */
  if (!customElements.get('recently-viewed')) {
    class RecentlyViewed extends HTMLElement {
      async connectedCallback() {
        const limit = parseInt(this.dataset.limit, 10) || 4;
        const handles = (store.get('recently-viewed') || []).filter((h) => h !== this.dataset.current).slice(0, limit);
        if (!handles.length) return;
        const root = (window.routes?.root_url || '/').replace(/\/$/, '');
        const cards = await Promise.all(
          handles.map(async (handle) => {
            try {
              const response = await fetch(`${root}/products/${encodeURIComponent(handle)}?section_id=product-card-render`);
              if (!response.ok) return '';
              const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
              return doc.querySelector('li')?.outerHTML || '';
            } catch (e) {
              return '';
            }
          })
        );
        const html = cards.filter(Boolean).join('');
        if (!html) return;
        this.querySelector('[data-rv-list]').innerHTML = html;
        this.hidden = false;
      }
    }
    customElements.define('recently-viewed', RecentlyViewed);
  }
})();
