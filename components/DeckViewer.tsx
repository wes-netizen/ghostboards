'use client';
import { useEffect, useRef } from 'react';
import { createShader, createProgram } from '../utils/webgl';

/**
 * DeckViewer
 *
 * Small, dependency-free WebGL viewer. This uses plain WebGL (no Three.js)
 * and simple vertex/fragment shaders. Geometry is a placeholder longboard deck
 * made by subdividing a lengthwise mesh and applying rounded ends.
 *
 * When migrating to Three.js, replace this component's GL init + render loop.
 */

type Props = {
  deckColor: string; // "#rrggbb"
  ledColor: string; // "#rrggbb"
  ledIntensity: number; // 0..4
  deckLength?: number; // meters
  deckWidth?: number; // meters
  truckColor?: string; // hex color for trucks
  trucksEnabled?: boolean;
  wheelColor?: string;
  wheelsEnabled?: boolean;
  fullLedEnabled?: boolean;
  dropThrough?: boolean;
  deckTexture?: string | null; // dataURL to use as deck graphic
};

export default function DeckViewer({ deckColor, ledColor, ledIntensity, deckLength, deckWidth, truckColor, trucksEnabled, wheelColor, wheelsEnabled, fullLedEnabled, dropThrough, deckTexture }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const glStateRef = useRef<{ prog: WebGLProgram | null } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const glCtx = canvas.getContext('webgl');
    if (!glCtx) {
      console.warn('WebGL not supported');
      return;
    }
    const gl = glCtx; // non-nullable alias for TypeScript

    // Ensure canvas has real resolution and viewport set immediately
    const canvasEl = canvas as HTMLCanvasElement;
    canvasEl.width = Math.max(1, Math.floor(canvasEl.clientWidth * (window.devicePixelRatio || 1)));
    canvasEl.height = Math.max(1, Math.floor(canvasEl.clientHeight * (window.devicePixelRatio || 1)));
    gl.viewport(0, 0, canvasEl.width, canvasEl.height);

    // Basic shaders: positions (x,y,z), normals, UVs, MVP uniform, deck color, LED params
    const vs = `
      attribute vec3 aPosition;
      attribute vec3 aNormal;
      attribute vec2 aUV;
      uniform mat4 uMVP;
      varying vec3 vPosition;
      varying vec3 vNormal;
      varying vec2 vUV;
      void main() {
        vPosition = aPosition;
        vNormal = aNormal;
        vUV = aUV;
        gl_Position = uMVP * vec4(aPosition, 1.0);
      }
    `;

    // 4 LEDs max — small circular additive contributions
    // Wheels rendered as circular decals; LED rendering can be toggled via uniform
    const fs = `
      precision mediump float;
      varying vec3 vPosition;
      varying vec3 vNormal;
      varying vec2 vUV;
      uniform vec3 uDeckColor;
      uniform vec3 uLEDColor;
      uniform float uLEDIntensity;
      uniform vec3 uLEDPos[4];
      uniform float uLEDRadius;

      uniform vec3 uWheelColor;
      uniform vec2 uWheelPos[4];
      uniform float uWheelRadius;

      uniform float uFullLedEnabled;
      uniform float uDropThroughEnabled;
      uniform float uDropWidth;
      uniform float uDropLength;

      uniform sampler2D uDeckTex;
      uniform float uUseDeckTex;

      void main() {
        vec3 base = uDeckColor;
        if (uUseDeckTex > 0.5) {
          vec4 t = texture2D(uDeckTex, vUV);
          base = mix(base, t.rgb, t.a);
        }

        float led = 0.0;
        if (uFullLedEnabled > 0.5) {
          for (int i = 0; i < 4; i++){
            float d = distance(vPosition.xy, uLEDPos[i].xy);
            float s = smoothstep(uLEDRadius, uLEDRadius * 0.2, d);
            led += (1.0 - s);
          }
        }
        vec3 color = base + uLEDColor * uLEDIntensity * led;

        // wheels: small circular decals at wheel positions
        for (int i = 0; i < 4; i++) {
          float d = distance(vPosition.xy, uWheelPos[i]);
          float s = smoothstep(uWheelRadius, uWheelRadius * 0.6, d);
          color = mix(color, uWheelColor, 1.0 - s);
        }

        // drop-through visual: darker center strip when enabled
        if (uDropThroughEnabled > 0.5) {
          float dy = abs(vPosition.y);
          float dx = abs(vPosition.x);
          float withinX = step(dx, uDropLength);
          float withinY = 1.0 - smoothstep(uDropWidth * 0.6, uDropWidth, dy);
          float mask = withinX * withinY;
          // darken the area and reduce LED contribution
          color = mix(color * 0.45, color, 1.0 - mask);
        }

        // improved lighting + rim highlight for clearer silhouette
        vec3 N = normalize(vNormal);
        float ndotl = max(0.0, dot(N, normalize(vec3(0.3,0.6,0.8))));
        float rim = pow(1.0 - max(0.0, dot(N, vec3(0.0,0.0,1.0))), 2.0);
        float light = 0.25 + 0.75 * ndotl;
        color *= light;
        color += vec3(0.06) * rim; // subtle rim light to separate silhouette from background
        color = clamp(color, 0.0, 1.0);
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const vert = createShader(gl, gl.VERTEX_SHADER, vs);
    const frag = createShader(gl, gl.FRAGMENT_SHADER, fs);
    const prog = createProgram(gl, vert, frag);
    // store gl and prog for later updates
    glStateRef.current = { prog } as any;

    // Generate deck geometry (subdivided long plane with rounded ends)
    const segments = 120;
    // use props for dimensions (meters) with sensible defaults
    const length = (typeof deckLength === 'number' && deckLength > 0) ? deckLength : 1.0;
    const width = (typeof deckWidth === 'number' && deckWidth > 0) ? deckWidth : 0.26;
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = (t - 0.5) * length * 1.6; // extend length a bit
      // rounded width profile: narrower near ends
      const end = Math.abs((t - 0.5) * 2);
      const w = width * (0.6 + 0.4 * (1.0 - end * end));
      // two vertices per segment (left, right)
      positions.push(x, -w / 2, 0);
      positions.push(x, w / 2, 0);
      normals.push(0, 0, 1);
      normals.push(0, 0, 1);
      // UVs: u across length, v across width (0..1)
      uvs.push(t, 0);
      uvs.push(t, 1);
    }

    for (let i = 0; i < segments; i++) {
      const i0 = i * 2;
      indices.push(i0, i0 + 1, i0 + 2);
      indices.push(i0 + 1, i0 + 3, i0 + 2);
    }

    const posBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const normalBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

    const uvBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);

    const idxBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(prog, 'aPosition');
    const aNormal = gl.getAttribLocation(prog, 'aNormal');
    const aUV = gl.getAttribLocation(prog, 'aUV');

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    window.addEventListener('resize', resize);

    const uMVP = gl.getUniformLocation(prog, 'uMVP')!;
    const uDeckColor = gl.getUniformLocation(prog, 'uDeckColor')!;
    const uLEDColor = gl.getUniformLocation(prog, 'uLEDColor')!;
    const uLEDIntensity = gl.getUniformLocation(prog, 'uLEDIntensity')!;
    const uLEDPos = gl.getUniformLocation(prog, 'uLEDPos')!;
    const uLEDRadius = gl.getUniformLocation(prog, 'uLEDRadius')!;

    const uWheelColor = gl.getUniformLocation(prog, 'uWheelColor')!;
    const uWheelPos = gl.getUniformLocation(prog, 'uWheelPos')!;
    const uWheelRadius = gl.getUniformLocation(prog, 'uWheelRadius')!;
    const uFullLedEnabled = gl.getUniformLocation(prog, 'uFullLedEnabled')!;
    const uDropThroughEnabled = gl.getUniformLocation(prog, 'uDropThroughEnabled')!;
    const uDropWidth = gl.getUniformLocation(prog, 'uDropWidth')!;
    const uDropLength = gl.getUniformLocation(prog, 'uDropLength')!;

    const uDeckTex = gl.getUniformLocation(prog, 'uDeckTex')!;
    const uUseDeckTex = gl.getUniformLocation(prog, 'uUseDeckTex')!;

    // create GL texture placeholder
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // initialize 1x1 transparent pixel so shader can sample immediately
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // store texture in state ref for updates
    (glStateRef.current as any).deckTexture = tex;

    // sample LED positions (in deck local space x,y). 4 spots along centerline
    const leds = [
      [-0.4, 0.0, 0.02],
      [-0.1, -0.03, 0.02],
      [0.15, 0.03, 0.02],
      [0.45, 0.0, 0.02]
    ];

    // create simple truck rectangle geometry (two trucks, each a small quad)
    const truckPositions: number[] = [];
    const truckNormals: number[] = [];
    const truckIndices: number[] = [];
    const truckHalfX = Math.max(0.05, length * 0.06);
    const truckHalfY = Math.max(0.03, width * 0.12);
    const truckCenters = [-length * 0.35, length * 0.35];
    for (let i = 0; i < truckCenters.length; i++) {
      const cx = truckCenters[i];
      const base = truckPositions.length / 3;
      // quad: (cx - hx, -hy), (cx + hx, -hy), (cx - hx, hy), (cx + hx, hy)
      truckPositions.push(cx - truckHalfX, -truckHalfY, 0);
      truckPositions.push(cx + truckHalfX, -truckHalfY, 0);
      truckPositions.push(cx - truckHalfX, truckHalfY, 0);
      truckPositions.push(cx + truckHalfX, truckHalfY, 0);
      for (let j = 0; j < 4; j++) truckNormals.push(0, 0, 1);
      truckIndices.push(base + 0, base + 1, base + 2);
      truckIndices.push(base + 1, base + 3, base + 2);
    }

    const truckPosBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, truckPosBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(truckPositions), gl.STATIC_DRAW);
    const truckNormalBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, truckNormalBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(truckNormals), gl.STATIC_DRAW);
    const truckIdxBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, truckIdxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(truckIndices), gl.STATIC_DRAW);

    // Simple projection * view * model matrix
    function perspective(fovy: number, aspect: number, near: number, far: number) {
      const f = 1.0 / Math.tan((fovy / 2) * (Math.PI / 180));
      const nf = 1 / (near - far);
      const out = new Float32Array(16);
      out[0] = f / aspect;
      out[5] = f;
      out[10] = (far + near) * nf;
      out[11] = -1;
      out[14] = (2 * far * near) * nf;
      return out;
    }
    function multiply(a: Float32Array, b: Float32Array) {
      const out = new Float32Array(16);
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          out[i * 4 + j] =
            a[i * 4 + 0] * b[0 * 4 + j] +
            a[i * 4 + 1] * b[1 * 4 + j] +
            a[i * 4 + 2] * b[2 * 4 + j] +
            a[i * 4 + 3] * b[3 * 4 + j];
        }
      }
      return out;
    }

    function translation(tx: number, ty: number, tz: number) {
      const out = new Float32Array(16);
      out[0] = 1; out[5] = 1; out[10] = 1; out[15] = 1;
      out[12] = tx; out[13] = ty; out[14] = tz;
      return out;
    }
    function rotationY(a: number) {
      const out = new Float32Array(16);
      const c = Math.cos(a), s = Math.sin(a);
      out[0] = c; out[2] = s;
      out[5] = 1;
      out[8] = -s; out[10] = c;
      out[15] = 1;
      return out;
    }
    function scale(s: number) {
      const out = new Float32Array(16);
      out[0] = s; out[5] = s; out[10] = s; out[15] = 1;
      return out;
    }

    let t0 = performance.now();
    function draw(now: number) {
      const dt = (now - t0) / 1000;
      t0 = now;

      resize();

      gl.enable(gl.DEPTH_TEST);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.useProgram(prog);

      // bind attributes
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, normalBuf);
      gl.enableVertexAttribArray(aNormal);
      gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);

      // bind UVs
      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
      gl.enableVertexAttribArray(aUV);
      gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);

      // compute MVP
      const aspect = canvas.width / canvas.height;
      const proj = perspective(45, aspect, 0.1, 10);
      const view = translation(0, 0, -1.6);
      const rot = rotationY(now * 0.0004);
      const sc = scale(1.0);
      const model = multiply(rot, sc);
      const vp = multiply(proj, view);
      const mvp = multiply(vp, model);

      gl.uniformMatrix4fv(uMVP, false, mvp);

      // bind texture unit 0
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, (glStateRef.current as any).deckTexture);
      gl.uniform1i(uDeckTex, 0);
      gl.uniform1f(uUseDeckTex, deckTexture ? 1.0 : 0.0);

      // uniforms: colors/intensity/leds
      const dc = hexToRgbNormalized(deckColor);
      const lc = hexToRgbNormalized(ledColor);
      gl.uniform3fv(uDeckColor, dc);
      gl.uniform3fv(uLEDColor, lc);
      gl.uniform1f(uLEDIntensity, ledIntensity);
      // flatten led positions into Float32Array (4 vec3)
      const ledArr = new Float32Array(4 * 3);
      for (let i = 0; i < 4; i++) {
        if (i < leds.length) {
          ledArr[i * 3 + 0] = leds[i][0];
          ledArr[i * 3 + 1] = leds[i][1];
          ledArr[i * 3 + 2] = leds[i][2];
        } else {
          ledArr[i * 3 + 0] = 0;
          ledArr[i * 3 + 1] = 0;
          ledArr[i * 3 + 2] = 0;
        }
      }
      gl.uniform3fv(uLEDPos, ledArr);
      gl.uniform1f(uLEDRadius, 0.07);

      // wheel uniforms
      const wc = hexToRgbNormalized(wheelColor || '#ffffff');
      gl.uniform3fv(uWheelColor, wc);
      // compute 4 wheel positions (two x positions x two y offsets)
      const wheelX = [-length * 0.35, length * 0.35];
      const wheelY = [-width / 2 + 0.06, width / 2 - 0.06];
      const wheelPosArr = new Float32Array([
        wheelX[0], wheelY[0],
        wheelX[0], wheelY[1],
        wheelX[1], wheelY[0],
        wheelX[1], wheelY[1]
      ]);
      gl.uniform2fv(uWheelPos, wheelPosArr);
      gl.uniform1f(uWheelRadius, Math.max(0.04, length * 0.04));
      gl.uniform1f(uFullLedEnabled, fullLedEnabled ? 1 : 0);
      gl.uniform1f(uDropThroughEnabled, dropThrough ? 1 : 0);
      // pass a reasonable strip size and length relative to deck
      gl.uniform1f(uDropWidth, 0.06);
      gl.uniform1f(uDropLength, length * 0.35);

      // draw deck
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

      // draw trucks as separate geometry, colored by truckColor
      if (trucksEnabled) {
        // bind truck pos/normals/indices
        gl.uniform3fv(uDeckColor, hexToRgbNormalized(truckColor || '#333'));
        gl.bindBuffer(gl.ARRAY_BUFFER, truckPosBuf);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, truckNormalBuf);
        gl.enableVertexAttribArray(aNormal);
        gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, truckIdxBuf);
        gl.drawElements(gl.TRIANGLES, truckIndices.length, gl.UNSIGNED_SHORT, 0);

        // restore deck buffers
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuf);
        gl.enableVertexAttribArray(aNormal);
        gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
      }
      frameRef.current = requestAnimationFrame(draw);
    }

    frameRef.current = requestAnimationFrame(draw);

    // update texture when deckTexture prop changes
    // will be handled by a separate effect below

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resize);
      gl.deleteProgram(prog);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      gl.deleteBuffer(posBuf);
      gl.deleteBuffer(idxBuf);
      // delete truck buffers if present
      try {
        gl.deleteBuffer(truckPosBuf);
        gl.deleteBuffer(truckNormalBuf);
        gl.deleteBuffer(truckIdxBuf);
      } catch (e) {
        // ignore
      }
      try {
        gl.deleteTexture((glStateRef.current as any).deckTexture);
      } catch (e) {}
    };
  }, [deckLength, deckWidth, deckColor, ledColor, ledIntensity, truckColor, trucksEnabled, wheelColor, wheelsEnabled, fullLedEnabled, dropThrough, deckTexture]); // re-init when props change

  // update GL texture when deckTexture prop changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl');
    if (!gl) return;
    const tex = (glStateRef.current as any)?.deckTexture as WebGLTexture | undefined;
    if (!tex) return;

    if (!deckTexture) {
      // clear to transparent 1x1
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0,0,0,0]));
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img as TexImageSource);
        gl.generateMipmap(gl.TEXTURE_2D);
      } catch (e) {
        // fallback: ignore
      }
    };
    img.src = deckTexture;
  }, [deckTexture]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />;
}

// Helpers
function hexToRgbNormalized(hex: string) {
  const v = hex.replace('#', '');
  const r = parseInt(v.substring(0, 2), 16) / 255;
  const g = parseInt(v.substring(2, 4), 16) / 255;
  const b = parseInt(v.substring(4, 6), 16) / 255;
  return new Float32Array([r, g, b]);
}
