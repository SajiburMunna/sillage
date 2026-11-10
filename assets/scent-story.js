/**
 * <scent-story> — sticky scroll narrative for a fragrance house.
 *
 * Timeline (in viewport heights of scroll):
 *   0      hero        featured scent drops in with two more fanned behind; notes drift up; water flows
 *   1.2    manifesto   words light up as you scroll
 *   2.7    chapters    one per scent; bottle lifts and cross-fades between them
 *   R      ritual      the chosen scent tilts in while the three ritual words light up
 *
 * Smoothness: scroll position is followed with frame-rate independent
 * exponential smoothing; everything moves with transforms only, and the
 * loop sleeps when the section is off-screen.
 */
(() => {
  if (customElements.get('scent-story')) return;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  /**
   * Monotone cubic (Fritsch–Carlson) spline through keyframes.
   * Unlike easing each segment separately, velocity stays continuous across
   * waypoints, so the bottle glides through them instead of stopping at each
   * one, and it never overshoots a position.
   */
  const buildSpline = (K) => {
    const t = K.map((k) => k[0]);
    const channels = [];
    for (let c = 1; c < K[0].length; c++) {
      const y = K.map((k) => k[c]);
      const n = y.length;
      const d = [];
      for (let i = 0; i < n - 1; i++) d.push((y[i + 1] - y[i]) / (t[i + 1] - t[i]));
      const m = new Array(n);
      m[0] = d[0];
      m[n - 1] = d[n - 2];
      for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
      for (let i = 0; i < n - 1; i++) {
        if (d[i] === 0) {
          m[i] = 0;
          m[i + 1] = 0;
          continue;
        }
        const a = m[i] / d[i];
        const b = m[i + 1] / d[i];
        const s = a * a + b * b;
        if (s > 9) {
          const tau = 3 / Math.sqrt(s);
          m[i] = tau * a * d[i];
          m[i + 1] = tau * b * d[i];
        }
      }
      channels.push({ y, m });
    }
    return (time) => {
      const x = clamp(time, t[0], t[t.length - 1]);
      let i = 0;
      while (i < t.length - 2 && x > t[i + 1]) i++;
      const h = t[i + 1] - t[i];
      const s = (x - t[i]) / h;
      const s2 = s * s;
      const s3 = s2 * s;
      const h00 = 2 * s3 - 3 * s2 + 1;
      const h10 = s3 - 2 * s2 + s;
      const h01 = -2 * s3 + 3 * s2;
      const h11 = s3 - s2;
      return channels.map(({ y, m }) => h00 * y[i] + h10 * h * m[i] + h01 * y[i + 1] + h11 * h * m[i + 1]);
    };
  };
  const BOTTLE_AR = 0.3; // every bottle frame is 300 × 1000

  /* ------------------------------------------------------------------ */
  /* The story                                                           */
  /* ------------------------------------------------------------------ */
  class ScentStory extends HTMLElement {
    connectedCallback() {
      this.track = this.querySelector('.ss-track');
      this.stage = this.querySelector('.ss-stage');
      this.bottle = this.querySelector('[data-bottle]');
      this.items = Array.from(this.querySelectorAll('.ss-bottle__item'));
      this.titles = Array.from(this.querySelectorAll('.ss-title'));
      this.chapters = Array.from(this.querySelectorAll('.ss-chapter'));
      this.ritualSide = this.querySelector('.ss-ritual-side');
      this.toast = this.querySelector('.ss-toast');
      this.loader = this.querySelector('.ss-loader');
      this.water = this.querySelector('water-flow');
      this.deck = this.querySelector('.ss-deck');
      this.wearing = this.querySelector('.ss-wearing');
      this.pillToggle = this.querySelector('.ss-pill__toggle');
      this.pillMenu = this.querySelector('.ss-pill__menu');
      this.pillLabel = this.querySelector('[data-pill-label]');
      this.colors = (this.dataset.colors || '').split('|').map((c) => c.trim());
      this.N = Math.max(1, parseInt(this.dataset.chapters, 10) || 1);
      this.ritualIndex = clamp((parseInt(this.dataset.ritual, 10) || 1) - 1, 0, this.items.length - 1);

      this.S = { man: 1.2, ch: 2.7, chLen: 1.6 };
      this.S.ritual = this.S.ch + this.N * this.S.chLen;
      this.S.ritualLen = 2.6;
      this.TOTAL = this.S.ritual + 2.9;

      this.tCur = null;
      this.mx = this.my = this.mxs = this.mys = 0;
      this.state = { idx: null, ch: -1, phase: -1, uncapped: false };
      this.capHolds = 0;
      this.visible = false;

      this.measureLayout();
      this.bind();
      this.startIntro();
    }

    disconnectedCallback() {
      cancelAnimationFrame(this.raf);
      this.io?.disconnect();
      this.ro?.disconnect();
      window.removeEventListener('pointermove', this.onPointer);
      clearTimeout(this.toastTimer);
      this.timers?.forEach(clearTimeout);
    }

    /* ---------- layout ---------- */

    measureLayout() {
      const W = this.clientWidth || window.innerWidth;
      const innerH = document.documentElement.clientHeight || window.innerHeight;
      // Ignore small height changes from mobile browser chrome to avoid jumps
      if (this.vh && Math.abs(innerH - this.vhRaw) < 120 && W === this.W) return;
      this.vhRaw = innerH;
      this.vh = Math.round(clamp(innerH, 560, 980));
      this.W = W;
      this.mobile = W < 750;
      this.style.setProperty('--vh', this.vh + 'px');
      this.track.style.height = Math.round((this.TOTAL + 1) * this.vh) + 'px';

      const H = (this.mobile ? 0.5 : 0.7) * this.vh;
      this.H = H;
      this.BW = H * BOTTLE_AR;
      this.bottle.style.width = this.BW + 'px';
      this.bottle.style.height = H + 'px';

      const R = this.S.ritual;
      // [t, x (× width), x (× vh), y (× vh), rotation, scale]
      this.K = this.mobile
        ? [
            [0, 0.5, 0, 0.36, 8, 0.95],
            [this.S.man, 0.5, 0, 0.66, 18, 0.8],
            [this.S.ch - 0.35, 0.5, 0, 0.44, 10, 0.86],
            [this.S.ch, 0.5, 0, 0.42, 0, 0.9],
            [R, 0.5, 0, 0.42, 0, 0.9],
            [R + 0.4, 0.62, 0, 0.5, 0, 0.82],
            [R + 1.0, 0.7, 0, 0.5, -10, 0.82],
            [R + 2.2, 0.7, 0, 0.5, -10, 0.82],
            [R + 2.6, 0.62, 0, 0.5, 0, 0.85]
          ]
        : [
            [0, 0.74, 0, 0.52, 10, 1.0],
            [this.S.man, 0.52, 0, 0.6, 24, 0.9],
            [this.S.ch - 0.35, 0.5, 0, 0.56, 14, 0.92],
            [this.S.ch, 0.5, 0, 0.56, 0, 1.0],
            [R, 0.5, 0, 0.56, 0, 1.0],
            [R + 0.4, 0.58, 0, 0.52, 0, 0.92],
            [R + 1.0, 0.64, 0, 0.52, -10, 0.92],
            [R + 2.2, 0.64, 0, 0.52, -10, 0.92],
            [R + 2.6, 0.6, 0, 0.56, 0, 0.95]
          ];

      this.path = buildSpline(this.K);

      // Anchor positions for jumps and deep links
      this.querySelectorAll('.ss-anchor').forEach((a) => {
        const key = a.dataset.anchor;
        let t = 0;
        if (key === 'ritual') t = R + 0.05;
        else if (key !== '0') t = this.S.ch + (parseInt(key, 10) - 1) * this.S.chLen + 0.45;
        a.style.top = Math.round(t * this.vh) + 'px';
      });

    }

    /* ---------- events ---------- */

    bind() {
      this.ro = new ResizeObserver(() => this.measureLayout());
      this.ro.observe(this);

      this.io = new IntersectionObserver(
        (entries) => {
          this.visible = entries[0].isIntersecting;
          if (this.visible) this.wake();
          else this.setTone(null);
        },
        { rootMargin: '100px 0px' }
      );
      this.io.observe(this);

      this.onPointer = (e) => {
        this.mx = (e.clientX / window.innerWidth) * 2 - 1;
        this.my = (e.clientY / window.innerHeight) * 2 - 1;
      };
      window.addEventListener('pointermove', this.onPointer, { passive: true });

      this.addEventListener('click', (e) => {
        const add = e.target.closest('[data-add]');
        if (add) {
          this.addToCart(add);
          return;
        }
        const jump = e.target.closest('[data-jump]');
        if (jump) {
          this.togglePill(false);
          this.jump(jump.dataset.jump);
        }
      });

      this.pillToggle?.addEventListener('click', () => this.togglePill(this.pillMenu.hidden));
      this.addEventListener('keyup', (e) => {
        if (e.key === 'Escape' && this.pillMenu && !this.pillMenu.hidden) {
          this.togglePill(false);
          this.pillToggle.focus();
        }
      });

      // Theme editor: selecting a scent block jumps to its chapter
      document.addEventListener('shopify:block:select', (e) => {
        if (!this.contains(e.target)) return;
        const chapter = e.target.dataset.chapter;
        if (chapter) this.jump(chapter, true);
      });
    }

    togglePill(open) {
      if (!this.pillMenu) return;
      this.pillMenu.hidden = !open;
      this.pillToggle.setAttribute('aria-expanded', String(open));
    }

    /* ---------- intro & loader ---------- */

    startIntro() {
      const done = () => {
        this.classList.add('ss-loaded');
        this.lastHeroKey = null;
        setTimeout(() => this.deck?.classList.add('is-settled'), 2300);
      };

      let seen = false;
      try {
        seen = sessionStorage.getItem('ss-intro') === '1';
        sessionStorage.setItem('ss-intro', '1');
      } catch (e) {
        seen = false;
      }

      if (!this.loader || seen || window.Shopify?.designMode || reduced.matches) {
        this.loader?.classList.add('is-done');
        done();
        return;
      }

      const fill = this.loader.querySelector('.ss-loader__fill');
      const pct = this.loader.querySelector('.ss-loader__pct');
      const start = performance.now();
      const duration = 1100;
      const tick = (now) => {
        const p = clamp((now - start) / duration, 0, 1);
        const e = ease(p);
        if (fill) fill.style.transform = `translateY(${(-106 * e).toFixed(1)}px)`;
        if (pct) pct.textContent = Math.round(e * 100);
        if (p < 1) {
          requestAnimationFrame(tick);
        } else {
          setTimeout(() => {
            this.loader.classList.add('is-done');
            done();
          }, 200);
        }
      };
      requestAnimationFrame(tick);
    }

    /* ---------- loop ---------- */

    wake() {
      if (this.running) return;
      this.running = true;
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.loop);
    }

    loop = (now) => {
      const dt = Math.min((now - this.last) / 1000, 0.05);
      this.last = now;

      const rect = this.track.getBoundingClientRect();
      const target = Math.max(0, -rect.top / this.vh);

      // While the page is at the top, the stage starts below the announcement bar:
      // lift bottom-anchored UI and re-centre the bottle so nothing is cut off.
      const inset = Math.max(0, Math.round(rect.top));
      if (inset !== this.inset) {
        this.inset = inset;
        this.stage.style.setProperty('--ss-inset', inset + 'px');
      }
      if (this.tCur === null || Math.abs(target - this.tCur) > 6 || reduced.matches) {
        this.tCur = target;
      } else {
        // Frame-rate independent smoothing (≈ 0.085 per frame at 60 fps)
        this.tCur += (target - this.tCur) * (1 - Math.exp(-dt * 6));
        if (Math.abs(target - this.tCur) < 0.0004) this.tCur = target;
      }

      const k = 1 - Math.exp(-dt * 2.8);
      this.mxs += (this.mx - this.mxs) * k;
      this.mys += (this.my - this.mys) * k;

      this.frame(this.tCur, dt);
      if (this.deck && this.state.idx === '0') {
        const mx = this.mxs.toFixed(3);
        const my = this.mys.toFixed(3);
        if (mx !== this.lastMx || my !== this.lastMy) {
          this.deck.style.setProperty('--mx', mx);
          this.deck.style.setProperty('--my', my);
          this.lastMx = mx;
          this.lastMy = my;
        }
      }

      if (this.visible) {
        this.raf = requestAnimationFrame(this.loop);
      } else {
        this.running = false;
      }
    };

    frame(t, dt) {
      const S = this.S;
      const [px, pxv, py, prot, ps] = this.path(t);
      let X = px * this.W + pxv * this.vh;
      let Y = py * this.vh - (this.inset || 0) / 2;
      let rot = prot;
      const s = ps;

      // Mouse parallax, calmed during the ritual
      const calm = reduced.matches ? 0 : 1 - clamp((t - S.ritual + 0.3) / 0.3, 0, 1);
      X += this.mxs * 18 * calm;
      Y += this.mys * 12 * calm;
      rot += this.mxs * 3.2 * calm;

      // Between chapters: lift, tilt and settle while the next bottle fades in
      let lift = 0;
      for (let k = 1; k < this.N; k++) {
        const bd = S.ch + k * S.chLen;
        const uu = (t - (bd - 0.45)) / 0.9;
        if (uu > 0 && uu < 1) {
          // smooth bell: zero velocity at both ends
          const bell = Math.pow(Math.sin(Math.PI * uu), 2);
          lift = bell;
          rot += bell * 3;
        }
      }
      Y -= lift * 26;
      const sc = s * (1 - lift * 0.05);

      this.pose = { X, Y, rot, sc };
      this.scrubItems(t);
      this.scrubHero(t);
      this.scrubPanels(t);
      this.bottle.style.transform = `translate3d(${(X - this.BW / 2).toFixed(2)}px, ${(Y - this.H / 2).toFixed(2)}px, 0) rotate(${rot.toFixed(2)}deg) scale(${sc.toFixed(4)})`;

      // Which panel is showing
      const ch = t < S.ch ? 0 : Math.min(this.N - 1, Math.floor((t - S.ch) / S.chLen));
      let idx;
      if (t < S.man) idx = '0';
      else if (t < S.ch) idx = '1';
      else if (t < S.ritual) idx = String(2 + ch);
      else idx = 'ritual';

      this.stage.style.setProperty('--m', clamp((t - 1.3) / 1.15, 0, 1).toFixed(4));
      if (idx !== this.state.idx || ch !== this.state.ch) this.setPanel(idx, ch);

      // Ritual: three phases light up the ritual words
      const q = clamp((t - S.ritual) / S.ritualLen, 0, 1);
      const inRitual = idx === 'ritual';
      const phase = !inRitual ? -1 : q < 0.3 ? 0 : q < 0.78 ? 1 : 2;
      if (phase !== this.state.phase) {
        this.state.phase = phase;
        this.stage.dataset.phase = String(Math.max(0, phase));
      }
      this.setUncapped((inRitual && q > 0.08) || this.capHolds > 0);
    }

    /**
     * Bottle swaps follow the scroll exactly: around each chapter boundary the
     * outgoing bottle rises and fades while the next one lifts in.
     */
    scrubItems(t) {
      const S = this.S;
      const win = 0.7;
      const smooth = (x) => x * x * (3 - 2 * x);
      const boundaries = [];
      for (let k = 1; k < this.N; k++) boundaries.push({ b: S.ch + k * S.chLen, from: k - 1, to: k });
      boundaries.push({ b: S.ritual, from: this.N - 1, to: this.ritualIndex });

      let current = 0;
      let weights = null;
      for (const { b, from, to } of boundaries) {
        if (t >= b + win / 2) {
          current = to;
          continue;
        }
        if (t > b - win / 2 && from !== to) {
          const u = smooth(clamp((t - (b - win / 2)) / win, 0, 1));
          // Outgoing stays solid underneath and settles back; incoming is revealed bottom-up on top
          // Both frames sit exactly on top of each other; the new photo wipes up inside the same arch
          weights = { [from]: { o: 1, y: 0, s: 1, clip: 0, z: 1 }, [to]: { o: 1, y: 0, s: 1, clip: 1 - u, z: 2 } };
        }
        break;
      }
      if (!weights) weights = { [current]: { o: 1, y: 0, s: 1, clip: 0, z: 2 } };

      this.items.forEach((item, i) => {
        const w = weights[i];
        const key = w ? `${w.o.toFixed(3)}|${w.s.toFixed(4)}|${w.clip.toFixed(4)}|${w.z}` : 'off';
        if (item._k === key) return;
        item._k = key;
        if (!w) {
          item.style.opacity = '0';
          item.style.visibility = 'hidden';
          return;
        }
        item.style.visibility = 'visible';
        item.style.opacity = '1';
        item.style.zIndex = String(w.z);
        item.style.transform = '';
        item.style.clipPath = w.clip > 0 ? `inset(${(w.clip * 100).toFixed(2)}% -150% -40% -150%)` : 'none';
        item.style.setProperty('--wipe', w.clip.toFixed(4));
        item.classList.toggle('is-active', w.z === 2 && w.clip < 0.5);
      });
    }

    /**
     * Every panel's visibility follows the scroll: fades and drifts in, holds,
     * then fades and drifts out. The stage colour blends between panels the same way.
     */
    scrubPanels(t) {
      const S = this.S;
      const f = 0.32;
      const smooth = (x) => x * x * (3 - 2 * x);
      // Text hands over in sequence: fade out before the boundary, fade in after it (never stacked)
      const vis = (start, end) => {
        const a = start === null ? 1 : smooth(clamp((t - start) / f, 0, 1));
        const b = end === null ? 1 : smooth(clamp((end - t) / f, 0, 1));
        return Math.min(a, b);
      };
      // Colour blends continuously across the boundary
      const blend = (start, end) => {
        const a = start === null ? 1 : smooth(clamp((t - (start - f)) / (2 * f), 0, 1));
        const b = end === null ? 1 : smooth(clamp((end + f - t) / (2 * f), 0, 1));
        return Math.min(a, b);
      };
      const drift = (start, end, v) => {
        if (v >= 0.999) return 0;
        const mid = start === null ? -Infinity : end === null ? Infinity : (start + end) / 2;
        return (t < mid ? 1 : -1) * (1 - v) * 28;
      };
      const apply = (el, v, y = 0) => {
        if (!el) return;
        const key = v.toFixed(3) + '|' + y.toFixed(1);
        if (el._pk === key) return;
        el._pk = key;
        el.style.opacity = v.toFixed(3);
        el.style.transform = y ? `translate3d(0, ${y.toFixed(1)}px, 0)` : '';
        el.style.visibility = v < 0.002 ? 'hidden' : 'visible';
      };

      if (!this.panelEls) {
        this.panelEls = {
          hero: this.querySelector('.ss-hero'),
          ring: this.querySelector('.ss-ring'),
          scrim: this.querySelector('.ss-scrim'),
          water: this.querySelector('.ss-water'),
          man: this.querySelector('.ss-manifesto'),
          ritual: this.querySelector('.ss-ritual'),
          ritualSide: this.ritualSide
        };
      }
      const P = this.panelEls;

      // Hero
      const vHero = vis(null, S.man);
      apply(P.hero, vHero, drift(null, S.man, vHero));
      apply(P.ring, vHero * 0.55);
      apply(P.scrim, vHero);
      apply(P.water, vHero);

      // Manifesto
      const vMan = vis(S.man, S.ch);
      apply(P.man, vMan, drift(S.man, S.ch, vMan));

      // Chapters and their titles
      const chapterVis = [];
      for (let k = 0; k < this.N; k++) {
        const start = S.ch + k * S.chLen;
        const end = start + S.chLen;
        const v = vis(start, end);
        chapterVis.push(v);
        apply(this.chapters[k], v, drift(start, end, v));
        apply(this.titles[k], Math.min(1, v * 1.4));
      }

      // Ritual
      const vRit = vis(S.ritual, null);
      apply(P.ritual, vRit, drift(S.ritual, null, vRit));
      apply(P.ritualSide, vRit, drift(S.ritual, null, vRit));

      // Stage colour: weighted blend of the panels' colours
      const weights = [blend(null, S.man), blend(S.man, S.ch)];
      for (let k = 0; k < this.N; k++) weights.push(blend(S.ch + k * S.chLen, S.ch + (k + 1) * S.chLen));
      weights.push(blend(S.ritual, null));
      let r = 0, g = 0, b = 0, sum = 0;
      weights.forEach((w, i) => {
        const c = this.rgb(this.colors[i]);
        if (!c || w <= 0) return;
        r += c[0] * w; g += c[1] * w; b += c[2] * w; sum += w;
      });
      if (sum > 0) {
        const color = `rgb(${Math.round(r / sum)}, ${Math.round(g / sum)}, ${Math.round(b / sum)})`;
        if (color !== this.lastColor) {
          this.lastColor = color;
          this.stage.style.backgroundColor = color;
          this.bottle.style.setProperty('--spot-stage', color);
        }
      }
    }

    rgb(hex) {
      this.rgbCache = this.rgbCache || {};
      if (hex in this.rgbCache) return this.rgbCache[hex];
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
      return (this.rgbCache[hex] = m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null);
    }

    /** Hero deck and "now wearing" tag fade and gather as you scroll away from the hero. */
    scrubHero(t) {
      if (!this.deck) return;
      const u = clamp((t - 0.25) / 0.8, 0, 1);
      const e = u * u * (3 - 2 * u);
      const key = e.toFixed(3);
      if (key === this.lastHeroKey) return;
      this.lastHeroKey = key;
      this.deck.style.opacity = (1 - e).toFixed(3);
      this.deck.style.setProperty('--gather', key);
      if (this.wearing && this.classList.contains('ss-loaded')) this.wearing.style.opacity = (1 - Math.min(1, e * 1.6)).toFixed(3);
    }

    setPanel(idx, ch) {
      const prev = this.state.idx;
      this.state.idx = idx;
      this.state.ch = ch;
      this.stage.dataset.idx = idx;

      // Stage colour
      let colorIndex = 0;
      if (idx === '1') colorIndex = 1;
      else if (idx === 'ritual') colorIndex = this.N + 2;
      else if (idx !== '0') colorIndex = 2 + ch;
      const color = this.colors[colorIndex];
      if (color) {
        // Product photos in blend mode: soft spotlight on dark stages
        this.bottle.style.setProperty('--spot-light', this.isDark(color) ? '#ede6dc' : color);
      }


      // Chapter titles and copy
      const activeChapter = /^\d+$/.test(idx) && parseInt(idx, 10) >= 2 ? parseInt(idx, 10) - 1 : 0;
      const pastAll = idx === 'ritual';
      this.titles.forEach((el, k) => {
        el.classList.toggle('is-active', k + 1 === activeChapter);
        el.classList.toggle('is-past', pastAll || (activeChapter > 0 && k + 1 < activeChapter));
      });
      this.chapters.forEach((el, k) => {
        const on = k + 1 === activeChapter;
        el.classList.toggle('is-active', on);
        el.classList.toggle('is-past', pastAll || (activeChapter > 0 && k + 1 < activeChapter));
        el.toggleAttribute('inert', !on);
        el.setAttribute('aria-hidden', String(!on));
      });
      if (this.ritualSide) {
        this.ritualSide.toggleAttribute('inert', idx !== 'ritual');
        this.ritualSide.setAttribute('aria-hidden', String(idx !== 'ritual'));
      }

      // Pill
      if (this.pillLabel) {
        let label = this.pillLabel.dataset.all;
        if (idx === 'ritual') label = this.pillLabel.dataset.ritual;
        else if (activeChapter > 0) {
          label = this.querySelector(`.ss-pill__option[data-jump="${activeChapter}"] span`)?.textContent || label;
        }
        this.pillLabel.textContent = label;
        this.querySelectorAll('.ss-pill__option').forEach((o) => {
          const j = o.dataset.jump;
          const current = (j === 'ritual' && idx === 'ritual') || (activeChapter > 0 && j === String(activeChapter)) || (j === '0' && (idx === '0' || idx === '1'));
          o.setAttribute('aria-current', String(current));
        });
      }

      // Water only flows in the hero
      if (this.water) this.water.suspended = idx !== '0';

      // Header tone follows the stage
      this.setTone(idx === '0' || idx === 'ritual' ? 'dark' : 'light');

    }

    isDark(hex) {
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
      if (!m) return false;
      const [r, g, b] = [m[1], m[2], m[3]].map((v) => parseInt(v, 16) / 255);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.42;
    }

    setTone(tone) {
      if (!tone || this.dataset.headerTone === tone) return;
      this.dataset.headerTone = tone;
      document.dispatchEvent(new CustomEvent('header-tone:refresh'));
    }

    setUncapped(on) {
      if (on === this.state.uncapped) return;
      this.state.uncapped = on;
      this.bottle.classList.toggle('is-uncapped', on);
    }

    /* ---------- navigation ---------- */

    jump(key, instant = false) {
      const anchor = key === 'ritual' ? this.querySelector('[data-anchor="ritual"]') : this.querySelector(`[data-anchor="${key}"]`);
      if (!anchor) return;
      const go = () => {
        const top = window.scrollY + this.track.getBoundingClientRect().top + parseFloat(anchor.style.top || '0');
        window.scrollTo({ top, behavior: 'instant' });
        this.tCur = null;
      };
      if (instant || reduced.matches) {
        go();
        return;
      }
      if (this.navBusy) return;
      this.navBusy = true;
      // No blank screen: the stage content dips briefly while the page jumps, then fades straight back
      this.stage.classList.add('is-jumping');
      setTimeout(() => {
        go();
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            this.stage.classList.remove('is-jumping');
            setTimeout(() => (this.navBusy = false), 300);
          })
        );
      }, 160);
    }

    /* ---------- cart ---------- */

    async addToCart(button) {
      button.setAttribute('aria-busy', 'true');
      try {
        const sections = window.CartAPI ? window.CartAPI.sectionsToRender() : [];
        const response = await fetch(`${window.routes.cart_add_url}.js`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            items: [{ id: Number(button.dataset.add), quantity: 1 }],
            sections,
            sections_url: window.location.pathname
          })
        });
        const state = await response.json();
        if (state.status) {
          this.showToast(state.description || window.themeStrings.cartError);
          return;
        }
        window.CartAPI?.applySections(state.sections);
        document.dispatchEvent(new CustomEvent('cart:updated', { detail: state }));
        const message = (this.dataset.addedTemplate || '[name] added to your bag').replace('[name]', button.dataset.name || '');
        this.showToast(message);
        window.Theme?.announce(message);
      } catch (error) {
        this.showToast(window.themeStrings?.cartError || 'Error');
      } finally {
        button.removeAttribute('aria-busy');
      }
    }

    showToast(text) {
      if (!this.toast) return;
      clearTimeout(this.toastTimer);
      this.toast.textContent = text;
      this.toast.classList.add('is-visible');
      this.toastTimer = setTimeout(() => this.toast.classList.remove('is-visible'), 2400);
    }
  }

  customElements.define('scent-story', ScentStory);
})();
