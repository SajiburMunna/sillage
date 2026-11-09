/**
 * <water-flow> — natural water flow hero effect.
 *
 * Renders a WebGL fragment shader that simulates a flowing stream:
 *  - anisotropic, domain-warped noise height field moving along a flow direction
 *  - refraction of an optional background image through the water surface
 *  - dappled caustic light and a soft specular sheen
 *  - pointer ripples
 *
 * Performance & accessibility:
 *  - initialised when idle, never blocks first paint; the <img> stays the LCP element
 *  - renders at a reduced internal resolution, DPR capped
 *  - stops rendering when off-screen or when the tab is hidden
 *  - honours prefers-reduced-motion (draws a single still frame)
 *  - exposes a pause / play control (WCAG 2.2.2)
 *  - falls back to the static image / gradient when WebGL is unavailable
 */
(() => {
  if (customElements.get('water-flow')) return;

  const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

  const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 vUv;

uniform vec2 uRes;
uniform float uTime;
uniform sampler2D uTex;
uniform float uHasTex;
uniform vec2 uTexSize;
uniform vec2 uFocal;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uLight;
uniform float uRefract;
uniform float uCaustic;
uniform float uTint;
uniform vec2 uDir;
uniform vec4 uRipples[6];
uniform float uMode;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = r * p * 2.03 + 11.7;
    a *= 0.5;
  }
  return v;
}

// Rotate a point into the stream's frame and stretch it along the current,
// which turns round noise blobs into long, flowing ripples.
vec2 streamSpace(vec2 p) {
  vec2 perp = vec2(-uDir.y, uDir.x);
  return vec2(dot(p, uDir) * 0.55, dot(p, perp) * 1.6);
}

float ripples(vec2 p) {
  float h = 0.0;
  for (int i = 0; i < 6; i++) {
    vec4 r = uRipples[i];
    float age = uTime - r.z;
    if (r.w > 0.0 && age > 0.0 && age < 3.5) {
      float d = distance(p, r.xy);
      float ring = sin(d * 38.0 - age * 9.0);
      h += ring * exp(-d * 5.0) * exp(-age * 1.3) * smoothstep(0.0, 0.15, age * 1.6 - d) * r.w;
    }
  }
  return h * 0.06;
}

float height(vec2 p) {
  vec2 s = streamSpace(p) * 3.0;
  float t = uTime;
  vec2 flow = vec2(t * 0.9, 0.0);
  vec2 warp = vec2(
    fbm(s * 0.7 - flow * 0.35),
    fbm(s * 0.7 + vec2(5.2, 1.3) - flow * 0.2)
  );
  float h = fbm(s + warp * 1.6 - flow);
  h += 0.35 * fbm(s * 2.3 - flow * 1.6 + warp);
  return h * 0.75 + ripples(p);
}

float ridge(float n) {
  return 1.0 - abs(n * 2.0 - 1.0);
}

vec2 coverUv(vec2 uv) {
  float canvasAspect = uRes.x / uRes.y;
  float texAspect = uTexSize.x / max(uTexSize.y, 1.0);
  vec2 scale = vec2(1.0);
  if (canvasAspect > texAspect) {
    scale.y = texAspect / canvasAspect;
  } else {
    scale.x = canvasAspect / texAspect;
  }
  vec2 offset = (1.0 - scale) * uFocal;
  return uv * scale + offset;
}

