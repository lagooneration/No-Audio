import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { AudioFile, Audio3DSource, FrequencyData } from '@/types/audio';

interface Audio3DVisualizerProps {
  audioFile?: AudioFile;
  frequencyData?: FrequencyData;
  sources?: Audio3DSource[];
  width?: number;
  height?: number;
  className?: string;
  onSourceSelect?: (sourceId: string) => void;
  enableInteraction?: boolean;
}

export const Audio3DVisualizer: React.FC<Audio3DVisualizerProps> = ({
  audioFile,
  frequencyData,
  sources = [],
  width = 800,
  height = 600,
  className = '',
  onSourceSelect,
  enableInteraction = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Audio visualization objects
  const visualizersRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const waveformGeometryRef = useRef<THREE.BufferGeometry | null>(null);
  const frequencyBarsRef = useRef<THREE.Group | null>(null);

  // Initialize Three.js scene
  const initializeScene = useCallback(() => {
    if (!containerRef.current || isInitialized) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    containerRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Grid helper
    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
    scene.add(gridHelper);

    // Frequency visualization setup
    const group = new THREE.Group();
    const barCount = 64;
    const radius = 8;

    for (let i = 0; i < barCount; i++) {
      const geometry = new THREE.CylinderGeometry(0.1, 0.1, 1, 8);
      const material = new THREE.MeshPhongMaterial({
        color: new THREE.Color().setHSL((i / barCount) * 0.8, 0.8, 0.6),
        transparent: true,
        opacity: 0.8,
      });
      
      const bar = new THREE.Mesh(geometry, material);
      const angle = (i / barCount) * Math.PI * 2;
      bar.position.set(
        Math.cos(angle) * radius,
        0.5,
        Math.sin(angle) * radius
      );
      
      group.add(bar);
    }

    frequencyBarsRef.current = group;
    scene.add(group);

    setIsInitialized(true);
  }, [width, height, isInitialized]);

  // Create waveform visualization
  const createWaveformVisualization = useCallback(() => {
    if (!sceneRef.current || !audioFile) return;

    const points: THREE.Vector3[] = [];
    const sampleCount = Math.min(1000, audioFile.audioBuffer.length);
    const channelData = audioFile.audioBuffer.getChannelData(0);
    const step = Math.floor(channelData.length / sampleCount);

    for (let i = 0; i < sampleCount; i++) {
      const x = (i / sampleCount) * 16 - 8; // Spread across 16 units
      const y = channelData[i * step] * 3; // Scale amplitude
      const z = 0;
      points.push(new THREE.Vector3(x, y, z));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ 
      color: 0x00ff88,
      linewidth: 2,
    });
    
    const waveform = new THREE.Line(geometry, material);
    waveform.position.y = 2;
    
    waveformGeometryRef.current = geometry;
    sceneRef.current.add(waveform);
  }, [audioFile]);

  // Create 3D audio source visualization
  const create3DAudioSource = useCallback((source: Audio3DSource) => {
    if (!sceneRef.current) return null;

    const geometry = new THREE.SphereGeometry(0.5, 16, 16);
    const material = new THREE.MeshPhongMaterial({
      color: 0xff6b6b,
      transparent: true,
      opacity: 0.8,
    });
    
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(source.position.x, source.position.y, source.position.z);
    sphere.userData = { sourceId: source.id, type: 'audioSource' };
    
    // Add pulsing animation
    const scale = 1 + source.volume * 0.5;
    sphere.scale.setScalar(scale);
    
    // Add directional cone visualization
    if (source.cone.innerAngle < 360) {
      const coneGeometry = new THREE.ConeGeometry(
        Math.tan((source.cone.outerAngle * Math.PI) / 360) * source.distance,
        source.distance,
        16
      );
      const coneMaterial = new THREE.MeshBasicMaterial({
        color: 0xff6b6b,
        transparent: true,
        opacity: 0.2,
        wireframe: true,
      });
      const cone = new THREE.Mesh(coneGeometry, coneMaterial);
      cone.position.copy(sphere.position);
      cone.rotateX(-Math.PI / 2);
      sceneRef.current.add(cone);
    }

    sceneRef.current.add(sphere);
    return sphere;
  }, []);

  // Update frequency visualization
  const updateFrequencyVisualization = useCallback(() => {
    if (!frequencyBarsRef.current || !frequencyData) return;

    const bars = frequencyBarsRef.current.children as THREE.Mesh[];
    const frequencyArray = frequencyData.frequencies;
    const barCount = Math.min(bars.length, frequencyArray.length);

    for (let i = 0; i < barCount; i++) {
      const bar = bars[i];
      const frequency = frequencyArray[i] / 255; // Normalize to 0-1
      
      // Update height
      bar.scale.y = Math.max(0.1, frequency * 5);
      
      // Update color based on frequency intensity
      const material = bar.material as THREE.MeshPhongMaterial;
      material.color.setHSL((i / barCount) * 0.8, 0.8, 0.3 + frequency * 0.7);
      
      // Update position for wave effect
      bar.position.y = frequency * 2;
    }
  }, [frequencyData]);

  // Animation loop
  const animate = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

    updateFrequencyVisualization();

    // Rotate frequency bars
    if (frequencyBarsRef.current) {
      frequencyBarsRef.current.rotation.y += 0.01;
    }

    // Update audio source visualizations
    visualizersRef.current.forEach((mesh, sourceId) => {
      const source = sources.find(s => s.id === sourceId);
      if (source) {
        // Pulsing effect based on volume
        const scale = 1 + Math.sin(Date.now() * 0.01) * source.volume * 0.3;
        mesh.scale.setScalar(scale);
      }
    });

    rendererRef.current.render(sceneRef.current, cameraRef.current);
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [updateFrequencyVisualization, sources]);

  // Handle mouse interactions
  const handleCanvasClick = useCallback((event: MouseEvent) => {
    if (!enableInteraction || !cameraRef.current || !sceneRef.current) return;

    const canvas = event.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    const intersects = raycaster.intersectObjects(sceneRef.current.children, true);
    
    for (const intersect of intersects) {
      const object = intersect.object;
      if (object.userData.type === 'audioSource') {
        onSourceSelect?.(object.userData.sourceId);
        break;
      }
    }
  }, [enableInteraction, onSourceSelect]);

  // Initialize scene on mount
  useEffect(() => {
    const container = containerRef.current;
    initializeScene();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (container && rendererRef.current) {
        container.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current?.dispose();
    };
  }, [initializeScene]);

  // Start animation loop
  useEffect(() => {
    if (isInitialized) {
      animate();
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isInitialized, animate]);

  // Create waveform when audio file changes
  useEffect(() => {
    if (audioFile && isInitialized) {
      createWaveformVisualization();
    }
  }, [audioFile, isInitialized, createWaveformVisualization]);

  // Update 3D sources
  useEffect(() => {
    if (!isInitialized) return;

    // Remove old visualizers
    visualizersRef.current.forEach((mesh, sourceId) => {
      if (!sources.find(s => s.id === sourceId)) {
        sceneRef.current?.remove(mesh);
        visualizersRef.current.delete(sourceId);
      }
    });

    // Add new visualizers
    sources.forEach(source => {
      if (!visualizersRef.current.has(source.id)) {
        const mesh = create3DAudioSource(source);
        if (mesh) {
          visualizersRef.current.set(source.id, mesh);
        }
      }
    });
  }, [sources, isInitialized, create3DAudioSource]);

  // Add canvas event listeners
  useEffect(() => {
    const canvas = rendererRef.current?.domElement;
    if (canvas && enableInteraction) {
      canvas.addEventListener('click', handleCanvasClick);
      return () => {
        canvas.removeEventListener('click', handleCanvasClick);
      };
    }
  }, [handleCanvasClick, enableInteraction]);

  return (
    <div 
      ref={containerRef} 
      className={`audio-3d-visualizer ${className}`}
      style={{ width, height }}
    >
      {!isInitialized && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <span>Initializing 3D visualizer...</span>
        </div>
      )}
    </div>
  );
};

export default Audio3DVisualizer;