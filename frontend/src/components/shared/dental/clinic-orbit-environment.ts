import * as THREE from 'three';

type ClinicOrbitEnvironment = {
  group: THREE.Group;
  update: (elapsed: number) => void;
};

/** A real, lit stage around the clinic; disposed with the rest of the Three.js scene. */
export const createClinicOrbitEnvironment = (): ClinicOrbitEnvironment => {
  const group = new THREE.Group();
  group.name = 'Floating clinic atlas';

  const ivory = new THREE.MeshStandardMaterial({
    color: '#f2f1de',
    metalness: 0.04,
    roughness: 0.58,
  });
  const mint = new THREE.MeshPhysicalMaterial({
    clearcoat: 0.25,
    color: '#a6cbb8',
    metalness: 0.13,
    roughness: 0.4,
  });
  const teal = new THREE.MeshStandardMaterial({
    color: '#214f48',
    metalness: 0.38,
    roughness: 0.42,
  });
  const brass = new THREE.MeshStandardMaterial({
    color: '#bca577',
    metalness: 0.72,
    roughness: 0.32,
  });
  const orbitMaterial = new THREE.MeshStandardMaterial({
    color: '#94b4a1',
    metalness: 0.38,
    opacity: 0.58,
    roughness: 0.52,
    transparent: true,
  });

  const addMesh = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: [number, number, number],
    shadow = false
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  // The clinic's foundation sits at y = -0.13. The top of this stage meets it exactly.
  addMesh(new THREE.CylinderGeometry(7.05, 7.3, 0.36, 128), ivory, [0, -0.31, 0], true);
  addMesh(new THREE.CylinderGeometry(7.3, 7.2, 0.23, 128), teal, [0, -0.605, 0], true);
  addMesh(new THREE.CylinderGeometry(7.2, 6.82, 0.22, 128), mint, [0, -0.83, 0], true);

  const ring = (
    radius: number,
    thickness: number,
    height: number,
    material: THREE.Material,
    arc = Math.PI * 2
  ): THREE.Mesh => {
    const mesh = addMesh(new THREE.TorusGeometry(radius, thickness, 8, 128, arc), material, [
      0,
      height,
      0,
    ]);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  };

  ring(7.29, 0.028, -0.51, brass);
  ring(8.12, 0.012, -0.79, orbitMaterial);
  ring(9.04, 0.014, -1.16, orbitMaterial);
  const brassArc = ring(8.14, 0.032, -0.77, brass, Math.PI * 0.57);
  brassArc.rotation.z = Math.PI * 0.15;
  const mintArc = ring(9.05, 0.036, -1.14, mint, Math.PI * 0.3);
  mintArc.rotation.z = Math.PI * 1.08;

  // Small physical index marks make the outer orbit read as a spatial instrument.
  const indexGeometry = new THREE.BoxGeometry(0.018, 0.018, 0.13);
  for (let index = 0; index < 48; index += 1) {
    const angle = (index / 48) * Math.PI * 2;
    const mark = addMesh(indexGeometry, brass, [
      Math.sin(angle) * 8.42,
      -0.8,
      Math.cos(angle) * 8.42,
    ]);
    mark.rotation.y = angle;
    if (index % 4 === 0) mark.scale.z = 2;
  }

  const satelliteGeometry = new THREE.SphereGeometry(0.19, 24, 16);
  const satelliteA = addMesh(satelliteGeometry, brass, [-7.74, 0.2, 2.5]);
  const satelliteB = addMesh(new THREE.IcosahedronGeometry(0.31, 1), mint, [6.35, 0.5, -5.9]);
  const satelliteC = addMesh(new THREE.SphereGeometry(0.12, 20, 12), ivory, [6.9, -0.1, 5.86]);
  const satellites = [satelliteA, satelliteB, satelliteC].map((mesh) => ({
    baseHeight: mesh.position.y,
    mesh,
  }));

  return {
    group,
    update: (elapsed) => {
      satellites.forEach(({ baseHeight, mesh }, index) => {
        mesh.position.y = baseHeight + Math.sin(elapsed * 0.65 + index * 2) * 0.14;
      });
      satelliteB.rotation.y = elapsed * 0.16;
      satelliteB.rotation.z = elapsed * 0.08;
    },
  };
};
