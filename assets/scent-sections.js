/* Scent collection stepper + visit section flying bottle */
(() => {
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- <cart-stepper>: Add to bag that turns into − qty + ---------- */
  if (!customElements.get('cart-stepper')) {
    class CartStepper extends HTMLElement {
      connectedCallback() {
        this.qty = parseInt(this.dataset.qty, 10) || 0;
        this.addButton = this.querySelector('[data-stepper-add]');
        this.stepper = this.querySelector('.sc-stepper');
        this.label = this.querySelector('.sc-stepper__qty');
        this.addButton?.addEventListener('click', () => this.set(this.qty + 1, true));
        this.querySelectorAll('[data-stepper]').forEach((b) =>
          b.addEventListener('click', () => this.set(Math.max(0, this.qty + parseInt(b.dataset.stepper, 10))))
        );
      }

      async set(qty, focusStepper = false) {
        this.setAttribute('aria-busy', 'true');
        try {
          const sections = window.CartAPI ? window.CartAPI.sectionsToRender() : [];
          const response = await fetch(`${window.routes.cart_update_url}.js`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ updates: { [this.dataset.variant]: qty }, sections, sections_url: window.location.pathname })
          });
          const state = await response.json();
          if (state.status) throw new Error(state.description);
          const item = (state.items || []).find((i) => String(i.variant_id) === this.dataset.variant);
          this.qty = item ? item.quantity : 0;
          window.CartAPI?.applySections(state.sections);
          document.dispatchEvent(new CustomEvent('cart:updated', { detail: state }));
          this.render(focusStepper);
        } catch (error) {
          window.Theme?.announce(window.themeStrings?.cartError || 'Error');
        } finally {
          this.removeAttribute('aria-busy');
        }
      }

      render(focusStepper) {
        const inBag = this.qty > 0;
        this.addButton.hidden = inBag;
        this.stepper.hidden = !inBag;
        const template = this.label.dataset.stepperLabel || '[count] in bag';
        this.label.textContent = template.replace('[count]', this.qty);
        window.Theme?.announce(this.label.textContent);
        if (inBag && focusStepper) this.stepper.querySelector('[data-stepper="1"]')?.focus();
        if (!inBag) this.addButton.focus();
      }
    }
    customElements.define('cart-stepper', CartStepper);
  }

  /* ---------- <scent-visit>: bottle travels from the slot into the footer ---------- */
  if (!customElements.get('scent-visit')) {
    class ScentVisit extends HTMLElement {
      connectedCallback() {
        this.fly = this.querySelector('[data-fly]');
        this.inner = this.querySelector('[data-fly-inner]');
        this.slotEl = this.querySelector('[data-slot]');
        if (!this.fly || !this.slotEl) return;
        this.p = undefined;
        this.io = new IntersectionObserver((e) => {
          this.visible = e[0].isIntersecting;
          if (this.visible) this.wake();
        }, { rootMargin: '200px 0px 600px 0px' });
        this.io.observe(this);
      }

      disconnectedCallback() {
        this.io?.disconnect();
        cancelAnimationFrame(this.raf);
      }

      wake() {
        if (this.running) return;
        this.running = true;
        this.last = performance.now();
        this.raf = requestAnimationFrame(this.loop);
      }

      loop = (now) => {
        const dt = Math.min((now - this.last) / 1000, 0.05);
        this.last = now;
        this.frame(dt, now / 1000);
        if (this.visible) {
          this.raf = requestAnimationFrame(this.loop);
        } else {
          this.running = false;
        }
      };

      frame(dt, time) {
        const footer = document.querySelector('.footer');
        const o = this.getBoundingClientRect();
        const sl = this.slotEl.getBoundingClientRect();
        const BW = this.fly.offsetWidth || 120;
        const BH = this.fly.offsetHeight || 400;
        const sx = sl.left - o.left + sl.width / 2;
        const sy = sl.top - o.top + sl.height / 2;
        if (!footer) {
          this.fly.style.transform = `translate3d(${sx - BW / 2}px, ${sy - BH / 2}px, 0) rotate(-8deg)`;
          return;
        }

        // Where the bottle lands in the footer
        const fr = footer.getBoundingClientRect();
        const inner = (footer.querySelector('.page-width') || footer).getBoundingClientRect();
        const mark = footer.querySelector('.footer__wordmark')?.getBoundingClientRect();
        const cols = footer.querySelector('.footer__blocks')?.getBoundingClientRect();
        const top = fr.top + 32;
        let ex = null;
        let bottomLimit = fr.bottom - 80;
        if (mark && cols) {
          const sameRow = cols.top < mark.bottom;
          bottomLimit = Math.max(mark.bottom, cols.bottom);
          const endScale = clamp((bottomLimit - top) / BH, 0.6, 1.4);
          const w = BW * endScale;
          if (sameRow && cols.left - mark.right > w + 48) {
            // Between the wordmark and the link columns
            ex = (mark.right + cols.left) / 2;
          } else {
            // In the open space to the right of the wordmark and columns
            const leftEdge = Math.max(mark.right, sameRow ? cols.right : cols.right) + 32;
            if (inner.right - leftEdge > w + 16) ex = (leftEdge + inner.right) / 2;
          }
        }
        const endScale = clamp((bottomLimit - top) / BH, 0.6, 1.4);
        const hide = ex === null;
        const exx = hide ? sx : ex - o.left;
        const ey = bottomLimit - o.top - (BH * endScale) / 2;

        // Progress follows the footer coming into view, with a soft frame-rate independent lag
        const vh = window.innerHeight;
        const target = clamp((vh - fr.top) / Math.max(1, Math.min(fr.height, vh * 0.8)), 0, 1);
        if (this.p === undefined || reduced.matches) this.p = target;
        this.p += (target - this.p) * (1 - Math.exp(-dt * 5));
        if (Math.abs(target - this.p) < 0.0005) this.p = target;
        const e = ease(this.p);
        const x = sx + (exx - sx) * e;
        const y = sy + (ey - sy) * e;
        const rot = -8 * (1 - e);
        const sc = 1 + (endScale - 1) * e;
        this.fly.style.transform = `translate3d(${(x - BW / 2).toFixed(2)}px, ${(y - BH / 2).toFixed(2)}px, 0) rotate(${rot.toFixed(3)}deg) scale(${sc.toFixed(4)})`;
        this.fly.style.opacity = hide && e > 0.5 ? '0' : '1';
        if (this.inner && !reduced.matches) {
          const bob = Math.sin(time * ((Math.PI * 2) / 6)) * 9 * (1 - e);
          this.inner.style.transform = `translate3d(0, ${bob.toFixed(2)}px, 0)`;
        }
      }
    }
    customElements.define('scent-visit', ScentVisit);
  }
})();
