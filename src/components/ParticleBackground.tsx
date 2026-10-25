import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

/** Full-screen WebGL field: drifting particles that repel from the pointer and flush lime,
 *  plus dashed energy lines streaming toward the camera. */
export default function ParticleBackground() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    if (/[?&]nogl\b/.test(window.location.search)) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.innerWidth < 760;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" });
    } catch {
      return; // no WebGL: the page background colour carries on alone
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    // The composer chain encodes the clear colour to sRGB a second time, so hand it the pre-linearised value.
    const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const BG = new THREE.Color().setRGB(lin(3), lin(0), lin(20), THREE.SRGBColorSpace);
    renderer.setClearColor(BG, 1);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(BG.getHex(), 0.009);
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 400);
    camera.position.set(0, 0, 60);

    // ---------- particles ----------
    const COUNT = small ? 6000 : 15000;
    const pos = new Float32Array(COUNT * 3);
    const home = new Float32Array(COUNT * 3);
    const vel = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);
    const base = new THREE.Color(0x1d3270);
    const lime = new THREE.Color(0xccff00);
    const mixAmt = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      const x = (Math.random() - 0.5) * 220, y = (Math.random() - 0.5) * 140, z = (Math.random() - 0.5) * 160 - 20;
      pos[i * 3] = home[i * 3] = x; pos[i * 3 + 1] = home[i * 3 + 1] = y; pos[i * 3 + 2] = home[i * 3 + 2] = z;
      col[i * 3] = base.r; col[i * 3 + 1] = base.g; col[i * 3 + 2] = base.b;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    pGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const sprite = (() => {
      const c = document.createElement("canvas"); c.width = c.height = 64;
      const g = c.getContext("2d")!; const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
    })();
    const pMat = new THREE.PointsMaterial({ size: 0.55, map: sprite, vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    const points = new THREE.Points(pGeo, pMat);
    scene.add(points);

    // ---------- energy lines ----------
    const LINES = small ? 220 : 530;
    const lPos = new Float32Array(LINES * 6);
    const lSpeed = new Float32Array(LINES);
    const seed = (i: number, z?: number) => {
      const x = (Math.random() - 0.5) * 200, y = (Math.random() - 0.5) * 120, zz = z ?? -220 + Math.random() * 40, len = 4 + Math.random() * 14;
      lPos.set([x, y, zz, x, y, zz + len], i * 6); lSpeed[i] = 0.25 + Math.random() * 0.9;
    };
    for (let i = 0; i < LINES; i++) seed(i, -220 + Math.random() * 280);
    const lGeo = new THREE.BufferGeometry();
    lGeo.setAttribute("position", new THREE.BufferAttribute(lPos, 3));
    const lMat = new THREE.LineDashedMaterial({ color: 0x88aaff, transparent: true, opacity: 0.2, dashSize: 1.2, gapSize: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
    const lines = new THREE.LineSegments(lGeo, lMat);
    lines.computeLineDistances();
    scene.add(lines);

    // ---------- bloom ----------
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.8, 0.1, 0.35);
    const qs = window.location.search;
    if (!/nobloom/.test(qs)) composer.addPass(bloom);
    composer.addPass(new OutputPass());

    // ---------- pointer ----------
    const ndc = new THREE.Vector2(9, 9);
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const hit = new THREE.Vector3(9999, 9999, 0);
    let active = false;
    const onMove = (e: PointerEvent) => {
      ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      active = true;
    };
    const onLeave = () => { active = false; };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight); composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    let scrollY = window.scrollY;
    const onScroll = () => { scrollY = window.scrollY; };
    window.addEventListener("scroll", onScroll, { passive: true });

    let raf = 0, t = 0, running = true;
    const R = 12, R2 = R * R;
    const frame = () => {
      if (!running) return;
      t += 0.016;
      if (active) {
        ray.setFromCamera(ndc, camera);
        ray.ray.intersectPlane(plane, hit);
      } else hit.set(9999, 9999, 0);

      for (let i = 0; i < COUNT; i++) {
        const ix = i * 3;
        let x = pos[ix], y = pos[ix + 1];
        const dx = x - hit.x, dy = y - hit.y, d2 = dx * dx + dy * dy;
        if (d2 < R2 && Math.abs(pos[ix + 2]) < 40) {
          const d = Math.sqrt(d2) || 0.001, f = (1 - d / R) * 0.04 * R;
          vel[ix] += (dx / d) * f * 0.12; vel[ix + 1] += (dy / d) * f * 0.12;
          mixAmt[i] = Math.min(0.75, mixAmt[i] + 0.1);
        }
        // spring home + damping
        vel[ix] += (home[ix] - x) * 0.012; vel[ix + 1] += (home[ix + 1] - y) * 0.012;
        vel[ix] *= 0.88; vel[ix + 1] *= 0.88;
        x += vel[ix]; y += vel[ix + 1];
        pos[ix] = x; pos[ix + 1] = y + Math.sin(t * 0.6 + home[ix] * 0.05) * 0.006;
        if (mixAmt[i] > 0) {
          mixAmt[i] *= 0.965;
          const m = Math.min(1, mixAmt[i]);
          col[ix] = base.r + (lime.r - base.r) * m; col[ix + 1] = base.g + (lime.g - base.g) * m; col[ix + 2] = base.b + (lime.b - base.b) * m;
          if (mixAmt[i] < 0.002) mixAmt[i] = 0;
        }
      }
      pGeo.attributes.position.needsUpdate = true;
      pGeo.attributes.color.needsUpdate = true;

      for (let i = 0; i < LINES; i++) {
        const o = i * 6, s = lSpeed[i] * (reduce ? 0 : 1);
        lPos[o + 2] += s; lPos[o + 5] += s;
        if (lPos[o + 2] > 70) seed(i);
      }
      lGeo.attributes.position.needsUpdate = true;

      points.rotation.y = Math.sin(t * 0.05) * 0.08;
      points.rotation.x = scrollY * 0.00012;
      camera.position.y = -scrollY * 0.004;
      composer.render();
      raf = requestAnimationFrame(frame);
    };
    frame();
    const onVis = () => { running = !document.hidden; cancelAnimationFrame(raf); if (running) frame(); };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      running = false; cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove); document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", onResize); window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVis);
      pGeo.dispose(); pMat.dispose(); sprite.dispose(); lGeo.dispose(); lMat.dispose();
      composer.dispose(); renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} aria-hidden="true" className="fixed inset-0 z-0 pointer-events-none" />;
}
