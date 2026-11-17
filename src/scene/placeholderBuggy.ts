import * as THREE from "three";
import type { Buggy, PartId } from "./buggyTypes";

/** Stand-in with the same API as buggy.ts, used only until the real model is ready. */
export function createPlaceholderBuggy(): Buggy {
  const root = new THREE.Group();
  const chassis = new THREE.Group();
  root.add(chassis);
  const frame = new THREE.MeshStandardMaterial({ color: 0xe8b400, metalness: 0.3, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 2.2), frame);
  body.position.y = 0.6; chassis.add(body);
  const tyre = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  for (const [x, z] of [[-0.75, 0.75], [0.75, 0.75], [-0.75, -0.8], [0.75, -0.8]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.25, 24), tyre);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.29, z); chassis.add(w);
  }
  const spec: [PartId, number, [number, number, number], [number, number, number], [number, number, number]][] = [
    ["steering", 0xdddddd, [0.3, 0.3, 0.06], [0, 1.0, 0.25], [0, 0.6, 0.6]],
    ["accelerator", 0xff7a1a, [0.2, 0.1, 0.2], [0.1, 0.45, 0.8], [0.6, 0.3, 0.7]],
    ["engine", 0x777777, [0.5, 0.4, 0.4], [0, 0.75, -0.85], [0, 0.7, -0.7]],
    ["brakes", 0xd2261b, [0.08, 0.3, 0.3], [0.95, 0.29, 0.75], [0.8, 0.3, 0.3]],
    ["fuel", 0x3a3a3a, [0.4, 0.25, 0.2], [0, 1.0, -0.45], [-0.6, 0.7, -0.3]],
    ["nav", 0x2266ff, [0.18, 0.12, 0.03], [0.3, 1.1, 0.45], [0.5, 0.7, 0.4]],
    ["cluster", 0x22aa66, [0.3, 0.12, 0.05], [-0.15, 1.05, 0.45], [-0.5, 0.7, 0.5]],
  ];
  const parts = {} as Record<PartId, THREE.Group>;
  for (const [id, color, size, pos, ex] of spec) {
    const g = new THREE.Group(); g.name = id; g.userData.partId = id;
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.4 }));
    m.userData.partId = id; m.castShadow = true; g.add(m);
    g.position.set(...pos);
    g.userData.explode = new THREE.Vector3(...ex);
    g.userData.anchor = new THREE.Vector3(pos[0], pos[1] + size[1] / 2 + 0.05, pos[2]);
    root.add(g); parts[id] = g;
  }
  root.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  return { root, parts, chassis, update: () => {} };
}
