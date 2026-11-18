import * as THREE from 'three';

type Activity = 'records' | 'treatment' | 'preparation';
type Stop = { x: number; z: number; activity?: Activity; facing?: number };
type Limb = { joint: THREE.Group; bend: THREE.Group; hand: THREE.Group };
type Profile = [height: number, width: number, depth: number, offset?: number];

// Elliptical cross sections give clothing and anatomy continuous, tailored silhouettes.
const profileGeometry = (profile: Profile[]): THREE.BufferGeometry => {
  const segments = 24;
  const vertices: number[] = [];
  const indices: number[] = [];
  for (const [height, width, depth, offset = 0] of profile) {
    for (let segment = 0; segment <= segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      vertices.push(Math.cos(angle) * width, height, Math.sin(angle) * depth + offset);
    }
  }
  for (let ring = 0; ring < profile.length - 1; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const a = ring * (segments + 1) + segment;
      const b = a + segments + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

type Doctor = {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  arms: [Limb, Limb];
  legs: [Limb, Limb];
  clipboard: THREE.Group;
  tool: THREE.Mesh;
  route: Stop[];
  stop: number;
  working: boolean;
  remaining: number;
  phase: number;
  elapsed: number;
  workBlend: number;
  walkBlend: number;
  speed: number;
  greeting: number;
  greetingCooldown: number;
};

/** Metre-scale staff following aisles in clinic-model.ts. All resources are scene-owned. */
export const createClinicStaff = (): {
  group: THREE.Group;
  setAttention: (point: THREE.Vector3 | null, doctorIndex?: number) => void;
  update: (delta: number) => void;
} => {
  const group = new THREE.Group();
  group.name = 'Clinic doctors';
  const sphere = new THREE.SphereGeometry(1, 24, 16);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const hairCap = new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.56);
  const torsoGeometry = profileGeometry([
    [0.86, 0, 0],
    [0.87, 0.174, 0.104],
    [0.96, 0.177, 0.108],
    [1.09, 0.157, 0.097],
    [1.26, 0.185, 0.111],
    [1.37, 0.205, 0.107],
    [1.435, 0.207, 0.086],
    [1.485, 0.103, 0.065],
    [1.5, 0.059, 0.053],
  ]);
  const headGeometry = profileGeometry([
    [-0.114, 0, 0, 0.024],
    [-0.103, 0.036, 0.044, 0.018],
    [-0.079, 0.061, 0.067, 0.009],
    [-0.029, 0.079, 0.083],
    [0.033, 0.083, 0.091, -0.004],
    [0.075, 0.077, 0.086, -0.007],
    [0.111, 0.058, 0.063, -0.009],
    [0.131, 0, 0, -0.01],
  ]);
  const sleeveGeometry = profileGeometry([
    [-0.3, 0.041, 0.043],
    [-0.265, 0.045, 0.047],
    [-0.16, 0.053, 0.054],
    [-0.045, 0.065, 0.062],
    [0.022, 0.039, 0.04],
    [0.038, 0, 0],
  ]);
  const forearmGeometry = profileGeometry([
    [-0.255, 0.029, 0.032],
    [-0.215, 0.032, 0.034],
    [-0.12, 0.042, 0.041],
    [-0.025, 0.041, 0.043],
    [0.016, 0.025, 0.028],
    [0.025, 0, 0],
  ]);
  const thighGeometry = profileGeometry([
    [-0.415, 0.058, 0.062],
    [-0.32, 0.066, 0.07],
    [-0.18, 0.083, 0.084],
    [-0.055, 0.089, 0.091],
    [0.035, 0.073, 0.073],
    [0.06, 0, 0],
  ]);
  const shinGeometry = profileGeometry([
    [-0.415, 0.043, 0.048],
    [-0.34, 0.046, 0.053],
    [-0.19, 0.062, 0.067],
    [-0.06, 0.059, 0.064],
    [0.018, 0.04, 0.046],
    [0.029, 0, 0],
  ]);
  const material = (color: string): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.78 });
  const coat = material('#e9eeed');
  const seam = material('#bfcacb');
  const shoes = material('#e0e5e4');
  const gloves = material('#c1d5e0');
  const mask = material('#a8c7d0');
  const paper = material('#fcf7e8');
  const board = material('#546d82');
  const metal = material('#899ca5');
  const dark = material('#26383f');

  const add = (
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    surface: THREE.Material,
    position: [number, number, number],
    scale: [number, number, number]
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(geometry, surface);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    // Soft contact shadows move with the doctors; the architecture keeps its cached shadow map.
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const stitch = (
    parent: THREE.Object3D,
    points: THREE.Vector3[],
    surface = seam,
    radius = 0.002
  ): void => {
    add(
      parent,
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 12, radius, 5, false),
      surface,
      [0, 0, 0],
      [1, 1, 1]
    );
  };

  const routes: Stop[][] = [
    [
      { activity: 'records', facing: 0, x: -2.25, z: 0.95 },
      { x: -1.45, z: 0.55 },
      { activity: 'records', facing: -Math.PI / 2, x: -1.45, z: -1.8 },
      { activity: 'records', facing: -0.7, x: -2.25, z: -2.35 },
      { x: -1.45, z: -1.8 },
      { x: -1.45, z: 0.55 },
    ],
    [
      { activity: 'treatment', facing: 0, x: 1.85, z: -0.95 },
      { x: 0.05, z: -0.95 },
      { x: 0.05, z: 2.8 },
      { activity: 'records', facing: -0.5, x: 1.1, z: 2.95 },
      { x: 0.05, z: 2.8 },
      { x: 0.05, z: -0.95 },
    ],
    [
      { activity: 'preparation', facing: Math.PI, x: 3.7, z: -2.3 },
      { activity: 'preparation', facing: Math.PI, x: 2.2, z: -2.3 },
      { activity: 'preparation', facing: Math.PI, x: 0.8, z: -2.3 },
      { x: 2.2, z: -2.3 },
    ],
  ];
  const appearances = [
    { hair: '#302722', scrubs: '#405c71', skin: '#bd865e' },
    { hair: '#5b3d2d', scrubs: '#536f7a', skin: '#e3b691' },
    { hair: '#252629', scrubs: '#49686d', skin: '#82553f' },
  ];
  const appearanceOffset = Math.floor(Math.random() * appearances.length);

  const doctors = routes.map((route, index): Doctor => {
    const appearance = appearances[(index + appearanceOffset) % appearances.length];
    const skin = material(appearance.skin);
    const hair = material(appearance.hair);
    const scrubs = material(appearance.scrubs);
    const root = new THREE.Group();
    root.name = ['Records doctor', 'Treatment doctor', 'Sterilization doctor'][index];
    root.userData.destination = index === 0 ? 'appointments' : 'visits';
    root.userData.clinicStaffIndex = index;
    root.position.set(route[0].x, 0.19, route[0].z);
    root.rotation.y = route[0].facing ?? 0;
    group.add(root);

    const contactShadow = add(
      root,
      new THREE.CircleGeometry(0.24, 20),
      new THREE.MeshBasicMaterial({
        color: '#182733',
        depthWrite: false,
        opacity: 0.12,
        transparent: true,
      }),
      [0, 0.006, 0],
      [1, 0.72, 1]
    );
    contactShadow.rotation.x = -Math.PI / 2;

    const body = new THREE.Group();
    root.add(body);
    const uniform = index === 2 ? scrubs : coat;
    add(body, torsoGeometry, uniform, [0, 0, 0], [1, 1, 1]);
    add(body, box, scrubs, [0, 1.366, 0.106], [0.092, 0.17, 0.013]);
    // Flat lapels, pockets, seams, and a small ID badge replace the toy-like body shapes.
    for (const side of [-1, 1]) {
      const lapel = new THREE.BufferGeometry();
      lapel.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
          [side * 0.049, 1.488, 0.056, side * 0.107, 1.404, 0.107, side * 0.029, 1.289, 0.117],
          3
        )
      );
      lapel.setIndex(side > 0 ? [0, 2, 1] : [0, 1, 2]);
      lapel.computeVertexNormals();
      add(body, lapel, uniform, [0, 0, 0], [1, 1, 1]);
      const pocketX = side * 0.107;
      stitch(body, [
        new THREE.Vector3(pocketX - 0.037, 1.043, 0.086),
        new THREE.Vector3(pocketX - 0.033, 0.976, 0.092),
        new THREE.Vector3(pocketX + 0.033, 0.976, 0.092),
        new THREE.Vector3(pocketX + 0.037, 1.043, 0.086),
      ]);
    }
    stitch(body, [
      new THREE.Vector3(0, 0.883, 0.105),
      new THREE.Vector3(0, 1.092, 0.099),
      new THREE.Vector3(0, 1.281, 0.114),
    ]);
    add(body, box, board, [0.105, 1.302, 0.099], [0.055, 0.073, 0.005]);
    add(body, box, paper, [0.105, 1.295, 0.103], [0.044, 0.049, 0.004]);
    add(body, box, metal, [0.105, 1.347, 0.102], [0.022, 0.015, 0.006]);
    add(body, sphere, skin, [0, 1.521, 0], [0.047, 0.069, 0.046]);

    const head = new THREE.Group();
    head.position.y = 1.652;
    body.add(head);
    add(head, headGeometry, skin, [0, 0, 0], [1, 1, 1]);
    add(head, hairCap, hair, [0, 0.047, -0.009], [0.085, 0.089, 0.094]);
    if (index === 2) add(head, sphere, hair, [0, 0.025, -0.099], [0.043, 0.037, 0.036]);
    // A contoured surgical mask and narrow eyes keep the face in adult scale.
    add(head, sphere, mask, [0, -0.04, 0.069], [0.076, 0.041, 0.041]);
    add(head, sphere, skin, [0, 0.007, 0.087], [0.012, 0.026, 0.013]);
    for (const y of [-0.053, -0.035])
      stitch(
        head,
        [
          new THREE.Vector3(-0.05, y, 0.092),
          new THREE.Vector3(0, y - 0.002, 0.111),
          new THREE.Vector3(0.05, y, 0.092),
        ],
        coat,
        0.001
      );
    for (const side of [-1, 1]) {
      add(head, sphere, skin, [side * 0.081, -0.013, -0.004], [0.013, 0.026, 0.016]);
      add(head, sphere, dark, [side * 0.033, 0.019, 0.08], [0.009, 0.0035, 0.003]);
      stitch(
        head,
        [
          new THREE.Vector3(side * 0.022, 0.032, 0.081),
          new THREE.Vector3(side * 0.034, 0.035, 0.079),
          new THREE.Vector3(side * 0.046, 0.031, 0.073),
        ],
        hair,
        0.002
      );
      stitch(
        head,
        [
          new THREE.Vector3(side * 0.066, -0.023, 0.09),
          new THREE.Vector3(side * 0.091, -0.007, 0),
          new THREE.Vector3(side * 0.064, -0.065, 0.077),
        ],
        coat,
        0.0014
      );
    }

    const limb = (side: number, arm: boolean): Limb => {
      const joint = new THREE.Group();
      joint.position.set(side * (arm ? 0.211 : 0.091), arm ? 1.423 : 0.905, 0);
      body.add(joint);
      const length = arm ? 0.3 : 0.415;
      add(
        joint,
        arm ? sleeveGeometry : thighGeometry,
        arm ? uniform : scrubs,
        [0, 0, 0],
        [1, 1, 1]
      );
      const bend = new THREE.Group();
      bend.position.y = -length;
      joint.add(bend);
      add(bend, arm ? forearmGeometry : shinGeometry, arm ? uniform : scrubs, [0, 0, 0], [1, 1, 1]);
      const hand = new THREE.Group();
      hand.position.y = arm ? -0.255 : -0.415;
      bend.add(hand);
      if (arm) {
        add(hand, sphere, gloves, [0, -0.046, 0.002], [0.032, 0.05, 0.02]);
        for (let finger = 0; finger < 4; finger += 1)
          add(
            hand,
            sphere,
            gloves,
            [-0.023 + finger * 0.015, -0.107, 0.012],
            [0.008, 0.032 - Math.abs(finger - 1.5) * 0.005, 0.009]
          );
        const thumb = add(
          hand,
          sphere,
          gloves,
          [side * -0.035, -0.051, 0.011],
          [0.011, 0.032, 0.012]
        );
        thumb.rotation.z = side * -0.35;
      } else {
        add(hand, sphere, shoes, [0, -0.03, 0.051], [0.052, 0.044, 0.127]);
        add(hand, box, seam, [0, -0.065, 0.049], [0.096, 0.018, 0.231]);
      }
      return { bend, hand, joint };
    };
    const arms: [Limb, Limb] = [limb(-1, true), limb(1, true)];
    const legs: [Limb, Limb] = [limb(-1, false), limb(1, false)];
    const clipboard = new THREE.Group();
    arms[0].hand.add(clipboard);
    clipboard.rotation.x = -0.45;
    add(clipboard, box, board, [0.08, 0, 0], [0.23, 0.3, 0.02]);
    add(clipboard, box, paper, [0.08, 0, 0.014], [0.195, 0.26, 0.012]);
    for (let line = 0; line < 4; line += 1)
      add(clipboard, box, metal, [0.08, 0.06 - line * 0.038, 0.022], [0.13, 0.008, 0.003]);
    const tool = add(arms[1].hand, box, metal, [0, -0.065, 0.028], [0.014, 0.17, 0.014]);

    return {
      arms,
      body,
      clipboard,
      elapsed: index * 1.7,
      greeting: 0,
      greetingCooldown: 0,
      head,
      legs,
      phase: index * 2,
      remaining: 2 + index * 3 + Math.random() * 3,
      root,
      route,
      speed: 0.42 + Math.random() * 0.12,
      stop: 0,
      tool,
      walkBlend: 0,
      workBlend: 1,
      working: true,
    };
  });

  const pointerTarget = new THREE.Vector3();
  const localTarget = new THREE.Vector3();
  let attentionRemaining = 0;
  let hoveredDoctor: number | undefined;
  const setAttention = (point: THREE.Vector3 | null, doctorIndex?: number): void => {
    attentionRemaining = point ? 3 : 0;
    if (point) pointerTarget.copy(point);
    if (point && doctorIndex !== undefined && doctorIndex !== hoveredDoctor) {
      const doctor = doctors[doctorIndex];
      if (doctor && doctor.greetingCooldown <= 0) {
        doctor.greeting = 1.8;
        doctor.greetingCooldown = 8;
      }
    }
    hoveredDoctor = point ? doctorIndex : undefined;
  };

  const update = (delta: number): void => {
    const dt = Math.min(Math.max(delta, 0), 0.05);
    attentionRemaining = Math.max(0, attentionRemaining - dt);
    for (const doctor of doctors) {
      doctor.elapsed += dt;
      doctor.greeting = Math.max(0, doctor.greeting - dt);
      doctor.greetingCooldown = Math.max(0, doctor.greetingCooldown - dt);
      const greeting = doctor.greeting > 0;
      let stop = doctor.route[doctor.stop];
      let walking = false;
      let facing = stop.facing ?? doctor.root.rotation.y;
      if (doctor.working && !greeting) {
        doctor.remaining -= dt;
        if (doctor.remaining <= 0) {
          doctor.working = false;
          doctor.stop = (doctor.stop + 1) % doctor.route.length;
          stop = doctor.route[doctor.stop];
        }
      }
      if (!doctor.working && !greeting) {
        const dx = stop.x - doctor.root.position.x;
        const dz = stop.z - doctor.root.position.z;
        const distance = Math.hypot(dx, dz);
        const step = Math.min(distance, doctor.speed * dt);
        if (distance > 0.001) {
          facing = Math.atan2(dx, dz);
          doctor.root.position.x += (dx / distance) * step;
          doctor.root.position.z += (dz / distance) * step;
          doctor.phase += step * 9.5;
          walking = true;
        }
        if (distance <= step + 0.001) {
          if (stop.activity) {
            doctor.working = true;
            doctor.remaining = 5 + Math.random() * 7;
          } else doctor.stop = (doctor.stop + 1) % doctor.route.length;
        }
      }
      const turn = Math.atan2(
        Math.sin(facing - doctor.root.rotation.y),
        Math.cos(facing - doctor.root.rotation.y)
      );
      doctor.root.rotation.y += turn * (1 - Math.exp(-dt * 8));
      doctor.workBlend = THREE.MathUtils.damp(
        doctor.workBlend,
        doctor.working && !greeting ? 1 : 0,
        7,
        dt
      );
      doctor.walkBlend = THREE.MathUtils.damp(doctor.walkBlend, walking ? 1 : 0, 10, dt);
      const work = doctor.workBlend;
      const walk = doctor.walkBlend;
      const wave = Math.sin(doctor.elapsed * 2.1);
      const stride = Math.sin(doctor.phase) * 0.28 * walk;
      const activity = stop.activity ?? 'records';
      const reviewing = activity === 'records';
      const treating = activity === 'treatment';
      doctor.body.position.y = Math.abs(Math.sin(doctor.phase)) * 0.007 * walk;
      doctor.body.rotation.x = work * (reviewing ? 0.015 : 0.035);
      doctor.body.rotation.y = Math.sin(doctor.phase) * 0.025 * walk;
      let headPitch = work * (reviewing ? 0.18 : 0.12);
      let headYaw = work * Math.sin(doctor.elapsed * 0.4) * 0.035;
      if (attentionRemaining > 0) {
        doctor.root.updateWorldMatrix(true, false);
        doctor.root.worldToLocal(localTarget.copy(pointerTarget));
        localTarget.y -= doctor.head.position.y;
        const yaw = Math.atan2(localTarget.x, localTarget.z);
        // Keep the neck within a natural range; do not turn toward points behind the doctor.
        if (Math.abs(yaw) < 1.65) {
          headYaw = THREE.MathUtils.clamp(yaw - doctor.body.rotation.y, -0.6, 0.6);
          headPitch = THREE.MathUtils.clamp(
            -Math.atan2(localTarget.y, Math.hypot(localTarget.x, localTarget.z)),
            -0.25,
            0.3
          );
        }
      }
      if (greeting) headPitch += Math.sin(((1.8 - doctor.greeting) / 1.8) * Math.PI * 2) * 0.1;
      doctor.head.rotation.x = THREE.MathUtils.damp(doctor.head.rotation.x, headPitch, 6, dt);
      doctor.head.rotation.y = THREE.MathUtils.damp(doctor.head.rotation.y, headYaw, 6, dt);
      doctor.clipboard.visible = doctor.working && reviewing;
      doctor.tool.visible = doctor.working;
      for (let side = 0; side < 2; side += 1) {
        const direction = side === 0 ? 1 : -1;
        const arm = doctor.arms[side];
        const leg = doctor.legs[side];
        leg.joint.rotation.x = direction * stride;
        leg.bend.rotation.x = Math.max(0, -direction * Math.sin(doctor.phase)) * 0.33 * walk;
        leg.hand.rotation.x = -leg.joint.rotation.x - leg.bend.rotation.x;
        const reach = treating ? -1.48 : reviewing ? -0.45 : -0.72;
        arm.joint.rotation.x =
          -direction * stride * 0.65 * (1 - work) +
          work * (reach + (side === 1 ? wave * 0.045 : 0));
        arm.joint.rotation.z = work * direction * (reviewing ? -0.2 : -0.08);
        arm.bend.rotation.x =
          -0.08 * (1 - work) + work * (reviewing ? -1.1 : treating ? -0.45 : -0.6);
      }
    }
  };
  update(0);
  return { group, setAttention, update };
};
