import { useMemo } from "react"
import { ThreeCanvas } from "@remotion/three"
import { useThree } from "@react-three/fiber"
import * as THREE from "three"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import { C, W, H } from "../../tokens"
import { turntable } from "./beats"

/** Camera: fov 30 at z 12, so 1 world unit = K px at z 0 (lets DOM and 3D share screen coordinates). */
const FOV = 30
const CAM_Z = 12
export const K = H / (2 * CAM_Z * Math.tan((FOV / 2) * (Math.PI / 180)))
const toWorld = (x: number, y: number): [number, number] => [(x - W / 2) / K, -(y - H / 2) / K]

export type CrystalPose = {
  absFrame: number // absolute film frame, drives the turntable
  x: number // screen centre px
  y: number
  r: number // circumradius px
  orbit?: number // extra yaw (rad): the 20° orbit
  pulse?: number // 0→1 lavender flash when an entry lands
  fan?: number // 0→1 shard fan behind the crystal
}

function Studio() {
  const { gl, scene } = useThree()
  useMemo(() => {
    const pm = new THREE.PMREMGenerator(gl)
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture
    scene.background = new THREE.Color(C.paper)
    pm.dispose()
  }, [gl, scene])
  return (
    <>
      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#ffffff", C.lav100, 0.6]} />
      <directionalLight position={[-4, 6, 8]} intensity={1.1} />
      <directionalLight position={[5, -2, 4]} intensity={0.35} color={C.lav} />
    </>
  )
}

/** Shard fan behind the crystal (the hero's lavender/green rays), kept to the vertical axis. */
const RAYS: { a: number; l: number; w: number }[] = [
  { a: -0.46, l: 1.9, w: 0.5 },
  { a: -0.2, l: 2.15, w: 0.34 },
  { a: 0.06, l: 2.0, w: 0.46 },
  { a: 0.32, l: 1.8, w: 0.3 },
  { a: Math.PI - 0.3, l: 1.7, w: 0.42 },
  { a: Math.PI - 0.04, l: 1.8, w: 0.3 },
  { a: Math.PI + 0.24, l: 1.65, w: 0.4 },
]

/** Wedge from the origin widening to `w` at length 1 (scaled per ray). */
function useWedge() {
  return useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(0, 0)
    s.lineTo(-0.5, 1)
    s.lineTo(0.5, 1)
    s.closePath()
    return new THREE.ShapeGeometry(s)
  }, [])
}

function Fan({ r, t }: { r: number; t: number }) {
  const wedge = useWedge()
  return (
    <group position={[0, 0, -0.9]}>
      {RAYS.map((ray, i) => (
        <mesh key={i} geometry={wedge} rotation={[0, 0, ray.a]} position={[0, 0, -i * 0.01]} scale={[r * ray.w, Math.max(0.001, r * ray.l * 0.82 * t), 1]}>
          <meshBasicMaterial color={i % 2 ? C.green : C.lav} transparent opacity={(i % 2 ? 0.8 : 0.95) * Math.min(1, t * 1.5)} />
        </mesh>
      ))}
    </group>
  )
}

/** Per-facet glass tints: mostly pale lavender, a few mint-green facets (the app's lav/green pair). */
const CORE = "#2d7363"
const FACETS = ["#e2dbff", "#d6ccff", "#eef0ec", "#cfe7db", "#ddd4ff", "#c9bdff", "#e6efe9"]

function Gem({ r, spin, pulse }: { r: number; spin: number; pulse: number }) {
  const geo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(1, 0)
    const pal = FACETS.map((c) => new THREE.Color(c))
    const n = g.attributes.position.count
    const col = new Float32Array(n * 3)
    for (let v = 0; v < n; v++) pal[Math.floor(v / 3) % pal.length].toArray(col, v * 3)
    g.setAttribute("color", new THREE.BufferAttribute(col, 3))
    return g
  }, [])
  const edges = useMemo(() => new THREE.EdgesGeometry(geo), [geo])
  const core = useMemo(() => new THREE.OctahedronGeometry(0.5, 0), [])
  const tint = new THREE.Color("#ffffff").lerp(new THREE.Color(C.lav), pulse * 0.35)
  return (
    <group scale={r * (1 + pulse * 0.035)}>
      <group rotation={[0.42 + Math.sin(spin * 0.7) * 0.08, spin, 0.18]}>
        <mesh geometry={geo}>
          <meshPhysicalMaterial
            color={tint}
            vertexColors
            transmission={1}
            roughness={0.3}
            thickness={1.6}
            ior={1.46}
            attenuationColor={new THREE.Color("#e9e4ff")}
            attenuationDistance={3.5}
            clearcoat={1}
            clearcoatRoughness={0.12}
            iridescence={0}
            iridescenceIOR={1.3}
            specularIntensity={1}
            envMapIntensity={1.25}
            emissive={new THREE.Color(C.lav300)}
            emissiveIntensity={pulse * 0.12}
            flatShading
          />
        </mesh>
        <lineSegments geometry={edges}>
          <lineBasicMaterial color="#ffffff" transparent opacity={0.55} />
        </lineSegments>
      </group>
      <mesh geometry={core} rotation={[0.6, -spin * 1.6, 0.3]}>
        <meshStandardMaterial color={CORE} roughness={0.3} metalness={0} emissive={new THREE.Color(C.lav300)} emissiveIntensity={0.16 + pulse * 0.28} flatShading />
      </mesh>
    </group>
  )
}

/** The sealed engine: frosted lavender/green glass icosahedron, slow turntable, shadowless studio. */
export function CrystalCanvas({ absFrame, x, y, r, orbit = 0, pulse = 0, fan = 0 }: CrystalPose) {
  const [wx, wy] = toWorld(x, y)
  const rw = r / K
  return (
    <ThreeCanvas width={W} height={H} flat camera={{ fov: FOV, position: [0, 0, CAM_Z], near: 0.1, far: 100 }} gl={{ antialias: true, preserveDrawingBuffer: true }}>
      <Studio />
      <group position={[wx, wy, 0]} rotation={[0, orbit, 0]}>
        {fan > 0 ? <Fan r={rw} t={fan} /> : null}
        <Gem r={rw} spin={turntable(absFrame)} pulse={pulse} />
      </group>
    </ThreeCanvas>
  )
}
