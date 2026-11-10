/* Scent quiz and discovery set builder */
(() => {
  const addToCart = async (items) => {
    const sections = window.CartAPI ? window.CartAPI.sectionsToRender() : [];
    const response = await fetch(`${window.routes.cart_add_url}.js`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items, sections, sections_url: window.location.pathname })
    });
    const state = await response.json();
    if (state.status) throw new Error(state.description || state.message);
    window.CartAPI?.applySections(state.sections);
    document.dispatchEvent(new CustomEvent('cart:updated', { detail: state }));
    if (window.cartType === 'drawer') document.querySelector('cart-drawer')?.open();
    return state;
  };

  /* ---------- Find your scent quiz ---------- */
  if (!customElements.get('scent-quiz')) {
    class ScentQuiz extends HTMLElement {
      connectedCallback() {
        try {
          this.products = JSON.parse(this.querySelector('[data-quiz-products]').textContent).filter((p) => p.available);
        } catch (e) {
          this.products = [];
        }
        this.steps = Array.from(this.querySelectorAll('[data-step]'));
        this.index = 0;
        this.addEventListener('change', (e) => {
          if (e.target.type !== 'radio') return;
          const step = e.target.closest('[data-step]');
          step.querySelectorAll('[data-quiz-next], [data-quiz-finish]').forEach((b) => (b.disabled = false));
        });
        this.addEventListener('click', (e) => {
          if (e.target.closest('[data-quiz-next]')) this.go(this.index + 1);
          else if (e.target.closest('[data-quiz-back]')) this.go(this.index - 1);
          else if (e.target.closest('[data-quiz-finish]')) this.finish();
          else if (e.target.closest('[data-quiz-restart]')) this.restart();
          else if (e.target.closest('[data-r-add]')) this.add(e.target.closest('[data-r-add]'));
        });
      }

      go(i) {
        this.index = Math.max(0, Math.min(this.steps.length - 1, i));
        this.steps.forEach((s, k) => {
          s.hidden = k !== this.index;
          s.classList.toggle('is-active', k === this.index);
        });
        this.steps[this.index].querySelector('[tabindex="-1"]')?.focus({ preventScroll: true });
      }

      value(name) {
        return this.querySelector(`input[name^="${name}"]:checked`)?.value;
      }

      finish() {
        const family = this.value('sq-family');
        const occasion = this.value('sq-occasion');
        const strength = this.value('sq-strength');
        let target = { light: 1.8, balanced: 3, bold: 4.4 }[strength] || 3;
        if (occasion === 'day') target -= 0.5;
        if (occasion === 'evening') target += 0.5;

        const scored = this.products.map((p, order) => {
          let score = 0;
          if (p.family && family && p.family.toLowerCase() === family.toLowerCase()) score += 4;
          score += Math.max(0, 3 - Math.abs((p.intensity || 3) - target) * 1.2);
          return { p, score, order };
        });
        scored.sort((a, b) => b.score - a.score || a.order - b.order);
        const best = scored.slice(0, parseInt(this.dataset.resultCount, 10) || 3);
        const top = best[0]?.score || 1;
        this.render(best.map(({ p, score }) => ({ ...p, match: Math.round(Math.min(98, 60 + (score / Math.max(top, 1)) * 38)) })));
        this.go(this.steps.length - 1);
      }

      render(list) {
        const tpl = this.querySelector('[data-result-template]');
        const ul = this.querySelector('[data-quiz-results]');
        ul.innerHTML = '';
        list.forEach((p) => {
          const li = tpl.content.firstElementChild.cloneNode(true);
          li.querySelectorAll('[data-r-link]').forEach((a) => (a.href = p.url));
          li.querySelector('[data-r-title]').textContent = p.title;
          const img = li.querySelector('[data-r-img]');
          if (p.image) img.src = p.image;
          else img.remove();
          li.querySelector('[data-r-notes]').textContent = p.notes || '';
          li.querySelector('[data-r-price]').textContent = p.price;
          li.querySelector('[data-r-match]').textContent = (this.dataset.matchTemplate || '[percent]% match').replace('[percent]', p.match);
          const add = li.querySelector('[data-r-add]');
          const options = li.querySelector('[data-r-options]');
          if (p.single) {
            add.dataset.variant = p.variant;
            add.dataset.name = p.title;
            options.remove();
          } else {
            add.remove();
            options.href = p.url;
            if (document.getElementById('QuickView')) {
              options.dataset.quickView = p.url;
              options.setAttribute('aria-haspopup', 'dialog');
            }
          }
          ul.appendChild(li);
        });
      }

      async add(button) {
        button.setAttribute('aria-busy', 'true');
        try {
          await addToCart([{ id: Number(button.dataset.variant), quantity: 1 }]);
          window.Theme?.announce(window.themeStrings.addedToCart);
        } catch (error) {
          window.Theme?.announce(error.message || window.themeStrings.cartError);
        } finally {
          button.removeAttribute('aria-busy');
        }
      }

      restart() {
        this.querySelectorAll('input[type="radio"]').forEach((r) => (r.checked = false));
        this.querySelectorAll('[data-quiz-next], [data-quiz-finish]').forEach((b, k) => {
          if (k > 0) b.disabled = true;
        });
        this.go(1);
      }
    }
    customElements.define('scent-quiz', ScentQuiz);
  }

  /* ---------- Discovery set builder ---------- */
  if (!customElements.get('discovery-set')) {
    class DiscoverySet extends HTMLElement {
      connectedCallback() {
        this.size = parseInt(this.dataset.size, 10) || 3;
        this.inputs = Array.from(this.querySelectorAll('.ds__card input'));
        this.button = this.querySelector('[data-ds-add]');
        this.status = this.querySelector('[data-ds-status]');
        this.total = this.querySelector('[data-ds-total]');
        this.slots = Array.from(this.querySelectorAll('.ds__slot'));
        this.error = this.querySelector('[data-ds-error]');
        this.money = new Intl.NumberFormat(document.documentElement.lang || undefined, {
          style: 'currency',
          currency: window.Shopify?.currency?.active || 'USD'
        });
        this.addEventListener('change', (e) => {
          if (!e.target.matches('.ds__card input')) return;
          if (this.selected().length > this.size) e.target.checked = false;
          this.update();
        });
        this.button.addEventListener('click', () => this.add());
        this.update();
      }

      selected() {
        return this.inputs.filter((i) => i.checked);
      }

      update() {
        const chosen = this.selected();
        const full = chosen.length >= this.size;
        this.inputs.forEach((i) => {
          if (!i.checked) i.closest('.ds__card').classList.toggle('is-locked', full);
        });
        this.slots.forEach((slot, k) => {
          const pick = chosen[k];
          slot.style.backgroundImage = pick && pick.dataset.image ? `url(${pick.dataset.image})` : '';
          slot.classList.toggle('is-filled', !!pick);
        });
        this.status.textContent = this.status.dataset.template.replace('[chosen]', chosen.length);
        const cents = chosen.reduce((sum, i) => sum + Number(i.dataset.price || 0), 0);
        this.total.textContent = chosen.length ? this.money.format(cents / 100) : '';
        this.button.disabled = !full;
      }

      async add() {
        const chosen = this.selected();
        if (chosen.length !== this.size) return;
        this.button.setAttribute('aria-busy', 'true');
        this.error.hidden = true;
        const setId = Date.now().toString(36).toUpperCase();
        const property = this.dataset.property || 'Discovery set';
        try {
          await addToCart(chosen.map((i) => ({ id: Number(i.value), quantity: 1, properties: { [property]: setId } })));
          chosen.forEach((i) => (i.checked = false));
          this.update();
          window.Theme?.announce(window.themeStrings.addedToCart);
        } catch (error) {
          this.error.textContent = error.message || window.themeStrings.cartError;
          this.error.hidden = false;
        } finally {
          this.button.removeAttribute('aria-busy');
        }
      }
    }
    customElements.define('discovery-set', DiscoverySet);
  }
})();
