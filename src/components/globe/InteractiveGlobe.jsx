import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Html } from '@react-three/drei'
import * as THREE from 'three'

function latLngToVec3(lat, lng, radius = 1.02) {
  const phi   = (90 - lat)  * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
     radius * Math.cos(phi),
     radius * Math.sin(phi) * Math.sin(theta)
  )
}

function GlobeMarker({ position, label, isActive }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (ref.current) ref.current.scale.setScalar(1 + Math.sin(clock.getElapsedTime() * 3) * 0.15)
  })
  return (
    <group position={position}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.022, 12, 12]} />
        <meshStandardMaterial
          color={isActive ? '#f97316' : '#f59e0b'}
          emissive={isActive ? '#ea580c' : '#d97706'}
          emissiveIntensity={1.5}
        />
      </mesh>
      <Html distanceFactor={4} center>
        <div style={{
          background: 'rgba(255,255,255,0.95)',
          border: `1px solid ${isActive ? '#f9731655' : '#f59e0b55'}`,
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          borderRadius: 6, padding: '2px 8px',
          color: isActive ? '#ea580c' : '#92400e',
          fontSize: 10, fontWeight: '600',
          fontFamily: 'sans-serif',
          whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>
          {label}
        </div>
      </Html>
    </group>
  )
}

function Earth({ markers = [] }) {
  const meshRef   = useRef()
  const glowRef   = useRef()

  useFrame((_, delta) => {
    if (meshRef.current)  meshRef.current.rotation.y  += delta * 0.05
    if (glowRef.current)  glowRef.current.rotation.y  += delta * 0.03
  })

  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024; canvas.height = 512
    const ctx = canvas.getContext('2d')

    // Ocean gradient (Brighter blue)
    const og = ctx.createLinearGradient(0, 0, 0, 512)
    og.addColorStop(0,   '#e0f2fe')
    og.addColorStop(0.5, '#bae6fd')
    og.addColorStop(1,   '#e0f2fe')
    ctx.fillStyle = og
    ctx.fillRect(0, 0, 1024, 512)

    // Landmasses (stylised blobs - vibrant green)
    const lands = [
      // North America
      { x: 180, y: 160, rx: 80, ry: 55, rot: 0.2 },
      { x: 220, y: 230, rx: 55, ry: 45, rot: 0.1 },
      { x: 160, y: 210, rx: 40, ry: 30, rot: -0.1 },
      // South America
      { x: 250, y: 310, rx: 38, ry: 65, rot: 0.1 },
      // Europe
      { x: 510, y: 155, rx: 38, ry: 28, rot: 0.05 },
      // Africa
      { x: 515, y: 255, rx: 45, ry: 70, rot: 0 },
      // Asia
      { x: 680, y: 155, rx: 110, ry: 65, rot: -0.05 },
      { x: 750, y: 230, rx: 60, ry: 40, rot: 0.1 },
      // India
      { x: 650, y: 240, rx: 28, ry: 42, rot: 0.05 },
      // Oceania
      { x: 820, y: 330, rx: 50, ry: 30, rot: 0.1 },
      { x: 890, y: 355, rx: 20, ry: 14, rot: 0 },
      // Greenland
      { x: 310, y: 95,  rx: 30, ry: 22, rot: 0 },
    ]

    lands.forEach(({ x, y, rx, ry, rot }) => {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rot)
      const lg = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry))
      lg.addColorStop(0,   '#34d399')
      lg.addColorStop(0.6, '#10b981')
      lg.addColorStop(1,   '#059669')
      ctx.fillStyle = lg
      ctx.beginPath()
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    })

    // Grid lines (Subtle)
    ctx.strokeStyle = 'rgba(14,165,233,0.1)'
    ctx.lineWidth = 0.8
    for (let lat = -80; lat <= 80; lat += 20) {
      const y = ((90 - lat) / 180) * 512
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke()
    }
    for (let lng = 0; lng < 360; lng += 30) {
      const x = (lng / 360) * 1024
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke()
    }

    // Equator highlight
    ctx.strokeStyle = 'rgba(249,115,22,0.15)'
    ctx.lineWidth = 1.5
    const eq = (90 / 180) * 512
    ctx.beginPath(); ctx.moveTo(0, eq); ctx.lineTo(1024, eq); ctx.stroke()

    return new THREE.CanvasTexture(canvas)
  }, [])

  const destinationCoords = {
    'Goa':        { lat: 15.2993, lng: 74.1240 },
    'Manali':     { lat: 32.2432, lng: 77.1892 },
    'Kerala':     { lat: 10.8505, lng: 76.2711 },
    'Rajasthan':  { lat: 27.0238, lng: 74.2179 },
    'Mumbai':     { lat: 19.0760, lng: 72.8777 },
    'Delhi':      { lat: 28.6139, lng: 77.2090 },
    'Bengaluru':  { lat: 12.9716, lng: 77.5946 },
    'Shimla':     { lat: 31.1048, lng: 77.1734 },
    'Jaipur':     { lat: 26.9124, lng: 75.7873 },
    'Varanasi':   { lat: 25.3176, lng: 82.9739 },
    'Rishikesh':  { lat: 30.0869, lng: 78.2676 },
    'Andaman':    { lat: 11.7401, lng: 92.6586 },
  }

  return (
    <>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 72, 72]} />
        <meshStandardMaterial map={texture} roughness={0.6} metalness={0.1} />
        {markers.map((m, i) => {
          const coords = destinationCoords[m.label]
          if (!coords) return null
          const pos = latLngToVec3(coords.lat, coords.lng)
          return <GlobeMarker key={i} position={[pos.x, pos.y, pos.z]} label={m.label} isActive={m.isActive} />
        })}
      </mesh>

      {/* Subtle Halo */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[1.05, 32, 32]} />
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.08} side={THREE.BackSide} />
      </mesh>
    </>
  )
}

export default function InteractiveGlobe({ markers = [] }) {
  return (
    <Canvas camera={{ position: [0, 0, 2.7], fov: 42 }} gl={{ antialias: true, alpha: true }} style={{ background: 'transparent' }}>
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 3, 5]} intensity={1.5} color="#ffffff" />
      <pointLight position={[-4, -2, -4]} intensity={0.8} color="#ffedd5" />
      <pointLight position={[0, 4, 2]}   intensity={0.4} color="#f97316" />
      {/* Stars hidden in light mode for cleaner look */}
      <Earth markers={markers} />
      <OrbitControls enableZoom={true} enablePan={false} minDistance={1.7} maxDistance={4.5} rotateSpeed={0.45} zoomSpeed={0.5} />
    </Canvas>
  )
}
