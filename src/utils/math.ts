import * as THREE from 'three';

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const smootherstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

export const mapRange = (value: number, inMin: number, inMax: number, outMin: number, outMax: number): number =>
  outMin + (outMax - outMin) * ((value - inMin) / (inMax - inMin));

export const degToRad = (deg: number): number => deg * (Math.PI / 180);

export const radToDeg = (rad: number): number => rad * (180 / Math.PI);

export const randomInRange = (min: number, max: number): number => Math.random() * (max - min) + min;

export const randomInt = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;

export function setQuaternionFromDirection(quat: THREE.Quaternion, dir: THREE.Vector3, up = new THREE.Vector3(0, 1, 0)): void {
  const matrix = new THREE.Matrix4();
  matrix.lookAt(new THREE.Vector3(0, 0, 0), dir, up);
  quat.setFromRotationMatrix(matrix);
}

export function getForwardVector(quat: THREE.Quaternion): THREE.Vector3 {
  return new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
}

export function getRightVector(quat: THREE.Quaternion): THREE.Vector3 {
  return new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
}

export function calculateYawPitch(from: THREE.Vector3, to: THREE.Vector3): { yaw: number; pitch: number } {
  const dir = new THREE.Vector3().subVectors(to, from).normalize();
  const yaw = Math.atan2(dir.x, dir.z);
  const pitch = Math.asin(clamp(dir.y, -1, 1));
  return { yaw, pitch };
}

export function sphericalToCartesian(radius: number, theta: number, phi: number): THREE.Vector3 {
  const sinPhi = Math.sin(phi);
  return new THREE.Vector3(
    radius * sinPhi * Math.sin(theta),
    radius * Math.cos(phi),
    radius * sinPhi * Math.cos(theta)
  );
}

export function cartesianToSpherical(v: THREE.Vector3): { radius: number; theta: number; phi: number } {
  const radius = v.length();
  const theta = Math.atan2(v.x, v.z);
  const phi = Math.acos(clamp(v.y / radius, -1, 1));
  return { radius, theta, phi };
}

export function nearestPowerOfTwo(n: number): number {
  return Math.pow(2, Math.round(Math.log2(n)));
}

export function isPowerOfTwo(n: number): boolean {
  return (n & (n - 1)) === 0 && n !== 0;
}