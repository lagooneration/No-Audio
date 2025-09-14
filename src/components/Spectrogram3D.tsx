"use client";

import React, { useEffect, useRef, useCallback } from "react";
import * as THREE from 'three';
import "../styles/Spectrogram3D.css";

export interface Spectrogram3DProps {
  className?: string;
  analyser?: AnalyserNode | null;
  isPlaying?: boolean;
}

// 3D Spectrogram visualization component using Three.js
export const Spectrogram3D: React.FC<Spectrogram3DProps> = ({
  className = "",
  analyser = null,
  isPlaying = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const controlsRef = useRef<unknown | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const dataRef = useRef<Uint8Array | null>(null);
  const heightsRef = useRef<Uint8Array | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);

  // Constants for the 3D grid
  const FREQUENCY_SAMPLES = 256;
  const TIME_SAMPLES = 128;
  const XSIZE = 20;
  const YSIZE = 12;
  const XHALFSIZE = XSIZE / 2;
  const YHALFSIZE = YSIZE / 2;
  const XSEGMENTS = TIME_SAMPLES;
  const YSEGMENTS = FREQUENCY_SAMPLES;
  const XSEGMENTSIZE = XSIZE / XSEGMENTS;
  const N_VERTICES = (FREQUENCY_SAMPLES + 1) * (TIME_SAMPLES + 1);

  const initThreeJS = useCallback(() => {
    if (!containerRef.current) return;

    // Create the scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    sceneRef.current = scene;

    // Create camera
    const camera = new THREE.PerspectiveCamera(
      50, 
      containerRef.current.clientWidth / containerRef.current.clientHeight, 
      0.1, 
      1000
    );
    camera.position.set(0, 4, 25);
    cameraRef.current = camera;

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // We're not using OrbitControls to avoid importing the dependency
    // Simple camera rotation instead
    camera.lookAt(0, 0, 0);
    controlsRef.current = null;

    // Initialize data arrays
    dataRef.current = new Uint8Array(FREQUENCY_SAMPLES);
    const heightsArray = new Array(N_VERTICES).fill(0);
    heightsRef.current = new Uint8Array(heightsArray);

    // Create geometry
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const indices: number[] = [];
    
    // Generate vertices for the grid
    for (let i = 0; i <= XSEGMENTS; i++) {
      const x = (i * XSEGMENTSIZE) - XHALFSIZE;
      for (let j = 0; j <= YSEGMENTS; j++) {
        // Use logarithmic spacing for frequencies (y-axis)
        const yPowMax = Math.log(YSIZE);
        const yBase = Math.E;
        const powr = (YSEGMENTS - j) / YSEGMENTS * yPowMax;
        const y = -Math.pow(yBase, powr) + YHALFSIZE + 1;
        
        vertices.push(x, y, 0);
      }
    }
    
    // Generate indices for the triangles
    for (let i = 0; i < XSEGMENTS; i++) {
      for (let j = 0; j < YSEGMENTS; j++) {
        const a = i * (YSEGMENTS + 1) + (j + 1);
        const b = i * (YSEGMENTS + 1) + j;
        const c = (i + 1) * (YSEGMENTS + 1) + j;
        const d = (i + 1) * (YSEGMENTS + 1) + (j + 1);
        
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }
    
    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('displacement', new THREE.Uint8BufferAttribute(heightsRef.current, 1));
    geometry.computeVertexNormals();

    // Create color lookup table
    const jetColors = generateJetColormap(256);
    const lutArray = new Float32Array(jetColors.length * 3);
    for (let i = 0; i < jetColors.length; i++) {
      lutArray[i * 3] = jetColors[i][0];      // R
      lutArray[i * 3 + 1] = jetColors[i][1];  // G
      lutArray[i * 3 + 2] = jetColors[i][2];  // B
    }

    // Create shader material
    const shaderMaterial = new THREE.ShaderMaterial({
      uniforms: {
        colorMap: { value: new THREE.DataTexture(lutArray, jetColors.length, 1, THREE.RGBFormat, THREE.FloatType) }
      },
      vertexShader: `
        attribute float displacement;
        varying vec3 vColor;
        
        vec3 getJetColor(float value) {
          // Enhanced jet colormap implementation for better visibility
          float v = clamp(value, 0.0, 1.0);
          
          vec3 color;
          if (v < 0.2) {
            // Blue to Cyan (0-0.2)
            float t = v / 0.2;
            color = vec3(0.0, t, 1.0);
          } else if (v < 0.4) {
            // Cyan to Green (0.2-0.4)
            float t = (v - 0.2) / 0.2;
            color = vec3(0.0, 1.0, 1.0 - t);
          } else if (v < 0.6) {
            // Green to Yellow (0.4-0.6)
            float t = (v - 0.4) / 0.2;
            color = vec3(t, 1.0, 0.0);
          } else if (v < 0.8) {
            // Yellow to Red (0.6-0.8)
            float t = (v - 0.6) / 0.2;
            color = vec3(1.0, 1.0 - t, 0.0);
          } else {
            // Red to White (0.8-1.0)
            float t = (v - 0.8) / 0.2;
            color = vec3(1.0, t, t);
          }
          return color;
        }
        
        void main() {
          vColor = getJetColor(displacement / 255.0);
          vec3 newPosition = position + normal * displacement / 25.5;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        
        void main() {
          gl_FragColor = vec4(vColor, 1.0);
        }
      `
    });
    
    materialRef.current = shaderMaterial;

    // Create mesh
    const mesh = new THREE.Mesh(geometry, shaderMaterial);
    mesh.rotation.x = -Math.PI / 6; // Tilt the mesh for a better view
    scene.add(mesh);
    meshRef.current = mesh;

    // Add ambient light for better visibility
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // Initial render
    renderer.render(scene, camera);
  }, [FREQUENCY_SAMPLES, YSIZE, XHALFSIZE, YHALFSIZE, XSEGMENTS, YSEGMENTS, XSEGMENTSIZE, N_VERTICES]);

  // Generate a color map similar to the "jet" colormap with enhanced visibility
  const generateJetColormap = (numColors: number): [number, number, number][] => {
    const colors: [number, number, number][] = [];
    
    for (let i = 0; i < numColors; i++) {
      const t = i / (numColors - 1);
      let r, g, b;
      
      if (t < 0.2) {
        // Blue to Cyan (0-0.2)
        const norm = t / 0.2;
        r = 0;
        g = norm;
        b = 1;
      } else if (t < 0.4) {
        // Cyan to Green (0.2-0.4)
        const norm = (t - 0.2) / 0.2;
        r = 0;
        g = 1;
        b = 1 - norm;
      } else if (t < 0.6) {
        // Green to Yellow (0.4-0.6)
        const norm = (t - 0.4) / 0.2;
        r = norm;
        g = 1;
        b = 0;
      } else if (t < 0.8) {
        // Yellow to Red (0.6-0.8)
        const norm = (t - 0.6) / 0.2;
        r = 1;
        g = 1 - norm;
        b = 0;
      } else {
        // Red to White (0.8-1.0)
        const norm = (t - 0.8) / 0.2;
        r = 1;
        g = norm;
        b = norm;
      }
      
      colors.push([r, g, b]);
    }
    
    return colors;
  };

  const updateGeometry = useCallback(() => {
    if (!dataRef.current || !heightsRef.current || !meshRef.current || !analyser) return;

    try {
      // Create a temporary array to store frequency data
      const tempData = new Uint8Array(FREQUENCY_SAMPLES);
      
      // Get frequency data from audio analyser
      analyser.getByteFrequencyData(tempData);
      
      // Copy the data to our ref
      if (dataRef.current) {
        for (let i = 0; i < FREQUENCY_SAMPLES; i++) {
          dataRef.current[i] = tempData[i];
        }
      }

      if (isPlaying) {
        // Shift existing data to the left (scrolling effect) - only when playing
        const startVal = FREQUENCY_SAMPLES + 1;
        const endVal = N_VERTICES - startVal;
        heightsRef.current.copyWithin(0, startVal, N_VERTICES);
        
        // Insert new data at the end
        heightsRef.current.set(dataRef.current, endVal);
      } else {
        // When not playing, create a static visualization
        // Fill the entire heightsRef with the current frequency data
        for (let i = 0; i < TIME_SAMPLES + 1; i++) {
          const offset = i * (FREQUENCY_SAMPLES + 1);
          for (let j = 0; j < FREQUENCY_SAMPLES; j++) {
            heightsRef.current[offset + j] = dataRef.current[j];
          }
        }
      }
      
      // Update the geometry with new displacement values
      if (meshRef.current.geometry) {
        meshRef.current.geometry.setAttribute(
          'displacement', 
          new THREE.Uint8BufferAttribute(heightsRef.current, 1)
        );
        
        // Notify three.js that the attribute has been updated
        const displacementAttribute = meshRef.current.geometry.getAttribute('displacement');
        displacementAttribute.needsUpdate = true;
      }
    } catch (error) {
      console.error('Error updating spectrogram geometry:', error);
    }
  }, [analyser, N_VERTICES, FREQUENCY_SAMPLES, TIME_SAMPLES, isPlaying]);

  const animate = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    
    animationFrameRef.current = requestAnimationFrame(animate);
    
    // Always update geometry when analyser is available
    // This ensures visualization even when paused
    if (analyser) {
      updateGeometry();
      
      // Add some gentle camera animation only when playing
      if (isPlaying) {
        const time = Date.now() * 0.0005; // Slower animation
        const radius = 25;
        cameraRef.current.position.x = Math.sin(time) * radius * 0.15;
        cameraRef.current.position.y = Math.cos(time) * radius * 0.05 + 10;
        cameraRef.current.lookAt(0, 0, 0);
      }
    }
    
    rendererRef.current.render(sceneRef.current, cameraRef.current);
  }, [updateGeometry, isPlaying, analyser]);

  // Handle resize
  const handleResize = useCallback(() => {
    if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
    
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    
    // Update camera
    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();
    
    // Update renderer
    rendererRef.current.setSize(width, height, false); // false to maintain pixel ratio
    
    // Render a frame to reflect changes
    if (sceneRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  }, []);

  // Initialize Three.js
  useEffect(() => {
    initThreeJS();
    
    // Initial resize to ensure proper dimensions
    setTimeout(handleResize, 0);
    
    // Add resize listener
    window.addEventListener('resize', handleResize);
    
    // Store reference to the DOM elements for cleanup
    const containerElement = containerRef.current;
    const rendererDomElement = rendererRef.current?.domElement;
    
    return () => {
      // Cancel any pending animation frame
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      // Clean up the geometry
      if (meshRef.current && meshRef.current.geometry) {
        meshRef.current.geometry.dispose();
      }
      
      // Clean up materials
      if (meshRef.current && meshRef.current.material) {
        if (Array.isArray(meshRef.current.material)) {
          meshRef.current.material.forEach(material => material.dispose());
        } else {
          meshRef.current.material.dispose();
        }
      }
      
      // Clean up renderer and remove from DOM safely
      if (rendererRef.current) {
        rendererRef.current.dispose();
        
        if (rendererDomElement && containerElement) {
          try {
            containerElement.removeChild(rendererDomElement);
          } catch (error) {
            console.error('Error removing renderer from DOM:', error);
          }
        }
      }
      
      // Clean up scene
      if (sceneRef.current) {
        sceneRef.current.clear();
      }
      
      window.removeEventListener('resize', handleResize);
    };
  }, [initThreeJS, handleResize]);

  // Start animation loop
  useEffect(() => {
    // Only start animation if component is mounted
    let isComponentMounted = true;
    
    // Define a local animation function that checks mounting state
    const safeAnimate = () => {
      if (isComponentMounted) {
        animate();
      }
    };
    
    // Start animation loop
    safeAnimate();
    
    // Cleanup function
    return () => {
      // Mark component as unmounted
      isComponentMounted = false;
      
      // Cancel any pending animation frame
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [animate]);

  return (
    <div 
      ref={containerRef}
      className={`spectrogram-3d-container ${className}`}
      style={{ width: "100%", height: "100%" }}
    >
      {!analyser && (
        <div className="spectrogram-3d-overlay">
          <h3 className="spectrogram-3d-title">3D Spectrogram</h3>
          <p className="spectrogram-3d-description">
            Play audio to visualize the 3D frequency spectrum
          </p>
        </div>
      )}
      {analyser && !isPlaying && (
        <div className="spectrogram-3d-overlay" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <p className="spectrogram-3d-description">
            Press play to animate the spectrogram
          </p>
        </div>
      )}
    </div>
  );
};

export default Spectrogram3D;