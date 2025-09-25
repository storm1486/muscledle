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
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type MuscleViewerHandle = {
  next: () => void;
  setBySlug: (slug: string) => void;
};

type Props = {
  onChange?: (path: string, slug: string) => void;
  muscleSlug?: string | null; // if provided, show this slug
};

// "/models/pectoralis-major.glb" -> "pectoralis-major"
function pathToSlug(path: string): string {
  const base = path.split("/").pop() || "";
  return base.replace(/\.glb$/i, "");
}

// Extend OrbitControls to optionally support zoomToCursor without `any`
type ZoomToCursorControls = OrbitControls & { zoomToCursor?: boolean };

const MuscleViewer = forwardRef<MuscleViewerHandle, Props>(
  function MuscleViewer({ onChange, muscleSlug }, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);

    const [list, setList] = useState<string[]>([]);
    const [muscleUrl, setMuscleUrl] = useState<string | null>(null);
    const [lastUrl, setLastUrl] = useState<string | null>(null);

    // NEW: UI states
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");

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

    function setBySlug(slug: string) {
      if (!list.length) return;
      const want = slug.toLowerCase();
      const found = list.find((p) => pathToSlug(p).toLowerCase() === want);
      if (found) {
        setLastUrl(found);
        setMuscleUrl(found);
        onChange?.(found, pathToSlug(found));
      }
    }

    useImperativeHandle(ref, () => ({
      next: () => pickRandom(),
      setBySlug,
    }));

    // load manifest once
    useEffect(() => {
      setError("");
      fetch(`/models/manifest.json?bust=${Date.now()}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((files: string[]) => {
          const pool = (files || []).filter((p) => !/skeleton\.glb$/i.test(p));
          setList(pool);
          // initial pick (respect muscleSlug if given)
          if (pool.length > 0) {
            if (muscleSlug) setBySlug(muscleSlug);
            else pickRandom(pool);
          }
        })
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.error(e);
          setError("Failed to load model list.");
        });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // react to muscleSlug changes after manifest is loaded
    useEffect(() => {
      if (muscleSlug && list.length) setBySlug(muscleSlug);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [muscleSlug, list.length]);

    // --- Three.js rendering ---
    useEffect(() => {
      if (!muscleUrl) return;

      // show loader while (re)loading models
      setIsLoading(true);
      setError("");

      const el = containerRef.current!;
      const w = el.clientWidth;
      const h = el.clientHeight;

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setSize(w, h);
      el.appendChild(renderer.domElement);
      const canvas = renderer.domElement;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x111111);

      const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 1000);
      // use your extended type:
      const controls: ZoomToCursorControls = new OrbitControls(
        camera,
        canvas
      ) as ZoomToCursorControls;
      controls.zoomToCursor = true;

      controls.enableDamping = true;
      controls.enablePan = true;
      controls.screenSpacePanning = true;
      controls.rotateSpeed = 1.0;
      controls.panSpeed = 1.2;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.6;
      controls.enableZoom = true;
      // optional property on some OrbitControls builds:
      controls.zoomSpeed = 1.0;

      let dragMode: "rotate" | "pan" | null = null;
      let sx = 0;
      let sy = 0;
      const setLeftToRotate = () => {
        controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
      };
      const setLeftToPan = () => {
        controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
      };
      setLeftToRotate();

      // Use named handlers so add/remove get the same reference
      const onPointerDown = (e: PointerEvent) => {
        if (e.button !== 0) return;
        dragMode = null;
        sx = e.clientX;
        sy = e.clientY;
        canvas.setPointerCapture(e.pointerId);
      };
      const onPointerMove = (e: PointerEvent) => {
        if ((e.buttons & 1) === 0) return;
        if (!dragMode) {
          const dx = e.clientX - sx;
          const dy = e.clientY - sy;
          if (Math.hypot(dx, dy) < 4) return;
          dragMode = Math.abs(dy) > Math.abs(dx) ? "pan" : "rotate";
          if (dragMode === "pan") {
            setLeftToPan();
          } else {
            setLeftToRotate();
          }
        }
      };
      const onPointerUp = (e: PointerEvent) => {
        if (e.button !== 0) return;
        dragMode = null;
        setLeftToRotate();
      };
      const onContextMenu = (e: MouseEvent) => e.preventDefault();

      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerup", onPointerUp);
      canvas.addEventListener("contextmenu", onContextMenu);

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

        // 1) Measure the scene as loaded
        const preBox = new THREE.Box3().setFromObject(root);
        const sphere = new THREE.Sphere();
        preBox.getBoundingSphere(sphere);

        // 2) Center on origin, then lift a bit (e.g., 15% of radius)
        const yLift = 0.12 * sphere.radius; // tweak this value to taste
        root.position.sub(sphere.center); // center to (0,0,0)
        root.position.y += yLift; // lift the whole model up

        // 3) Controls look-at point should match the lifted height
        controls.target.set(0, yLift, 0);
        controls.update();

        // 4) Distance & camera placement
        const fov = THREE.MathUtils.degToRad(camera.fov);
        const dist = (sphere.radius / Math.sin(fov / 2)) * 1.15;
        camera.position.set(0, yLift, dist); // keep camera at same y as the target
        camera.near = Math.max(dist / 100, 0.001);
        camera.far = dist * 100;
        camera.updateProjectionMatrix();

        controls.minDistance = dist * 0.2;
        controls.maxDistance = dist * 0.9;

        // 5) Recompute pan clamp AFTER repositioning so limits match what you see
        const postBox = new THREE.Box3().setFromObject(root);
        panBox = postBox.clone().expandByScalar(0.1 * sphere.radius);

        // 6) hide loader
        setIsLoading(false);
      };

      const loader = new GLTFLoader();

      const colorSkeleton = new THREE.MeshStandardMaterial({
        color: 0x444444,
        roughness: 1,
        metalness: 0,
        transparent: true,
        opacity: 0.6,
      });

      const colorMuscle = new THREE.MeshStandardMaterial({
        color: 0xc84d4d,
        roughness: 0.9,
        metalness: 0,
      });

      const onLoadError = (what: string) => (e: unknown) => {
        console.error(`Failed to load ${what}`, e);
        setError(`Failed to load ${what}.`);
        setIsLoading(false);
      };

      loader.load(
        "/models/skeleton.glb",
        (gltf: GLTF) => {
          gltf.scene.traverse((obj: THREE.Object3D) => {
            if ((obj as THREE.Mesh).isMesh) {
              const mesh = obj as THREE.Mesh;
              mesh.material = colorSkeleton;
            }
          });
          root.add(gltf.scene);
          loaded++;
          tryFrame();
        },
        undefined,
        onLoadError("skeleton")
      );

      loader.load(
        muscleUrl,
        (gltf: GLTF) => {
          gltf.scene.traverse((obj: THREE.Object3D) => {
            if ((obj as THREE.Mesh).isMesh) {
              const mesh = obj as THREE.Mesh;
              mesh.material = colorMuscle;
            }
          });
          root.add(gltf.scene);
          loaded++;
          tryFrame();
        },
        undefined,
        onLoadError("muscle model")
      );

      const onResize = () => {
        const W = el.clientWidth;
        const H = el.clientHeight;
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
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerup", onPointerUp);
        canvas.removeEventListener("contextmenu", onContextMenu);

        if (renderer.domElement.parentElement === el) {
          el.removeChild(renderer.domElement);
        }
        renderer.dispose();

        // Dispose materials & geometries without `any`
        scene.traverse((obj: THREE.Object3D) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            if (mesh.geometry) mesh.geometry.dispose();
            const mat = mesh.material;
            if (Array.isArray(mat)) {
              mat.forEach((m) => m.dispose());
            } else if (mat) {
              mat.dispose();
            }
          }
        });
      };
    }, [muscleUrl]);

    return (
      <div ref={containerRef} className="relative w-full h-[100vh]">
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10 backdrop-blur-[1px]">
            <svg
              className="animate-spin h-10 w-10 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-label="Loading"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
          </div>
        )}

        {/* Error badge (non-blocking) */}
        {error && !isLoading && (
          <div className="absolute top-3 left-3 z-10 rounded bg-red-600/90 text-white text-sm px-3 py-1.5 shadow">
            {error}
          </div>
        )}
      </div>
    );
  }
);

export default MuscleViewer;
