import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export type ClinicDestination = 'appointments' | 'patients' | 'visits';

type Point = [number, number, number];

// Dimensions use metres. The open front and roof keep the clinic interior visible.
export const createClinicModel = (): THREE.Group => {
  const clinic = new THREE.Group();
  clinic.name = 'Sourire dental clinic';
  const geometryCache = new Map<string, THREE.BufferGeometry>();

  const texture = (kind: 'oak' | 'stone' | 'fabric'): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const context = canvas.getContext('2d')!;
    context.fillStyle = kind === 'oak' ? '#c6a47e' : kind === 'stone' ? '#e9e8e1' : '#cdd9d2';
    context.fillRect(0, 0, 512, 512);
    let seed = 47;
    const random = (): number => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let index = 0; index < 5000; index += 1) {
      const light = random() > 0.5;
      context.fillStyle = light ? 'rgba(255,255,255,0.08)' : 'rgba(60,50,35,0.04)';
      const x = random() * 512;
      const y = random() * 512;
      context.fillRect(
        x,
        y,
        kind === 'oak' ? 0.5 : 1.5,
        kind === 'oak' ? 50 + random() * 200 : 1.5
      );
    }
    if (kind === 'stone') {
      context.strokeStyle = '#c9cdc4';
      context.lineWidth = 2;
      context.strokeRect(1, 1, 510, 510);
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(kind === 'stone' ? 10 : 2, kind === 'stone' ? 7 : 2);
    map.anisotropy = 4;
    return map;
  };

  const materials = {
    chrome: new THREE.MeshStandardMaterial({ color: '#cad7d9', metalness: 0.9, roughness: 0.22 }),
    darkTeal: new THREE.MeshStandardMaterial({ color: '#244e48', roughness: 0.6 }),
    fabric: new THREE.MeshStandardMaterial({ map: texture('fabric'), roughness: 0.95 }),
    floor: new THREE.MeshStandardMaterial({ map: texture('stone'), roughness: 0.52 }),
    foundation: new THREE.MeshStandardMaterial({ color: '#adbfb5', roughness: 0.8 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: '#bedfd8',
      depthWrite: false,
      metalness: 0.1,
      opacity: 0.22,
      roughness: 0.12,
      side: THREE.DoubleSide,
      transparent: true,
    }),
    leaf: new THREE.MeshStandardMaterial({ color: '#437a4f', roughness: 0.72 }),
    leafLight: new THREE.MeshStandardMaterial({ color: '#729c58', roughness: 0.72 }),
    light: new THREE.MeshStandardMaterial({
      color: '#fff7d7',
      emissive: '#fff1cd',
      emissiveIntensity: 2,
    }),
    oak: new THREE.MeshStandardMaterial({ map: texture('oak'), roughness: 0.62 }),
    paper: new THREE.MeshStandardMaterial({ color: '#fff9ec', roughness: 0.8 }),
    pot: new THREE.MeshStandardMaterial({ color: '#deccb6', roughness: 0.9 }),
    quartz: new THREE.MeshPhysicalMaterial({ clearcoat: 0.3, color: '#faf8f0', roughness: 0.24 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#323b3d', roughness: 0.85 }),
    soil: new THREE.MeshStandardMaterial({ color: '#51453a', roughness: 1 }),
    steel: new THREE.MeshStandardMaterial({ color: '#9eaeb0', metalness: 0.65, roughness: 0.38 }),
    teal: new THREE.MeshPhysicalMaterial({ color: '#267f78', roughness: 0.55, sheen: 0.25 }),
    wall: new THREE.MeshStandardMaterial({ color: '#f0eee5', roughness: 0.9 }),
    white: new THREE.MeshStandardMaterial({ color: '#f8faf6', roughness: 0.38 }),
    window: new THREE.MeshStandardMaterial({
      color: '#c7e7e0',
      emissive: '#bad9d7',
      emissiveIntensity: 0.3,
      roughness: 0.22,
    }),
  };

  const mesh = (
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: Point
  ): THREE.Mesh => {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(...position);
    object.castShadow = !material.transparent;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  };

  const box = (
    parent: THREE.Object3D,
    size: Point,
    position: Point,
    material: THREE.Material,
    radius = 0
  ): THREE.Mesh => {
    const key = `${size.join(',')}:${radius}`;
    let geometry = geometryCache.get(key);
    if (!geometry) {
      geometry =
        radius > 0
          ? new RoundedBoxGeometry(
              ...size,
              2,
              Math.min(radius, ...size.map((dimension) => dimension / 2))
            )
          : new THREE.BoxGeometry(...size);
      geometryCache.set(key, geometry);
    }
    return mesh(parent, geometry, material, position);
  };

  const cylinder = (
    parent: THREE.Object3D,
    top: number,
    bottom: number,
    height: number,
    position: Point,
    material: THREE.Material
  ): THREE.Mesh =>
    mesh(parent, new THREE.CylinderGeometry(top, bottom, height, 24), material, position);

  const sphere = (
    parent: THREE.Object3D,
    radius: number,
    position: Point,
    material: THREE.Material
  ): THREE.Mesh => mesh(parent, new THREE.SphereGeometry(radius, 20, 12), material, position);

  const beam = (
    parent: THREE.Object3D,
    from: Point,
    to: Point,
    radius: number,
    material = materials.chrome
  ): THREE.Mesh => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const direction = end.clone().sub(start);
    const object = cylinder(
      parent,
      radius,
      radius,
      direction.length(),
      start.add(end).multiplyScalar(0.5).toArray() as Point,
      material
    );
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return object;
  };

  const tube = (
    parent: THREE.Object3D,
    points: Point[],
    radius: number,
    material: THREE.Material
  ): THREE.Mesh =>
    mesh(
      parent,
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point))),
        32,
        radius,
        8,
        false
      ),
      material,
      [0, 0, 0]
    );

  const group = (name: string, position: Point, destination?: ClinicDestination): THREE.Group => {
    const object = new THREE.Group();
    object.name = name;
    object.position.set(...position);
    if (destination) object.userData.destination = destination;
    clinic.add(object);
    return object;
  };

  const textPanel = (
    parent: THREE.Object3D,
    title: string,
    subtitle: string,
    size: [number, number],
    position: Point,
    background = '#244e48'
  ): THREE.Mesh => {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 256;
    const context = canvas.getContext('2d')!;
    context.fillStyle = background;
    context.fillRect(0, 0, 768, 256);
    context.fillStyle = '#f8faf3';
    context.textAlign = 'center';
    context.font = '500 76px Arial';
    context.fillText(title, 384, 125);
    context.fillStyle = '#c6e0d4';
    context.font = '24px Arial';
    context.fillText(subtitle, 384, 186);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return mesh(
      parent,
      new THREE.PlaneGeometry(...size),
      new THREE.MeshStandardMaterial({ map, roughness: 0.7 }),
      position
    );
  };

  const screenMaterial = (): THREE.MeshStandardMaterial => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 320;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#122e36';
    context.fillRect(0, 0, 512, 320);
    context.fillStyle = '#78c3b2';
    context.fillRect(18, 18, 476, 12);
    context.fillStyle = '#234853';
    context.fillRect(18, 48, 280, 252);
    context.fillStyle = '#dae9e4';
    for (let index = 0; index < 6; index += 1) {
      context.beginPath();
      context.roundRect(
        35 + index * 40,
        115 + Math.abs(index - 2.5) * 10,
        31,
        79,
        [10, 10, 15, 15]
      );
      context.fill();
    }
    context.fillStyle = '#4e7b7e';
    for (let index = 0; index < 7; index += 1)
      context.fillRect(320, 70 + index * 30, index % 2 ? 125 : 156, 9);
    context.fillStyle = '#78c3b2';
    context.fillRect(320, 269, 100, 22);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
      emissive: '#ffffff',
      emissiveIntensity: 0.25,
      emissiveMap: map,
      map,
      roughness: 0.4,
    });
  };

  const displayMaterial = screenMaterial();
  const monitor = (parent: THREE.Object3D, position: Point, scale = 1): THREE.Group => {
    const display = new THREE.Group();
    display.position.set(...position);
    display.scale.setScalar(scale);
    parent.add(display);
    box(display, [0.25, 0.025, 0.18], [0, 0, 0], materials.steel, 0.01);
    beam(display, [0, 0, 0], [0, 0.22, -0.035], 0.025);
    box(display, [0.62, 0.4, 0.045], [0, 0.39, -0.035], materials.rubber, 0.025);
    mesh(display, new THREE.PlaneGeometry(0.565, 0.343), displayMaterial, [0, 0.39, -0.01]);
    return display;
  };

  const plant = (position: Point, scale = 1): void => {
    const planter = group('Indoor plant', position);
    planter.scale.setScalar(scale);
    cylinder(planter, 0.25, 0.19, 0.46, [0, 0.23, 0], materials.pot);
    cylinder(planter, 0.235, 0.235, 0.012, [0, 0.465, 0], materials.soil);
    for (let index = 0; index < 11; index += 1) {
      const angle = index * 2.4;
      const height = 0.7 + (index % 4) * 0.17;
      const tip: Point = [Math.cos(angle) * 0.19, height, Math.sin(angle) * 0.19];
      beam(planter, [0, 0.44, 0], tip, 0.008, materials.leaf);
      const leaf = sphere(planter, 0.17, tip, index % 2 ? materials.leaf : materials.leafLight);
      leaf.scale.set(0.5, 1.5, 0.19);
      leaf.rotation.set(0.4, angle, 0.55);
    }
  };

  // Architectural shell, tiled floor, window opening, and skirting.
  const shell = group('Architecture', [0, 0, 0]);
  box(shell, [10.8, 0.26, 7.6], [0, 0, 0], materials.foundation, 0.06);
  box(shell, [10.64, 0.06, 7.44], [0, 0.16, 0], materials.floor);
  box(shell, [0.16, 2.65, 7.6], [-5.32, 1.515, 0], materials.wall);
  box(shell, [10.8, 0.85, 0.16], [0, 0.615, -3.72], materials.wall);
  box(shell, [10.8, 0.65, 0.16], [0, 2.515, -3.72], materials.wall);
  box(shell, [4.9, 1.15, 0.16], [-2.95, 1.615, -3.72], materials.wall);
  box(shell, [2.6, 1.15, 0.16], [4.1, 1.615, -3.72], materials.wall);
  box(shell, [3.25, 1.16, 0.055], [1.15, 1.615, -3.72], materials.window);
  for (const x of [-0.5, 1.15, 2.8])
    box(shell, [0.045, 1.22, 0.16], [x, 1.615, -3.65], materials.white);
  for (const y of [1.01, 2.22]) box(shell, [3.35, 0.055, 0.22], [1.15, y, -3.63], materials.white);
  box(shell, [3.5, 0.06, 0.32], [1.15, 1.005, -3.6], materials.quartz);
  box(shell, [10.5, 0.12, 0.055], [0, 0.255, -3.6], materials.white);
  box(shell, [0.055, 0.12, 7.35], [-5.2, 0.255, 0], materials.white);
  box(shell, [10.5, 0.035, 0.035], [0, 2.66, -3.62], materials.light);
  box(shell, [0.035, 0.035, 7.2], [-5.2, 2.66, 0], materials.light);
  box(shell, [2.65, 1.65, 0.065], [-3.4, 1.68, -3.61], materials.oak, 0.01);
  textPanel(shell, 'SOURIRE', 'D E N T A L   C L I N I C', [1.96, 0.66], [-3.4, 1.85, -3.567]);

  // Glass separates reception from clinical spaces; the front opening is the doorway.
  const partition = group('Glazed treatment-room partition', [-0.68, 0.19, -1.25]);
  box(partition, [0.1, 0.55, 4.75], [0, 0.275, 0], materials.wall);
  box(partition, [0.035, 1.53, 4.75], [0, 1.33, 0], materials.glass);
  for (const z of [-2.36, -0.78, 0.79, 2.36])
    box(partition, [0.045, 2.12, 0.045], [0, 1.06, z], materials.chrome);
  box(partition, [0.065, 0.045, 4.8], [0, 2.12, 0], materials.chrome);
  box(partition, [0.045, 0.045, 4.8], [0, 0.57, 0], materials.chrome);
  box(shell, [3.1, 0.68, 0.09], [0.92, 0.53, -1.7], materials.wall);
  box(shell, [3.1, 1.3, 0.035], [0.92, 1.52, -1.7], materials.glass);
  box(shell, [3.1, 0.045, 0.045], [0.92, 2.19, -1.7], materials.chrome);
  for (const x of [-0.63, 0.9, 2.47])
    box(shell, [0.045, 2, 0.045], [x, 1.19, -1.7], materials.chrome);

  // Reception desk, workstation, storage, and desk chair.
  const reception = group('Reception', [-3.1, 0.19, 1.9], 'appointments');
  box(reception, [2.6, 0.87, 0.9], [0, 0.435, 0], materials.oak, 0.05);
  box(reception, [2.74, 0.09, 1.03], [0, 0.915, 0], materials.quartz, 0.035);
  for (let index = 0; index < 19; index += 1)
    box(reception, [0.027, 0.7, 0.025], [-1.19 + index * 0.13, 0.44, 0.463], materials.oak);
  textPanel(reception, 'SOURIRE', 'RECEPTION', [0.94, 0.32], [0, 0.49, 0.48]);
  monitor(reception, [-0.58, 0.97, -0.13]);
  box(reception, [0.5, 0.025, 0.17], [-0.56, 0.98, 0.17], materials.rubber, 0.012);
  box(reception, [0.32, 0.025, 0.39], [0.74, 0.98, 0.03], materials.darkTeal, 0.012);
  box(reception, [0.29, 0.012, 0.36], [0.74, 1, 0.03], materials.paper);
  cylinder(reception, 0.055, 0.05, 0.11, [0.28, 1.02, -0.24], materials.white);
  beam(reception, [0.29, 1, -0.24], [0.32, 1.17, -0.23], 0.008, materials.darkTeal);
  const officeChair = group('Reception chair', [-3.08, 0.19, 0.78]);
  cylinder(officeChair, 0.07, 0.07, 0.5, [0, 0.25, 0], materials.chrome);
  box(officeChair, [0.53, 0.11, 0.5], [0, 0.52, 0], materials.darkTeal, 0.05);
  box(officeChair, [0.53, 0.58, 0.11], [0, 0.83, -0.23], materials.darkTeal, 0.05);
  for (let index = 0; index < 5; index += 1) {
    const angle = index * Math.PI * 0.4;
    const x = Math.cos(angle) * 0.33;
    const z = Math.sin(angle) * 0.33;
    beam(officeChair, [0, 0.08, 0], [x, 0.07, z], 0.025);
    sphere(officeChair, 0.046, [x, 0.045, z], materials.rubber);
  }

  // Upholstered waiting area and reading table.
  const waiting = group('Patient lounge', [-4.64, 0.19, -1.4], 'patients');
  waiting.rotation.y = Math.PI / 2;
  box(waiting, [2.65, 0.035, 2.05], [0, 0.02, 0.57], materials.fabric, 0.02);
  box(waiting, [2.5, 0.31, 0.76], [0, 0.28, 0], materials.oak, 0.03);
  box(waiting, [2.5, 0.57, 0.19], [0, 0.69, -0.33], materials.teal, 0.075);
  for (const x of [-0.79, 0, 0.79]) {
    box(waiting, [0.74, 0.16, 0.63], [x, 0.49, 0.06], materials.teal, 0.065);
    box(waiting, [0.73, 0.43, 0.12], [x, 0.72, -0.19], materials.teal, 0.055);
  }
  for (const x of [-1.25, 1.25])
    box(waiting, [0.13, 0.39, 0.75], [x, 0.53, 0], materials.teal, 0.05);
  const table = group('Waiting-room table', [-3.13, 0.19, -1.5], 'patients');
  cylinder(table, 0.045, 0.06, 0.44, [0, 0.22, 0], materials.chrome);
  cylinder(table, 0.29, 0.32, 0.04, [0, 0.04, 0], materials.oak);
  cylinder(table, 0.48, 0.48, 0.065, [0, 0.475, 0], materials.quartz);
  const book = box(table, [0.23, 0.035, 0.32], [0.07, 0.525, 0], materials.darkTeal, 0.005);
  book.rotation.y = 0.3;
  box(table, [0.2, 0.015, 0.29], [-0.06, 0.55, 0.04], materials.paper);

  // Reclining dental chair with hydraulic base, armrests, and footrest.
  const treatment = group('Dental treatment chair', [2.02, 0.19, 0.7], 'visits');
  const base = cylinder(treatment, 0.53, 0.59, 0.105, [0, 0.06, 0.48], materials.steel);
  base.scale.set(0.9, 1, 1.25);
  box(treatment, [0.39, 0.43, 0.54], [0, 0.32, 0.4], materials.white, 0.05);
  cylinder(treatment, 0.135, 0.17, 0.29, [0, 0.68, 0.4], materials.chrome);
  box(treatment, [0.77, 0.13, 0.74], [0, 0.88, 0.35], materials.white, 0.05);
  box(treatment, [0.72, 0.17, 0.72], [0, 0.995, 0.35], materials.teal, 0.065);
  const back = box(treatment, [0.71, 0.18, 1.02], [0, 1.2, -0.45], materials.teal, 0.075);
  back.rotation.x = 0.56;
  const backShell = box(treatment, [0.74, 0.065, 1.06], [0, 1.09, -0.46], materials.white, 0.055);
  backShell.rotation.x = 0.56;
  beam(treatment, [0, 1.37, -0.79], [0, 1.57, -1.11], 0.045);
  const headrest = box(treatment, [0.35, 0.15, 0.3], [0, 1.55, -1.09], materials.teal, 0.06);
  headrest.rotation.x = 0.56;
  const legrest = box(treatment, [0.58, 0.14, 0.86], [0, 0.84, 1.1], materials.teal, 0.06);
  legrest.rotation.x = 0.32;
  const footrest = box(treatment, [0.55, 0.075, 0.33], [0, 0.67, 1.65], materials.rubber, 0.035);
  footrest.rotation.x = 0.32;
  for (const x of [-0.46, 0.46]) {
    beam(treatment, [x, 0.86, 0.24], [x, 1.14, 0.35], 0.025);
    box(treatment, [0.105, 0.085, 0.61], [x, 1.15, 0.37], materials.white, 0.04);
  }

  // Delivery unit, handpieces, hanging hoses, and spittoon.
  box(treatment, [0.42, 0.87, 0.51], [0.82, 0.49, -0.39], materials.white, 0.045);
  beam(treatment, [-0.14, 0.84, -0.23], [-0.87, 1.02, -0.28], 0.04);
  box(treatment, [0.69, 0.12, 0.43], [-0.92, 1.05, -0.2], materials.white, 0.04);
  box(treatment, [0.44, 0.015, 0.22], [-0.92, 1.122, -0.22], materials.steel, 0.012);
  for (let index = 0; index < 4; index += 1) {
    const x = -1.16 + index * 0.15;
    cylinder(treatment, 0.019, 0.024, 0.14, [x, 1.09, 0.06], materials.chrome);
    tube(
      treatment,
      [
        [x, 1.01, 0.06],
        [x - 0.08, 0.51, 0.17],
        [x + 0.02, 0.39, -0.12],
        [0.71, 0.67, -0.4],
      ],
      0.012,
      materials.white
    );
  }
  mesh(
    treatment,
    new THREE.SphereGeometry(0.22, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    materials.quartz,
    [0.82, 1, -0.36]
  );
  const rim = mesh(
    treatment,
    new THREE.TorusGeometry(0.22, 0.02, 10, 32),
    materials.white,
    [0.82, 1, -0.36]
  );
  rim.rotation.x = Math.PI / 2;
  tube(
    treatment,
    [
      [0.98, 1, -0.54],
      [0.98, 1.23, -0.54],
      [0.84, 1.25, -0.44],
    ],
    0.017,
    materials.chrome
  );
  const patientMonitor = monitor(treatment, [1.08, 1.11, -0.49], 0.85);
  patientMonitor.rotation.y = -0.3;

  // Articulated overhead examination light and illuminated lens.
  beam(treatment, [0.82, 0.65, -0.64], [0.82, 2.26, -0.64], 0.047, materials.white);
  beam(treatment, [0.82, 2.26, -0.64], [0.06, 2.38, -0.66], 0.04, materials.white);
  beam(treatment, [0.06, 2.38, -0.66], [-0.29, 2.08, -0.23], 0.032, materials.white);
  for (const position of [
    [0.82, 2.26, -0.64],
    [0.06, 2.38, -0.66],
  ] as Point[])
    sphere(treatment, 0.075, position, materials.steel);
  box(treatment, [0.51, 0.16, 0.34], [-0.29, 2.03, -0.23], materials.white, 0.055);
  box(treatment, [0.41, 0.015, 0.255], [-0.29, 1.94, -0.23], materials.light, 0.025);
  for (const x of [-0.61, 0.03]) beam(treatment, [x, 1.96, -0.23], [x, 2.09, -0.23], 0.018);
  const examLight = new THREE.SpotLight('#fff8df', 3, 4, 0.52, 0.8, 2);
  examLight.position.set(-0.29, 1.94, -0.23);
  examLight.target.position.set(0, 0.9, -0.23);
  treatment.add(examLight, examLight.target);

  // Doctor's rolling stool.
  const stool = group('Doctor stool', [0.63, 0.19, 1.85], 'visits');
  cylinder(stool, 0.29, 0.29, 0.11, [0, 0.65, 0], materials.teal);
  cylinder(stool, 0.045, 0.045, 0.48, [0, 0.36, 0], materials.chrome);
  box(stool, [0.4, 0.2, 0.075], [0, 0.92, -0.2], materials.teal, 0.04);
  beam(stool, [0, 0.59, -0.2], [0, 0.9, -0.2], 0.02);
  for (let index = 0; index < 5; index += 1) {
    const angle = index * Math.PI * 0.4;
    const x = Math.cos(angle) * 0.34;
    const z = Math.sin(angle) * 0.34;
    beam(stool, [0, 0.12, 0], [x, 0.07, z], 0.024);
    sphere(stool, 0.055, [x, 0.055, z], materials.rubber);
  }

  const trolley = group('Instrument trolley', [4.1, 0.19, 1.73], 'visits');
  for (const x of [-0.3, 0.3]) {
    for (const z of [-0.2, 0.2]) {
      beam(trolley, [x, 0.06, z], [x, 0.88, z], 0.022);
      sphere(trolley, 0.047, [x, 0.047, z], materials.rubber);
    }
  }
  for (const y of [0.2, 0.55, 0.88])
    box(trolley, [0.7, 0.045, 0.51], [0, y, 0], materials.white, 0.025);
  box(trolley, [0.56, 0.018, 0.38], [0, 0.91, 0], materials.steel, 0.025);
  for (let index = 0; index < 4; index += 1)
    beam(trolley, [-0.2 + index * 0.12, 0.925, -0.13], [-0.18 + index * 0.12, 0.925, 0.13], 0.007);
  box(trolley, [0.27, 0.14, 0.28], [0, 0.29, 0], materials.teal, 0.015);

  // Sterilization cabinetry, sink, sterilizer, and upper supply shelves.
  const prep = group('Sterilization area', [2.3, 0.19, -3.17]);
  for (const x of [-1.95, -1.14, -0.33, 0.48, 1.29, 2.1]) {
    box(prep, [0.79, 0.85, 0.71], [x, 0.425, 0], materials.oak, 0.015);
    box(prep, [0.75, 0.76, 0.022], [x, 0.45, 0.37], materials.white, 0.01);
    beam(prep, [x - 0.12, 0.74, 0.397], [x + 0.12, 0.74, 0.397], 0.01);
  }
  box(prep, [4.91, 0.065, 0.79], [0.075, 0.89, 0], materials.quartz, 0.018);
  box(prep, [0.65, 0.012, 0.44], [-1.5, 0.93, 0], materials.steel, 0.1);
  box(prep, [0.5, 0.016, 0.31], [-1.5, 0.935, 0], materials.rubber, 0.08);
  tube(
    prep,
    [
      [-1.5, 0.95, -0.24],
      [-1.5, 1.3, -0.24],
      [-1.5, 1.32, -0.03],
      [-1.5, 1.2, 0],
    ],
    0.017,
    materials.chrome
  );
  box(prep, [0.8, 0.59, 0.58], [1.5, 1.23, 0], materials.white, 0.045);
  box(prep, [0.72, 0.51, 0.025], [1.5, 1.23, 0.305], materials.steel, 0.025);
  const sterilizerDoor = cylinder(prep, 0.195, 0.195, 0.035, [1.4, 1.23, 0.34], materials.rubber);
  sterilizerDoor.rotation.x = Math.PI / 2;
  const innerDoor = cylinder(prep, 0.147, 0.147, 0.04, [1.4, 1.23, 0.36], materials.steel);
  innerDoor.rotation.x = Math.PI / 2;
  box(prep, [0.13, 0.08, 0.02], [1.76, 1.36, 0.33], materials.darkTeal, 0.005);
  box(prep, [1.77, 0.73, 0.32], [1.3, 1.94, -0.28], materials.white, 0.018);
  for (const x of [0.87, 1.74]) {
    box(prep, [0.82, 0.68, 0.025], [x, 1.94, -0.102], materials.quartz, 0.012);
    beam(prep, [x - 0.2, 1.87, -0.07], [x - 0.2, 2.02, -0.07], 0.012);
  }
  for (const y of [1.57, 2.13]) {
    box(prep, [1.27, 0.045, 0.34], [-0.15, y, -0.28], materials.oak);
    for (let index = 0; index < 4; index += 1) {
      cylinder(
        prep,
        0.065,
        0.065,
        0.18,
        [-0.56 + index * 0.27, y + 0.12, -0.27],
        index % 2 ? materials.white : materials.teal
      );
      cylinder(prep, 0.067, 0.067, 0.028, [-0.56 + index * 0.27, y + 0.22, -0.27], materials.steel);
    }
  }

  const bin = group('Clinical waste bin', [4.83, 0.19, -0.6]);
  cylinder(bin, 0.19, 0.16, 0.48, [0, 0.24, 0], materials.white);
  cylinder(bin, 0.2, 0.2, 0.055, [0, 0.5, 0], materials.teal);
  box(bin, [0.13, 0.025, 0.1], [0, 0.025, 0.18], materials.steel, 0.01);
  plant([-4.57, 0.19, 3.01], 1.05);
  plant([4.8, 0.19, -3.08], 0.8);
  plant([-1.54, 0.19, -3.07], 0.68);

  return clinic;
};

export const disposeClinicModel = (root: THREE.Object3D): void => {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of meshMaterials) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
};
