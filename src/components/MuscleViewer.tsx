// components/MuscleViewer.tsx
"use client";

import {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type MuscleViewerHandle = { next: () => void };
type Props = { onChange?: (path: string, slug: string) => void };

// turn "/models/pectoralis-major.glb" -> "pectoralis-major"
function pathToSlug(path: string) {
  const base = path.split("/").pop() || "";
  return base.replace(/\.glb$/i, "");
}

const MuscleViewer = forwardRef<MuscleViewerHandle, Props>(
  function MuscleViewer({ onChange }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);

    const [list, setList] = useState<string[]>([]);
    const [muscleUrl, setMuscleUrl] = useState<string | null>(null);
    const [lastUrl, setLastUrl] = useState<string | null>(null);

    function pickRandom(from?: string[]) {
      const pool = from ?? list;
      if (!pool || pool.length === 0) return;
      let pick: string;
      do {
        pick = pool[Math.floor(Math.random() * pool.length)];
      } while (pool.length > 1 && pick === lastUrl);
      setLastUrl(pick);
      setMuscleUrl(pick);
      onChange?.(pick, pathToSlug(pick));
    }

    // expose next() to parent
    useImperativeHandle(ref, () => ({
      next: () => pickRandom(),
    }));

    // fetch manifest once and pick first muscle
    useEffect(() => {
      fetch("/models/manifest.json")
        .then((r) => r.json())
        .then((files: string[]) => {
          const pool = (files || []).filter((p) => !/skeleton\.glb$/i.test(p));
          setList(pool);
          if (pool.length > 0) {
            pickRandom(pool);
          }
        })
        .catch(console.error);
    }, []);

    // --- Three.js rendering ---
    useEffect(() => {
      if (!muscleUrl) return;

      const el = containerRef.current!;
      const w = el.clientWidth,
        h = el.clientHeight;

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setSize(w, h);
      el.appendChild(renderer.domElement);
      const canvas = renderer.domElement;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x111111);

      const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 1000);
      const controls = new OrbitControls(camera, canvas);

      controls.enableDamping = true;
      controls.enablePan = true;
      controls.screenSpacePanning = true;
      controls.rotateSpeed = 1.0;
      controls.panSpeed = 1.2;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.6;
      controls.enableZoom = true;
      (controls as any).zoomToCursor = true;
      controls.zoomSpeed = 1.0;

      let dragMode: "rotate" | "pan" | null = null;
      let sx = 0,
        sy = 0;
      const setLeftToRotate = () =>
        (controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE);
      const setLeftToPan = () => (controls.mouseButtons.LEFT = THREE.MOUSE.PAN);
      setLeftToRotate();

      const pointerDown = (e: PointerEvent) => {
        if (e.button !== 0) return;
        dragMode = null;
        sx = e.clientX;
        sy = e.clientY;
        canvas.setPointerCapture(e.pointerId);
      };
      const pointerMove = (e: PointerEvent) => {
        if ((e.buttons & 1) === 0) return;
        if (!dragMode) {
          const dx = e.clientX - sx,
            dy = e.clientY - sy;
          if (Math.hypot(dx, dy) < 4) return;
          dragMode = Math.abs(dy) > Math.abs(dx) ? "pan" : "rotate";
          dragMode === "pan" ? setLeftToPan() : setLeftToRotate();
        }
      };
      const pointerUp = (e: PointerEvent) => {
        if (e.button !== 0) return;
        dragMode = null;
        setLeftToRotate();
      };

      canvas.addEventListener("pointerdown", pointerDown);
      canvas.addEventListener("pointermove", pointerMove);
      canvas.addEventListener("pointerup", pointerUp);
      canvas.addEventListener("contextmenu", (e) => e.preventDefault());

      scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 0.8));
      const dir = new THREE.DirectionalLight(0xffffff, 1.0);
      dir.position.set(2, 2, 3);
      scene.add(dir);

      const root = new THREE.Group();
      scene.add(root);

      let panBox: THREE.Box3 | null = null;
      const ORIGIN = new THREE.Vector3(0, 0, 0);
      let loaded = 0;

      const tryFrame = () => {
        if (loaded < 2) return;
        const box = new THREE.Box3().setFromObject(root);
        const sphere = new THREE.Sphere();
        box.getBoundingSphere(sphere);

        panBox = box.clone().expandByScalar(0.1 * sphere.radius);
        root.position.sub(sphere.center);
        controls.target.set(0, 0, 0);
        controls.update();

        const fov = THREE.MathUtils.degToRad(camera.fov);
        const dist = (sphere.radius / Math.sin(fov / 2)) * 1.15;
        camera.position.set(0, 0, dist);
        camera.near = Math.max(dist / 100, 0.001);
        camera.far = dist * 100;
        camera.updateProjectionMatrix();

        controls.minDistance = dist * 0.2;
        controls.maxDistance = dist * 0.9;
      };

      const loader = new GLTFLoader();

      loader.load("/models/skeleton.glb", (gltf) => {
        gltf.scene.traverse((o: any) => {
          if (o.isMesh) {
            o.material = new THREE.MeshStandardMaterial({
              color: 0x444444,
              roughness: 1,
              metalness: 0,
              transparent: true,
              opacity: 0.6,
            });
          }
        });
        root.add(gltf.scene);
        loaded++;
        tryFrame();
      });

      loader.load(muscleUrl, (gltf) => {
        gltf.scene.traverse((o: any) => {
          if (o.isMesh) {
            o.material = new THREE.MeshStandardMaterial({
              color: 0xc84d4d,
              roughness: 0.9,
              metalness: 0,
            });
          }
        });
        root.add(gltf.scene);
        loaded++;
        tryFrame();
      });

      const onResize = () => {
        const W = el.clientWidth,
          H = el.clientHeight;
        renderer.setSize(W, H);
        camera.aspect = W / H;
        camera.updateProjectionMatrix();
      };
      window.addEventListener("resize", onResize);

      let raf = 0;
      const loop = () => {
        if (panBox) {
          controls.target.set(
            THREE.MathUtils.clamp(
              controls.target.x,
              panBox.min.x,
              panBox.max.x
            ),
            THREE.MathUtils.clamp(
              controls.target.y,
              panBox.min.y,
              panBox.max.y
            ),
            THREE.MathUtils.clamp(controls.target.z, panBox.min.z, panBox.max.z)
          );
        }
        const distNow = camera.position.clone().sub(controls.target).length();
        if (controls.maxDistance && distNow > controls.maxDistance * 0.95) {
          controls.target.lerp(ORIGIN, 0.15);
        }
        controls.update();
        renderer.render(scene, camera);
        raf = requestAnimationFrame(loop);
      };
      loop();

      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", onResize);
        canvas.removeEventListener("pointerdown", pointerDown);
        canvas.removeEventListener("pointermove", pointerMove);
        canvas.removeEventListener("pointerup", pointerUp);
        canvas.removeEventListener("contextmenu", (e) => e.preventDefault());
        el.removeChild(renderer.domElement);
        renderer.dispose();
        scene.traverse((o: any) => {
          if (o.isMesh) {
            o.geometry?.dispose?.();
            o.material?.dispose?.();
          }
        });
      };
    }, [muscleUrl]);

    return <div ref={containerRef} className="w-full h-[100vh]" />;
  }
);

export default MuscleViewer;
