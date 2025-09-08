"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export default function MuscleViewer() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current!;
    const w = el.clientWidth,
      h = el.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setSize(w, h);
    el.appendChild(renderer.domElement);
    const canvas = renderer.domElement; // ← use canvas for events

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 1000);
    const controls = new OrbitControls(camera, canvas);

    // ---- controls config ----
    controls.enableDamping = true;
    controls.enablePan = true;
    controls.screenSpacePanning = true; // vertical drag = move up/down
    controls.rotateSpeed = 1.0;
    controls.panSpeed = 1.2;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.6;

    // ✅ Built-in zoom-to-cursor
    controls.enableZoom = true;
    (controls as any).zoomToCursor = true; // available in recent three.js
    controls.zoomSpeed = 1.0; // tweak: smaller = slower, bigger = faster

    // Dynamically switch LEFT button between ROTATE (horizontal) and PAN (vertical)
    let dragMode: "rotate" | "pan" | null = null;
    let sx = 0,
      sy = 0;

    function setLeftToRotate() {
      controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    }
    function setLeftToPan() {
      controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    }
    setLeftToRotate(); // default

    const pointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return; // left only
      dragMode = null;
      sx = e.clientX;
      sy = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };

    const pointerMove = (e: PointerEvent) => {
      if ((e.buttons & 1) === 0) return; // left not held
      if (!dragMode) {
        const dx = e.clientX - sx;
        const dy = e.clientY - sy;
        if (Math.hypot(dx, dy) < 4) return; // small threshold
        if (Math.abs(dy) > Math.abs(dx)) {
          // mostly vertical → PAN
          dragMode = "pan";
          setLeftToPan();
          // If you want drag-down to move the model UP, invert pan speed:
          // controls.panSpeed = -Math.abs(controls.panSpeed);
        } else {
          // mostly horizontal → ROTATE
          dragMode = "rotate";
          setLeftToRotate();
        }
      }
    };

    const pointerUp = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragMode = null;
      setLeftToRotate(); // reset for next drag
    };

    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    // ---- lights ----
    scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 0.8));
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(2, 2, 3);
    scene.add(dir);

    // ---- group: skeleton + muscle ----
    const root = new THREE.Group();
    scene.add(root);

    let sceneSphere: THREE.Sphere | null = null;
    let sceneBox: THREE.Box3 | null = null; // expanded AABB for clamping
    let panBox: THREE.Box3 | null = null; // for clamping target while panning
    const ORIGIN = new THREE.Vector3(0, 0, 0);
    let loaded = 0;
    const tryFrame = () => {
      if (loaded < 2) return;
      const box = new THREE.Box3().setFromObject(root);
      const sphere = new THREE.Sphere();
      box.getBoundingSphere(sphere);

      // NEW: keep a padded box around the model for clamping the target
      panBox = box.clone().expandByScalar(0.1 * sphere.radius); // 10% padding

      root.position.sub(sphere.center); // center group at origin
      controls.target.set(0, 0, 0);

      controls.update();

      const fov = THREE.MathUtils.degToRad(camera.fov);
      const dist = (sphere.radius / Math.sin(fov / 2)) * 1.15;
      camera.position.set(0, 0, dist);
      camera.near = Math.max(dist / 100, 0.001);
      camera.far = dist * 100;
      camera.updateProjectionMatrix();

      // Zoom limits (tweak to taste)
      controls.minDistance = dist * 0.2;
      controls.maxDistance = dist * 0.9;
    };

    const loader = new GLTFLoader();

    // skeleton
    loader.load(
      "/models/skeleton.glb",
      (gltf) => {
        const skeleton = gltf.scene;
        skeleton.traverse((o: any) => {
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
        root.add(skeleton);
        loaded++;
        tryFrame();
      },
      undefined,
      (e) => console.error("Skeleton load error:", e)
    );

    // muscle
    loader.load(
      "/models/rhomboid-major.glb",
      (gltf) => {
        const muscle = gltf.scene;
        muscle.traverse((o: any) => {
          if (o.isMesh) {
            o.material = new THREE.MeshStandardMaterial({
              color: 0xc84d4d,
              roughness: 0.9,
              metalness: 0,
            });
          }
        });
        root.add(muscle);
        loaded++;
        tryFrame();
      },
      undefined,
      (e) => console.error("Muscle load error:", e)
    );

    // ---- resize & loop ----
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
      // --- keep the target near the model ---
      if (panBox) {
        controls.target.set(
          THREE.MathUtils.clamp(controls.target.x, panBox.min.x, panBox.max.x),
          THREE.MathUtils.clamp(controls.target.y, panBox.min.y, panBox.max.y),
          THREE.MathUtils.clamp(controls.target.z, panBox.min.z, panBox.max.z)
        );
      }

      // --- if user has zoomed out near max, gently re-center the target ---
      const camOffset = camera.position.clone().sub(controls.target);
      const distNow = camOffset.length();
      if (controls.maxDistance && distNow > controls.maxDistance * 0.95) {
        // pull target toward the model center a bit each frame
        controls.target.lerp(ORIGIN, 0.15); // increase 0.15 -> 0.3 for faster recenters
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
  }, []);

  return <div ref={containerRef} className="w-full h-[100vh]" />;
}