// Silk haze: layered domain warping makes slow, folding smoke-like silk.
vec3 silk(vec2 p, float aspect) {
  float t = uTime * 0.32;
  vec2 s = p * 1.35;
  vec2 q = vec2(fbm(s + vec2(0.0, t)), fbm(s + vec2(5.2, 1.3) - t * 0.6));
  vec2 r = vec2(fbm(s + 3.0 * q + vec2(1.7, 9.2) + t * 0.45), fbm(s + 3.0 * q + vec2(8.3, 2.8) - t * 0.3));
  float f = fbm(s + 2.4 * r);
  vec3 col = mix(uDeep, uShallow, clamp(f * f * 2.3, 0.0, 1.0));
  col = mix(col, uLight, clamp(dot(q, q) * 0.5 * r.x * r.x * 1.8, 0.0, 1.0) * 0.55);
  // Satin sheen along the folds
  float fold = pow(1.0 - abs(f * 2.0 - 1.0), 7.0);
  col += uLight * fold * 0.16;
  // Soft light behind the featured bottle
  float d = distance(vUv * vec2(aspect, 1.0), vec2(uFocal.x * aspect, uFocal.y));
  col += uLight * 0.14 * exp(-d * d * 3.2);
  // Gentle vignette
  vec2 v = vUv - 0.5;
  col *= 1.0 - dot(v, v) * 0.55;
  return col;
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2(vUv.x * aspect, vUv.y);

  if (uMode > 0.5) {
    gl_FragColor = vec4(silk(p, aspect), 1.0);
    return;
  }

  // Surface normal from the height field
  float e = 0.0035;
  float h = height(p);
  float hx = height(p + vec2(e, 0.0));
  float hy = height(p + vec2(0.0, e));
  vec3 n = normalize(vec3((h - hx) / e, (h - hy) / e, 6.0));

  // Base: refracted photo, or a depth gradient of the water colours
  vec3 col;
  float depth = smoothstep(0.15, 0.95, h + (1.0 - vUv.y) * 0.25);
  vec3 water = mix(uShallow, uDeep, depth);
  if (uHasTex > 0.5) {
    vec2 uv = coverUv(clamp(vUv + n.xy * uRefract, 0.001, 0.999));
    vec3 img = texture2D(uTex, uv).rgb;
    col = mix(img, img * water * 1.6, uTint);
  } else {
    col = water;
  }

  // Caustics: two drifting ridged noise layers multiplied into a light web
  vec2 cs = streamSpace(p) * 5.0 + n.xy * 2.0;
  float t = uTime;
  float c1 = ridge(noise(cs + vec2(t * 0.8, t * 0.15)));
  float c2 = ridge(noise(cs * 1.37 + vec2(-t * 0.55, 3.1 + t * 0.4)));
  float caustic = pow(c1 * c2, 5.0);
  col += uLight * caustic * uCaustic * (0.55 + 0.45 * (1.0 - depth));

  // Specular sheen
  vec3 L = normalize(vec3(-0.35, 0.55, 0.75));
  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 60.0);
  col += uLight * spec * 0.35;

  // Soft vignette
  vec2 v = vUv - 0.5;
  col *= 1.0 - dot(v, v) * 0.35;

  gl_FragColor = vec4(col, 1.0);
}`;

  const hexToRgb = (hex, fallback) => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((hex || '').trim());
    if (!m) return fallback;
    return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
  };

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  class WaterFlow extends HTMLElement {
    connectedCallback() {
      this.canvas = this.querySelector('canvas');
      this.image = this.querySelector('img.water-flow__media');
      this.toggle = this.closest('section, .shopify-section')?.querySelector('[data-water-toggle]');
      this.video = this.querySelector('video');
      this.playing = false;
      this.userPaused = false;
      this.visible = true;
      this.ripples = new Array(6).fill(null).map(() => [0, 0, -10, 0]);
      this.rippleIndex = 0;
      this.time = 0;
      this.lastFrame = 0;

      this.toggle?.addEventListener('click', () => this.onToggle());

      if (this.video) {
        this.setupVideo();
        return;
      }

      const start = () => this.init();
      if ('requestIdleCallback' in window) {
        requestIdleCallback(start, { timeout: 1500 });
      } else {
        setTimeout(start, 200);
      }
    }

    disconnectedCallback() {
      this.stop();
      this.observer?.disconnect();
      document.removeEventListener('visibilitychange', this.onVisibility);
      reducedMotion.removeEventListener?.('change', this.onMotionChange);
      if (this.gl) {
        this.gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
    }

    /* ---------- Video mode ---------- */

    setupVideo() {
      if (reducedMotion.matches) {
        this.video.pause();
        this.video.removeAttribute('autoplay');
        this.setToggleState(false);
      } else {
        this.setToggleState(true);
      }
    }

    /* ---------- Shader mode ---------- */

    init() {
      if (!this.canvas) return;
      const gl =
        this.canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'low-power' }) ||
        this.canvas.getContext('experimental-webgl');
      if (!gl) {
        this.classList.add('water-flow--fallback');
        this.toggle?.setAttribute('hidden', '');
        return;
      }
      this.gl = gl;

      const program = this.createProgram(gl, VERT, FRAG);
      if (!program) {
        this.classList.add('water-flow--fallback');
        this.toggle?.setAttribute('hidden', '');
        return;
      }
      this.program = program;
      gl.useProgram(program);

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const aPos = gl.getAttribLocation(program, 'aPos');
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      const names = ['uRes', 'uTime', 'uTex', 'uHasTex', 'uTexSize', 'uFocal', 'uDeep', 'uShallow', 'uLight', 'uRefract', 'uCaustic', 'uTint', 'uDir', 'uRipples', 'uMode'];
      this.u = {};
      names.forEach((name) => (this.u[name] = gl.getUniformLocation(program, name)));

      this.readSettings();
      gl.uniform1f(this.u.uHasTex, 0);
      gl.uniform2f(this.u.uTexSize, 1, 1);
      this.loadTexture();

      this.resize();
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this);

      this.onVisibility = () => this.updatePlayback();
      document.addEventListener('visibilitychange', this.onVisibility);

      this.observer = new IntersectionObserver((entries) => {
        this.visible = entries[0].isIntersecting;
        this.updatePlayback();
      });
      this.observer.observe(this);

      this.onMotionChange = () => this.updatePlayback();
      reducedMotion.addEventListener?.('change', this.onMotionChange);

      if (this.dataset.interactive === 'true') {
        this.addEventListener('pointermove', (event) => this.onPointer(event, 0.6), { passive: true });
        this.addEventListener('pointerdown', (event) => this.onPointer(event, 1.4, true), { passive: true });
      }

      this.render(0);
      this.classList.add('water-flow--ready');
      this.updatePlayback();
    }

    readSettings() {
      const d = this.dataset;
      const gl = this.gl;
      const angle = ((parseFloat(d.direction) || 0) * Math.PI) / 180;
      this.speed = (parseFloat(d.speed) || 50) / 100;
      gl.uniform3fv(this.u.uDeep, hexToRgb(d.deep, [0.05, 0.16, 0.19]));
      gl.uniform3fv(this.u.uShallow, hexToRgb(d.shallow, [0.25, 0.55, 0.58]));
      gl.uniform3fv(this.u.uLight, hexToRgb(d.light, [0.95, 0.98, 0.96]));
      gl.uniform1f(this.u.uRefract, ((parseFloat(d.refraction) || 0) / 100) * 0.06);
      gl.uniform1f(this.u.uCaustic, (parseFloat(d.caustics) || 0) / 100);
      gl.uniform1f(this.u.uTint, (parseFloat(d.tint) || 0) / 100);
      gl.uniform2f(this.u.uDir, Math.cos(angle), Math.sin(angle));
      gl.uniform2f(this.u.uFocal, parseFloat(d.focalX ?? 50) / 100, 1 - parseFloat(d.focalY ?? 50) / 100);
      gl.uniform1f(this.u.uMode, d.mode === 'silk' ? 1 : 0);
    }

    loadTexture() {
      const img = this.image;
      if (!img) return;
      const upload = () => {
        const gl = this.gl;
        if (!gl || !img.naturalWidth) return;
        try {
          const tex = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.uniform1i(this.u.uTex, 0);
          gl.uniform1f(this.u.uHasTex, 1);
          gl.uniform2f(this.u.uTexSize, img.naturalWidth, img.naturalHeight);
          if (!this.playing) this.render(this.time);
        } catch (error) {
          // Cross-origin or decode failure: keep the procedural water.
          gl.uniform1f(this.u.uHasTex, 0);
        }
      };
      if (img.complete && img.naturalWidth) {
        upload();
      } else {
        img.addEventListener('load', upload, { once: true });
      }
    }

    createProgram(gl, vsSource, fsSource) {
      const compile = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          console.warn('[water-flow]', gl.getShaderInfoLog(shader));
          gl.deleteShader(shader);
          return null;
        }
        return shader;
      };
      const vs = compile(gl.VERTEX_SHADER, vsSource);
      const fs = compile(gl.FRAGMENT_SHADER, fsSource);
      if (!vs || !fs) return null;
      const program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn('[water-flow]', gl.getProgramInfoLog(program));
        return null;
      }
      return program;
    }

    resize() {
      if (!this.gl) return;
      const rect = this.getBoundingClientRect();
      const quality = parseFloat(this.dataset.quality) || 0.6;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.round(rect.width * dpr * quality));
      const height = Math.max(1, Math.round(rect.height * dpr * quality));
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.gl.viewport(0, 0, width, height);
        this.gl.uniform2f(this.u.uRes, width, height);
        if (!this.playing) this.render(this.time);
      }
    }

    onPointer(event, strength, force = false) {
      if (!this.playing) return;
      const now = performance.now();
      if (!force && now - (this.lastRipple || 0) < 140) return;
      this.lastRipple = now;
      const rect = this.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = 1 - (event.clientY - rect.top) / rect.height;
      const aspect = rect.width / rect.height;
      this.ripples[this.rippleIndex] = [x * aspect, y, this.time, strength];
      this.rippleIndex = (this.rippleIndex + 1) % this.ripples.length;
    }

    render(time) {
      const gl = this.gl;
      gl.uniform1f(this.u.uTime, time);
      gl.uniform4fv(this.u.uRipples, new Float32Array(this.ripples.flat()));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    loop = (now) => {
      if (!this.playing) return;
      const dt = Math.min((now - (this.lastFrame || now)) / 1000, 0.1);
      this.lastFrame = now;
      this.time += dt * this.speed;
      this.render(this.time);
      this.frame = requestAnimationFrame(this.loop);
    };

    start() {
      if (this.playing || !this.gl) return;
      this.playing = true;
      this.lastFrame = 0;
      this.frame = requestAnimationFrame(this.loop);
    }

    stop() {
      this.playing = false;
      if (this.frame) cancelAnimationFrame(this.frame);
    }

    /** Lets a parent component pause the water without touching the user's choice. */
    set suspended(value) {
      if (this._suspended === value) return;
      this._suspended = value;
      if (this.gl) this.updatePlayback();
    }

    get suspended() {
      return !!this._suspended;
    }

    updatePlayback() {
      const shouldPlay = this.visible && !document.hidden && !reducedMotion.matches && !this.userPaused && !this._suspended;
      if (shouldPlay) {
        this.start();
      } else {
        this.stop();
      }
      if (reducedMotion.matches) {
        this.toggle?.setAttribute('hidden', '');
      } else {
        this.toggle?.removeAttribute('hidden');
      }
      this.setToggleState(!this.userPaused && !reducedMotion.matches);
    }

    onToggle() {
      if (this.video) {
        if (this.video.paused) {
          this.video.play();
          this.setToggleState(true);
        } else {
          this.video.pause();
          this.setToggleState(false);
        }
        return;
      }
      this.userPaused = !this.userPaused;
      this.updatePlayback();
    }

    setToggleState(isPlaying) {
      if (!this.toggle) return;
      const strings = window.themeStrings || {};
      this.toggle.setAttribute('aria-pressed', String(!isPlaying));
      this.toggle.setAttribute('aria-label', isPlaying ? strings.pause || 'Pause' : strings.play || 'Play');
      this.toggle.classList.toggle('is-paused', !isPlaying);
    }
  }

  customElements.define('water-flow', WaterFlow);
})();
