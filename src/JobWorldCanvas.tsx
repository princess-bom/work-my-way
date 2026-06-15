import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { JobId } from './domain';

type JobWorldCanvasProps = {
  selectedJobId: JobId;
};

const nodePositions: Record<JobId, { x: number; y: number; color: number }> = {
  'library-aide': { x: -2.8, y: 0.72, color: 0x5f8fd8 },
  'barista-aide': { x: 0, y: 1.02, color: 0x50b99b },
  'baker-aide': { x: 2.75, y: -0.15, color: 0xe3a55e }
};

export function JobWorldCanvas({ selectedJobId }: JobWorldCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    if (host.clientWidth < 1 || host.clientHeight < 1) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
      if (!renderer.getContext()) return;
    } catch {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, host.clientWidth / host.clientHeight, 0.1, 100);
    camera.position.set(0, 0.4, 8);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 1.6);
    scene.add(ambient);
    const key = new THREE.PointLight(0xf5d99d, 5.2, 20);
    key.position.set(0, 4, 5);
    scene.add(key);

    const pathMaterial = new THREE.MeshBasicMaterial({ color: 0xd2be9d, transparent: true, opacity: 0.62 });
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-3, -1.2, -1.2),
      new THREE.Vector3(-1.35, 0.55, -1),
      new THREE.Vector3(0.05, 1.02, -0.8),
      new THREE.Vector3(1.55, 0.38, -1),
      new THREE.Vector3(3.1, -0.35, -1.1)
    ]);
    const path = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: 0xb58f61, transparent: true, opacity: 0.55 }));
    scene.add(path);

    const groups = new Map<JobId, THREE.Group>();
    Object.entries(nodePositions).forEach(([id, position]) => {
      const group = new THREE.Group();
      group.position.set(position.x, position.y, 0);
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.58, 0.74, 0.18, 48),
        new THREE.MeshStandardMaterial({ color: position.color, roughness: 0.48, metalness: 0.04 })
      );
      base.rotation.x = Math.PI / 2;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.78, 0.035, 12, 96),
        new THREE.MeshBasicMaterial({ color: position.color, transparent: true, opacity: id === selectedJobId ? 0.92 : 0.24 })
      );
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.21, 32, 24),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 })
      );
      marker.position.z = 0.23;
      group.add(base, ring, marker);
      groups.set(id as JobId, group);
      scene.add(group);
    });

    const grid = new THREE.Group();
    for (let i = 0; i < 18; i += 1) {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(8.8, 0.012, 0.012),
        pathMaterial
      );
      strip.position.set(0, -1.8 + i * 0.22, -1.55);
      strip.rotation.z = i % 2 ? 0.08 : -0.08;
      grid.add(strip);
    }
    scene.add(grid);

    let raf = 0;
    const clock = new THREE.Clock();
    let active = true;
    const render = () => {
      if (!active) return;
      try {
        const t = clock.getElapsedTime();
        groups.forEach((group, id) => {
          const isSelected = id === selectedJobId;
          group.position.z = Math.sin(t * 1.4 + group.position.x) * 0.07 + (isSelected ? 0.24 : 0);
          group.rotation.z = Math.sin(t + group.position.x) * 0.035;
          const ring = group.children[1] as THREE.Mesh;
          ring.scale.setScalar(isSelected ? 1 + Math.sin(t * 3) * 0.055 : 1);
          const material = ring.material as THREE.MeshBasicMaterial;
          material.opacity = isSelected ? 0.78 + Math.sin(t * 3) * 0.12 : 0.22;
        });
        grid.rotation.z = Math.sin(t * 0.22) * 0.018;
        key.intensity = 4.7 + Math.sin(t * 0.9) * 0.5;
        renderer.render(scene, camera);
        raf = requestAnimationFrame(render);
      } catch {
        active = false;
      }
    };
    render();

    const resize = () => {
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    };
    window.addEventListener('resize', resize);

    return () => {
      active = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      renderer.dispose();
      if (renderer.domElement.parentElement === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, [selectedJobId]);

  return <div ref={hostRef} className="job-world-canvas" aria-hidden="true" />;
}
