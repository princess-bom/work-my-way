import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { JobId } from './domain';

type MockupThreeOverlayProps = {
  selectedJobId: JobId;
  onSelectJob: (jobId: JobId) => void;
};

const pinPositions: Record<JobId, { x: number; y: number; color: number }> = {
  'barista-aide': { x: -1.76, y: 0.82, color: 0xff7a00 },
  'library-aide': { x: 1.78, y: -0.28, color: 0x2f7df6 },
  'baker-aide': { x: -0.42, y: -1.28, color: 0x8b5cf6 }
};

export function MockupThreeOverlay({ selectedJobId, onSelectJob }: MockupThreeOverlayProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, host.clientWidth / host.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 5.4);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const light = new THREE.PointLight(0xfff1d7, 4.5, 12);
    light.position.set(0, 2.8, 4);
    scene.add(light);

    const groups = new Map<JobId, THREE.Group>();
    const hitTargets: THREE.Mesh[] = [];
    Object.entries(pinPositions).forEach(([id, position]) => {
      const group = new THREE.Group();
      group.position.set(position.x, position.y, 0);

      const glow = new THREE.Mesh(
        new THREE.TorusGeometry(0.27, 0.015, 12, 96),
        new THREE.MeshBasicMaterial({ color: position.color, transparent: true, opacity: 0.55 })
      );
      const pulse = new THREE.Mesh(
        new THREE.TorusGeometry(0.39, 0.012, 12, 96),
        new THREE.MeshBasicMaterial({ color: position.color, transparent: true, opacity: 0.2 })
      );
      const bead = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 24, 18),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
      );
      bead.position.z = 0.07;
      const hitTarget = new THREE.Mesh(
        new THREE.CircleGeometry(0.5, 48),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      hitTarget.userData.jobId = id;
      hitTarget.position.z = 0.12;

      group.add(glow, pulse, bead, hitTarget);
      hitTargets.push(hitTarget);
      groups.set(id as JobId, group);
      scene.add(group);
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const pickJob = (event: PointerEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -(((event.clientY - bounds.top) / bounds.height) * 2 - 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(hitTargets, false)[0];
      return hit?.object.userData.jobId as JobId | undefined;
    };

    const onPointerMove = (event: PointerEvent) => {
      renderer.domElement.style.cursor = pickJob(event) ? 'pointer' : 'default';
    };

    const onPointerClick = (event: PointerEvent) => {
      const jobId = pickJob(event);
      if (jobId) onSelectJob(jobId);
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerClick);

    let raf = 0;
    const clock = new THREE.Clock();
    const render = () => {
      const t = clock.getElapsedTime();
      groups.forEach((group, id) => {
        const selected = id === selectedJobId;
        group.visible = selected;
        group.rotation.z = t * 0.55;
        group.scale.setScalar(1 + Math.sin(t * 2.6) * (selected ? 0.075 : 0));
        const pulse = group.children[1] as THREE.Mesh;
        pulse.scale.setScalar(1.1 + Math.sin(t * 2.2) * 0.18);
        const material = pulse.material as THREE.MeshBasicMaterial;
        material.opacity = 0.16 + Math.sin(t * 2.2) * 0.08;
      });
      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };
    render();

    const resize = () => {
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    };
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerClick);
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, [onSelectJob, selectedJobId]);

  return <div className="mockup-three" ref={hostRef} aria-hidden="true" />;
}
