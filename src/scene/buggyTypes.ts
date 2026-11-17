import type * as THREE from "three";
export type PartId = "steering" | "accelerator" | "engine" | "brakes" | "fuel" | "nav" | "cluster";
export interface Buggy {
  root: THREE.Group;
  parts: Record<PartId, THREE.Group>;
  chassis: THREE.Group;
  update(dt: number, t: number): void;
}
