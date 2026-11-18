'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import Image from 'next/image';
import { Maximize2, Minimize2, Minus, Pause, Play, Plus, RotateCcw } from 'lucide-react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createClinicModel, disposeClinicModel, type ClinicDestination } from './clinic-model';
import styles from './clinic-model.module.css';
import { createClinicOrbitEnvironment } from './clinic-orbit-environment';
import { createClinicStaff } from './clinic-staff';

type ClinicModelViewerProps = {
  onNavigate: (destination: ClinicDestination) => void;
  immersive?: boolean;
};

type ViewerControls = {
  reset: () => void;
  setRotation: (enabled: boolean) => void;
  zoom: (factor: number) => void;
};

export const ClinicModelViewer = ({
  immersive = false,
  onNavigate,
}: ClinicModelViewerProps): JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef<ViewerControls | null>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const wasExpandedRef = useRef(false);
  const navigateRef = useRef(onNavigate);
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [expanded, setExpanded] = useState(false);
  const [isRotating, setIsRotating] = useState(
    () =>
      typeof window === 'undefined' ||
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const rotationEnabledRef = useRef(isRotating);

  useEffect(() => {
    navigateRef.current = onNavigate;
  }, [onNavigate]);

  useEffect(() => {
    rotationEnabledRef.current = isRotating;
    controlsRef.current?.setRotation(isRotating);
  }, [isRotating]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        canvas,
        powerPreference: 'low-power',
      });
    } catch {
      const fallbackFrame = window.requestAnimationFrame(() => setStatus('fallback'));
      return () => window.cancelAnimationFrame(fallbackFrame);
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = immersive ? 1.08 : 0.93;
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;

    const scene = new THREE.Scene();
    const environment = new RoomEnvironment();
    const generator = new THREE.PMREMGenerator(renderer);
    const environmentMap = generator.fromScene(environment, 0.04);
    scene.environment = environmentMap.texture;
    scene.environmentIntensity = immersive ? 0.85 : 0.65;
    environment.dispose();
    generator.dispose();

    const model = createClinicModel();
    const staff = createClinicStaff();
    model.add(staff.group);
    scene.add(model);
    const orbitEnvironment = immersive ? createClinicOrbitEnvironment() : undefined;
    if (orbitEnvironment) scene.add(orbitEnvironment.group);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.ShadowMaterial({ color: '#214b40', opacity: immersive ? 0.12 : 0.16 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = immersive ? -2.45 : -0.145;
    ground.receiveShadow = true;
    scene.add(ground);

    scene.add(new THREE.HemisphereLight('#f1f8ff', '#a4b39a', 0.9));
    const sunlight = new THREE.DirectionalLight('#fff3df', 2.5);
    sunlight.position.set(-4, 12, 6);
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(2048, 2048);
    sunlight.shadow.camera.left = sunlight.shadow.camera.bottom = immersive ? -11 : -9;
    sunlight.shadow.camera.right = sunlight.shadow.camera.top = immersive ? 11 : 9;
    sunlight.shadow.camera.near = 0.1;
    sunlight.shadow.camera.far = 35;
    sunlight.shadow.normalBias = 0.025;
    sunlight.shadow.bias = -0.00015;
    scene.add(sunlight);
    const fillLight = new THREE.DirectionalLight('#d0e8ff', 0.6);
    fillLight.position.set(8, 6, -4);
    scene.add(fillLight);
    if (immersive) {
      const rimLight = new THREE.DirectionalLight('#d9ffe9', 1.3);
      rimLight.position.set(-7, 4, -9);
      scene.add(rimLight);
    }

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    const target = new THREE.Vector3(0, immersive ? 0.15 : 0.5, 0);
    const startingDirection = new THREE.Vector3(11.5, 12.5, 15).normalize();
    let defaultDistance = 23;
    const controls = new OrbitControls(camera, canvas);
    controls.target.copy(target);
    controls.enablePan = false;
    // Buttons and pinch gestures control zoom so the dashboard can still scroll normally.
    controls.enableZoom = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.rotateSpeed = 0.55;
    controls.autoRotateSpeed = immersive ? 0.4 : 0.65;
    controls.minPolarAngle = 0.3;
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.minDistance = 11;
    controls.maxDistance = 36;

    let frame = 0;
    let disposed = false;
    let visible = true;
    let firstRender = true;
    let contextLost = false;
    let interacting = false;
    let automaticRotation = rotationEnabledRef.current;
    let resumeRotationAt = 0;
    let lastFrameTime = 0;
    let sceneElapsed = 0;
    const render = (time: number): void => {
      frame = 0;
      if (disposed || !visible || document.hidden || contextLost) {
        lastFrameTime = 0;
        return;
      }
      const delta = lastFrameTime ? Math.min((time - lastFrameTime) / 1000, 0.05) : 0;
      lastFrameTime = time;
      controls.autoRotate = automaticRotation && !interacting && time >= resumeRotationAt;
      if (automaticRotation) staff.update(delta);
      if (controls.autoRotate) {
        sceneElapsed += delta;
        orbitEnvironment?.update(sceneElapsed);
      }
      controls.update(delta);
      renderer.render(scene, camera);
      if (firstRender) {
        firstRender = false;
        setStatus('ready');
      }
      if (automaticRotation || interacting) requestRender();
    };
    const requestRender = (): void => {
      if (!frame && !disposed && visible && !document.hidden && !contextLost)
        frame = window.requestAnimationFrame(render);
    };
    const stopRotation = (): void => {
      controls.autoRotate = false;
      const position = camera.position.clone();
      // Clear accumulated damping without moving the camera away from the paused view.
      controls.enableDamping = false;
      controls.update(0);
      camera.position.copy(position);
      controls.enableDamping = true;
      controls.update(0);
    };
    const pauseForInteraction = (): void => {
      if (controls.autoRotate) stopRotation();
      resumeRotationAt = performance.now() + 2400;
      requestRender();
    };
    const onInteractionStart = (): void => {
      interacting = true;
      pauseForInteraction();
    };
    const onInteractionEnd = (): void => {
      interacting = false;
      pauseForInteraction();
    };
    const setRotation = (enabled: boolean): void => {
      automaticRotation = enabled;
      if (!enabled) stopRotation();
      controls.autoRotate = enabled && !interacting && performance.now() >= resumeRotationAt;
      lastFrameTime = 0;
      requestRender();
    };
    const reset = (): void => {
      pauseForInteraction();
      controls.reset();
      controls.target.copy(target);
      camera.position.copy(startingDirection).multiplyScalar(defaultDistance).add(target);
      camera.zoom = 1;
      camera.updateProjectionMatrix();
      controls.update();
      requestRender();
    };
    const zoom = (factor: number): void => {
      pauseForInteraction();
      const distance = THREE.MathUtils.clamp(
        camera.position.distanceTo(controls.target) * factor,
        controls.minDistance,
        controls.maxDistance
      );
      camera.position
        .sub(controls.target)
        .normalize()
        .multiplyScalar(distance)
        .add(controls.target);
      controls.update();
      requestRender();
    };
    controlsRef.current = { reset, setRotation, zoom };
    controls.addEventListener('change', requestRender);
    controls.addEventListener('start', onInteractionStart);
    controls.addEventListener('end', onInteractionEnd);

    let firstResize = true;
    let previousDistance = defaultDistance;
    const resize = (): void => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
      defaultDistance = Math.max(
        (immersive ? 8.4 : 7.3) / Math.tan(horizontalFov / 2),
        (immersive ? 6.0 : 5.4) / Math.tan(verticalFov / 2)
      );
      if (immersive && !expanded) {
        // Leave space for the atlas controls around the clinic on wider screens.
        defaultDistance *= 1 + THREE.MathUtils.smoothstep(width, 600, 1000) * 0.25;
      }
      controls.maxDistance = defaultDistance * 1.55;
      if (firstResize) {
        reset();
        controls.saveState();
        resumeRotationAt = 0;
        firstResize = false;
      } else if (immersive) {
        // Preserve the viewing angle and zoom ratio when the atlas changes size.
        camera.position
          .sub(controls.target)
          .multiplyScalar(defaultDistance / previousDistance)
          .add(controls.target);
        controls.update();
      }
      previousDistance = defaultDistance;
      requestRender();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      lastFrameTime = 0;
      if (!visible) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
      if (visible) requestRender();
    });
    visibilityObserver.observe(container);
    resize();
    const onVisibilityChange = (): void => {
      lastFrameTime = 0;
      if (document.hidden) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      } else requestRender();
    };
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotionPreferenceChange = (event: MediaQueryListEvent): void => {
      if (event.matches) {
        setRotation(false);
        setIsRotating(false);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    motionPreference.addEventListener('change', onMotionPreferenceChange);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pointerStart = new THREE.Vector2();
    const attentionPlane = new THREE.Plane();
    const attentionNormal = new THREE.Vector3();
    const attentionAnchor = new THREE.Vector3(0, 1.7, 0);
    const attentionPoint = new THREE.Vector3();
    let pointerMoved = false;
    let multiTouch = false;
    const activeTouches = new Map<number, THREE.Vector2>();
    let pinchDistance = 0;
    const targetAt = (
      event: PointerEvent
    ): { destination?: ClinicDestination; doctorIndex?: number } => {
      const bounds = canvas.getBoundingClientRect();
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(model, true).find(({ object }) => {
        if (!(object instanceof THREE.Mesh)) return true;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        return materials.some((material) => !material.transparent || material.opacity >= 0.35);
      });
      let object: THREE.Object3D | null = hit?.object ?? null;
      while (object) {
        if (object.userData.destination)
          return {
            destination: object.userData.destination as ClinicDestination,
            doctorIndex:
              typeof object.userData.clinicStaffIndex === 'number'
                ? object.userData.clinicStaffIndex
                : undefined,
          };
        object = object.parent;
      }
      return {};
    };
    const touchDistance = (): number => {
      const [first, second] = [...activeTouches.values()];
      return first && second ? first.distanceTo(second) : 0;
    };
    const onPointerDown = (event: PointerEvent): void => {
      staff.setAttention(null);
      pauseForInteraction();
      pointerStart.set(event.clientX, event.clientY);
      pointerMoved = false;
      if (event.pointerType === 'touch') {
        activeTouches.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
        multiTouch = activeTouches.size > 1;
        pinchDistance = touchDistance();
      }
    };
    const onPointerMove = (event: PointerEvent): void => {
      if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5)
        pointerMoved = true;
      if (activeTouches.has(event.pointerId)) {
        activeTouches.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
        const nextDistance = touchDistance();
        if (nextDistance > 0 && pinchDistance > 0) zoom(pinchDistance / nextDistance);
        pinchDistance = nextDistance;
      }
      if (event.pointerType === 'mouse' && event.buttons === 0) {
        const target = targetAt(event);
        canvas.style.cursor = target.destination ? 'pointer' : 'grab';
        if (target.doctorIndex !== undefined) {
          staff.setAttention(camera.position, target.doctorIndex);
          pauseForInteraction();
        } else {
          camera.getWorldDirection(attentionNormal);
          attentionPlane.setFromNormalAndCoplanarPoint(attentionNormal, attentionAnchor);
          staff.setAttention(raycaster.ray.intersectPlane(attentionPlane, attentionPoint));
        }
        requestRender();
      }
    };
    const onPointerUp = (event: PointerEvent): void => {
      if (!pointerMoved && !multiTouch && event.button === 0) {
        const { destination } = targetAt(event);
        if (destination) navigateRef.current(destination);
      }
      activeTouches.delete(event.pointerId);
      if (activeTouches.size === 0) multiTouch = false;
      pinchDistance = touchDistance();
    };
    const onPointerCancel = (event: PointerEvent): void => {
      staff.setAttention(null);
      activeTouches.delete(event.pointerId);
      multiTouch = activeTouches.size > 1;
      pointerMoved = true;
      pinchDistance = touchDistance();
    };
    const onPointerLeave = (): void => {
      staff.setAttention(null);
      canvas.style.cursor = 'grab';
      requestRender();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'Home'];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      pauseForInteraction();
      if (event.key === 'Home') reset();
      else if (event.key === '+' || event.key === '=') zoom(0.88);
      else if (event.key === '-') zoom(1.14);
      else {
        const offset = camera.position.clone().sub(controls.target);
        const spherical = new THREE.Spherical().setFromVector3(offset);
        spherical.theta +=
          event.key === 'ArrowLeft' ? -0.12 : event.key === 'ArrowRight' ? 0.12 : 0;
        spherical.phi = THREE.MathUtils.clamp(
          spherical.phi + (event.key === 'ArrowUp' ? -0.1 : event.key === 'ArrowDown' ? 0.1 : 0),
          controls.minPolarAngle,
          controls.maxPolarAngle
        );
        camera.position.setFromSpherical(spherical).add(controls.target);
        controls.update();
        requestRender();
      }
    };
    const onContextLost = (event: Event): void => {
      event.preventDefault();
      contextLost = true;
      window.cancelAnimationFrame(frame);
      frame = 0;
      lastFrameTime = 0;
      setStatus('fallback');
    };
    const onContextRestored = (): void => {
      contextLost = false;
      renderer.shadowMap.needsUpdate = true;
      setStatus('ready');
      requestRender();
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('keydown', onKeyDown);
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);
    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      controlsRef.current = null;
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      motionPreference.removeEventListener('change', onMotionPreferenceChange);
      controls.removeEventListener('change', requestRender);
      controls.removeEventListener('start', onInteractionStart);
      controls.removeEventListener('end', onInteractionEnd);
      controls.dispose();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      disposeClinicModel(scene);
      sunlight.shadow.dispose();
      environmentMap.dispose();
      renderer.dispose();
    };
  }, [expanded, immersive]);

  useEffect(() => {
    if (!expanded) {
      if (wasExpandedRef.current) expandButtonRef.current?.focus();
      wasExpandedRef.current = false;
      return;
    }
    wasExpandedRef.current = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    expandButtonRef.current?.focus();
    const onDialogKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setExpanded(false);
      if (event.key === 'Tab') {
        const dialog = containerRef.current?.parentElement;
        const focusable = dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), canvas[tabindex="0"]'
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onDialogKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onDialogKeyDown);
    };
  }, [expanded]);

  const viewer = (
    <div
      className={`${styles.viewerShell} ${immersive ? styles.immersiveViewer : ''} ${expanded ? styles.expanded : ''}`}
      data-viewer-mode={immersive ? 'immersive' : 'standard'}
      role={expanded ? 'dialog' : undefined}
      aria-modal={expanded ? true : undefined}
      aria-label={expanded ? 'Explore the dental clinic' : undefined}
    >
      <div ref={containerRef} className={styles.viewport}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          tabIndex={status === 'ready' ? 0 : -1}
          aria-label="Interactive 3D dental clinic with doctors walking and working. Move your mouse for doctors to look toward it, or hover over a doctor for a greeting. Drag or use arrow keys to rotate. Use plus and minus to zoom, and Home to reset. Use the pause button to stop animation. Select reception, the waiting area, or the dental chair to open that workspace."
          aria-hidden={status !== 'ready'}
        />
        {status === 'loading' ? (
          <div className={styles.loading} role="status">
            Opening your clinic…
          </div>
        ) : null}
        {status === 'fallback' ? (
          <div className={styles.poster}>
            <Image
              src="/images/dental/clinic/clinic-preview.png"
              alt="3D dental clinic with a reception desk, patient lounge, treatment chair, and sterilization area"
              fill
              sizes="(max-width: 700px) 100vw, 700px"
              className={styles.posterImage}
            />
            <span className={styles.fallbackHint}>Clinic overview</span>
          </div>
        ) : null}
      </div>
      <div className={styles.viewerToolbar}>
        <span className={styles.modelBadge}>CLINIC OVERVIEW</span>
        <div className={styles.viewControls}>
          <button
            type="button"
            onClick={() => setIsRotating((value) => !value)}
            disabled={status !== 'ready'}
            aria-label={isRotating ? 'Pause clinic animation' : 'Resume clinic animation'}
            title={isRotating ? 'Pause animation' : 'Resume animation'}
          >
            {isRotating ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button
            type="button"
            onClick={() => controlsRef.current?.zoom(0.85)}
            disabled={status !== 'ready'}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <Plus size={15} />
          </button>
          <button
            type="button"
            onClick={() => controlsRef.current?.zoom(1.18)}
            disabled={status !== 'ready'}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <Minus size={15} />
          </button>
          <span className={styles.controlDivider} />
          <button
            type="button"
            onClick={() => controlsRef.current?.reset()}
            disabled={status !== 'ready'}
            aria-label="Reset clinic view"
            title="Reset view"
          >
            <RotateCcw size={14} />
          </button>
          <button
            ref={expandButtonRef}
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? 'Close expanded clinic view' : 'Expand clinic view'}
            title={expanded ? 'Close expanded view' : 'Expand view'}
          >
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>
      {status === 'ready' ? (
        <div className={styles.viewHint}>
          Drag to rotate <span>·</span> Hover over a doctor to greet them <span>·</span> Pinch or
          use + / − to zoom
        </div>
      ) : null}
    </div>
  );

  return expanded ? createPortal(viewer, document.body) : viewer;
};

export default ClinicModelViewer;
