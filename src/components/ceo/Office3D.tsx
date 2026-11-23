'use client'

// 헌드레드 사무실 3D 장면 — three.js. 귀여운 3D 캐릭터와 책상·유리벽·홀로그램 테이블이 있는 아이소메트릭 사무실.
// 데이터·보고 판단은 OfficeTab 이 하고, 여기서는 그리기·움직임·마우스 반응만 한다.
import { useEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

export type DeptKey = 'ceo' | 'revenue' | 'tax' | 'legal' | 'sales' | 'dig' | 'ops' | 'qa'
export type SceneItem = { id: string; kind: 'human' | 'bot'; name: string; label: string; dept: DeptKey; accent: string; shirt: string; roam?: boolean }
export type SceneCluster = { dept: DeptKey; accent: string; angle: number; items: SceneItem[] }

type Props = {
  clusters: SceneCluster[]
  slots: Record<string, number>            // 보고 중인 사람/AI id → 보고 자리 번호 (대표 앞)
  pinkSlot: number | null                  // 핑크가 향할 보고 자리 (없으면 순찰)
  selectedId: string | null
  focusDept: DeptKey | null
  hoverDept: DeptKey | null
  onHover: (dept: DeptKey | null, itemId: string | null) => void
  onPick: (dept: DeptKey | null, itemId: string | null) => void
  renderSign: (dept: DeptKey) => ReactNode
  bubbleIds: string[]
  renderBubble: (id: string, below: boolean) => ReactNode
  pinkSay: string
}

const HAIR = ['#20170f', '#3b2616', '#121212', '#5a3a1e', '#2d2236', '#6b3d17', '#8a5a2b']
const SKIN = ['#f6d3b0', '#efc29a', '#f9dfc4', '#deae85']
const hash = (s: string) => Array.from(s).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
const RIGHT = new THREE.Vector3(1, 0, -1).normalize()      // 화면 오른쪽
const FRONT = new THREE.Vector3(1, 0, 1).normalize()       // 화면 아래쪽(카메라 쪽)
const HW = 15.2, HD = 9.4, CH = 3.4                    // 바닥 절반 너비·깊이·모서리 깎기
const RF = (x: number, z: number) => new THREE.Vector3().addScaledVector(RIGHT, x).addScaledVector(FRONT, z)
const CLUSTER_POS: Record<DeptKey, [number, number]> = { sales: [-10.6, -4.8], ceo: [0, -6.4], legal: [10.6, -5.2], dig: [-12.0, 2.4], revenue: [12.2, 2.4], tax: [-8.6, 6.6], qa: [0, 6.8], ops: [8.8, 6.2] }
const CAM_DIR = new THREE.Vector3(1, 1.05, 1).normalize()

const mat = (color: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...o })
const glossy = (color: string, o: Partial<THREE.MeshPhysicalMaterialParameters> = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.25, ...o })

function mesh(g: THREE.BufferGeometry, m: THREE.Material, p: [number, number, number] = [0, 0, 0], cast = true) {
  const o = new THREE.Mesh(g, m); o.position.set(...p); o.castShadow = cast; o.receiveShadow = true; return o
}

function screenTexture(accent: string, lines = true): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160
  const x = c.getContext('2d')!
  const g = x.createLinearGradient(0, 0, 256, 160); g.addColorStop(0, '#0e2a5a'); g.addColorStop(1, '#17407f'); x.fillStyle = g; x.fillRect(0, 0, 256, 160)
  if (lines) {
    x.fillStyle = 'rgba(255,255,255,.85)'; x.fillRect(18, 20, 120, 8)
    x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(18, 40, 190, 7); x.fillRect(18, 58, 150, 7)
    x.fillStyle = accent; x.fillRect(18, 78, 70, 9)
    x.fillStyle = 'rgba(120,200,255,.55)'; for (let i = 0; i < 5; i++) x.fillRect(18 + i * 38, 140 - (i % 3) * 16 - 14, 26, 14 + (i % 3) * 16)
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}

// ── 사람(귀여운 3등신) ──────────────────────────────────
type Rig = { group: THREE.Group; body: THREE.Group; head: THREE.Group; armL: THREE.Group; armR: THREE.Group; legL: THREE.Group; legR: THREE.Group; eyes: THREE.Mesh[]; ball?: THREE.Mesh }

function makeHuman(name: string, shirt: string): Rig {
  const h = hash(name)
  const hairC = HAIR[h % HAIR.length], skinC = SKIN[(h >> 3) % SKIN.length], style = (h >> 6) % 4
  const skin = glossy(skinC, { roughness: 0.6, clearcoat: 0.15 }), hair = glossy(hairC, { roughness: 0.4, clearcoat: 0.5 })
  const shirtM = glossy(shirt, { roughness: 0.5 }), pants = mat('#2b3552'), shoe = mat('#f4f6fb', { roughness: 0.5 })
  const group = new THREE.Group(), body = new THREE.Group(); group.add(body)
  // 다리·신발
  const mkLeg = (x: number) => { const g = new THREE.Group(); g.position.set(x, 0.46, 0); g.add(mesh(new THREE.CapsuleGeometry(0.11, 0.2, 6, 12), pants, [0, -0.2, 0])); g.add(mesh(new THREE.SphereGeometry(0.14, 14, 10), shoe, [0, -0.43, 0.05])); return g }
  const legL = mkLeg(-0.13), legR = mkLeg(0.13); body.add(legL, legR)
  // 몸통
  body.add(mesh(new THREE.CapsuleGeometry(0.26, 0.22, 8, 16), shirtM, [0, 0.72, 0]))
  body.add(mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), mat('#ffffff'), [0, 0.92, 0.22], false))
  // 팔
  const mkArm = (x: number) => { const g = new THREE.Group(); g.position.set(x, 0.86, 0); g.add(mesh(new THREE.CapsuleGeometry(0.08, 0.2, 6, 10), shirtM, [0, -0.17, 0])); g.add(mesh(new THREE.SphereGeometry(0.085, 12, 10), skin, [0, -0.36, 0])); return g }
  const armL = mkArm(-0.34), armR = mkArm(0.34); body.add(armL, armR)
  // 머리 (크게)
  const head = new THREE.Group(); head.position.set(0, 1.42, 0); body.add(head)
  head.add(mesh(new THREE.SphereGeometry(0.46, 40, 28), skin))
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.485, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.58), hair); cap.rotation.x = -0.42; cap.castShadow = true; head.add(cap)
  const bangs = mesh(new THREE.SphereGeometry(0.2, 18, 12), hair, [0.14, 0.34, 0.33]); bangs.scale.set(1.5, 0.8, 0.7); head.add(bangs)
  const bangs2 = mesh(new THREE.SphereGeometry(0.17, 18, 12), hair, [-0.17, 0.33, 0.34]); bangs2.scale.set(1.3, 0.8, 0.7); head.add(bangs2)
  if (style === 0) head.add(mesh(new THREE.SphereGeometry(0.2, 20, 14), hair, [0, 0.55, -0.12]))                         // 똥머리
  if (style === 1) { const t = mesh(new THREE.CapsuleGeometry(0.1, 0.34, 6, 12), hair, [0, 0.05, -0.5]); t.rotation.x = 0.35; head.add(t) } // 포니테일
  if (style === 2) { head.add(mesh(new THREE.SphereGeometry(0.2, 16, 12), hair, [-0.42, -0.02, 0])); head.add(mesh(new THREE.SphereGeometry(0.2, 16, 12), hair, [0.42, -0.02, 0])) } // 양옆
  // 얼굴
  const eyeM = mat('#17121f', { roughness: 0.2 }), eyes: THREE.Mesh[] = []
  for (const x of [-0.16, 0.16]) {
    const e = mesh(new THREE.SphereGeometry(0.075, 16, 12), eyeM, [x, -0.02, 0.41], false); e.scale.set(0.85, 1.15, 0.5); head.add(e); eyes.push(e)
    head.add(mesh(new THREE.SphereGeometry(0.022, 8, 6), mat('#fff', { emissive: '#ffffff', emissiveIntensity: 0.6 }), [x + 0.02, 0.02, 0.445], false))
    const b = mesh(new THREE.CircleGeometry(0.075, 20), new THREE.MeshBasicMaterial({ color: '#ff8fa0', transparent: true, opacity: 0.5 }), [x * 1.65, -0.14, 0.4], false); b.lookAt(new THREE.Vector3(x * 3, -0.1, 3)); head.add(b)
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 14, Math.PI), mat('#8a3f33')); mouth.position.set(0, -0.14, 0.44); mouth.rotation.z = Math.PI; head.add(mouth)
  return { group, body, head, armL, armR, legL, legR, eyes }
}

function makeBot(accent: string): Rig {
  const light = glossy('#eef1f8', { roughness: 0.3 }), acc = glossy(accent, { roughness: 0.35 }), gray = glossy('#a7b0c2', { roughness: 0.4 })
  const group = new THREE.Group(), body = new THREE.Group(); group.add(body)
  const mkLeg = (x: number) => { const g = new THREE.Group(); g.position.set(x, 0.46, 0); g.add(mesh(new THREE.CapsuleGeometry(0.1, 0.2, 6, 12), gray, [0, -0.2, 0])); g.add(mesh(new RoundedBoxGeometry(0.26, 0.12, 0.34, 3, 0.05), acc, [0, -0.43, 0.05])); return g }
  const legL = mkLeg(-0.13), legR = mkLeg(0.13); body.add(legL, legR)
  body.add(mesh(new RoundedBoxGeometry(0.62, 0.56, 0.46, 5, 0.16), acc, [0, 0.72, 0]))
  body.add(mesh(new THREE.CircleGeometry(0.1, 20), new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#ffffff', emissiveIntensity: 0.8 }), [0, 0.74, 0.235], false))
  const mkArm = (x: number) => { const g = new THREE.Group(); g.position.set(x, 0.86, 0); g.add(mesh(new THREE.CapsuleGeometry(0.075, 0.2, 6, 10), gray, [0, -0.17, 0])); g.add(mesh(new THREE.SphereGeometry(0.09, 12, 10), acc, [0, -0.36, 0])); return g }
  const armL = mkArm(-0.4), armR = mkArm(0.4); body.add(armL, armR)
  const head = new THREE.Group(); head.position.set(0, 1.4, 0); body.add(head)
  head.add(mesh(new RoundedBoxGeometry(0.98, 0.82, 0.8, 6, 0.3), light))
  head.add(mesh(new RoundedBoxGeometry(0.78, 0.44, 0.1, 4, 0.16), mat('#0a1230', { roughness: 0.15, metalness: 0.3 }), [0, 0.0, 0.4], false))
  const eyeM = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.6 }), eyes: THREE.Mesh[] = []
  for (const x of [-0.17, 0.17]) { const e = mesh(new THREE.CapsuleGeometry(0.06, 0.08, 4, 10), eyeM, [x, 0.0, 0.46], false); head.add(e); eyes.push(e) }
  head.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 14), acc, [-0.53, 0, 0]).rotateZ(Math.PI / 2))
  head.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 14), acc, [0.53, 0, 0]).rotateZ(Math.PI / 2))
  head.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 8), gray, [0, 0.52, 0]))
  const ball = mesh(new THREE.SphereGeometry(0.075, 14, 10), new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.4 }), [0, 0.66, 0], false); head.add(ball)
  return { group, body, head, armL, armR, legL, legR, eyes, ball }
}

// ── 책상 ──────────────────────────────────────────────
function makeDesk(accent: string, glow: boolean): THREE.Group {
  const g = new THREE.Group()
  const top = glossy('#f4f7fd', { roughness: 0.25 }), side = glossy('#cfd8ea', { roughness: 0.4 }), dark = mat('#1b2340')
  g.add(mesh(new RoundedBoxGeometry(1.9, 0.08, 1.0, 3, 0.03), top, [0, 0.76, 0]))
  g.add(mesh(new RoundedBoxGeometry(0.1, 0.72, 0.9, 2, 0.03), side, [-0.85, 0.37, 0]))
  g.add(mesh(new RoundedBoxGeometry(0.1, 0.72, 0.9, 2, 0.03), side, [0.85, 0.37, 0]))
  g.add(mesh(new RoundedBoxGeometry(1.7, 0.4, 0.06, 2, 0.02), side, [0, 0.52, 0.4]))
  const trim = mesh(new THREE.BoxGeometry(1.9, 0.025, 0.03), new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.9 }), [0, 0.795, -0.5], false); g.add(trim)
  // 모니터 (사람 쪽을 보고, 화면이 카메라에도 비스듬히 보이게 돌려 둔다)
  const mon = new THREE.Group(); mon.position.set(0.52, 0.8, 0.18); mon.rotation.y = 2.0; g.add(mon)
  mon.add(mesh(new RoundedBoxGeometry(0.78, 0.5, 0.05, 3, 0.02), dark, [0, 0.4, 0]))
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.43), new THREE.MeshBasicMaterial({ map: screenTexture(accent, glow), toneMapped: false })); scr.position.set(0, 0.4, 0.028); mon.add(scr)
  mon.add(mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.16, 10), dark, [0, 0.09, 0]))
  mon.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 20), dark, [0, 0.01, 0]))
  g.add(mesh(new RoundedBoxGeometry(0.5, 0.025, 0.18, 2, 0.01), mat('#c4cde0'), [-0.35, 0.82, -0.12]))
  // 의자 (사람 자리 뒤쪽)
  const ch = new THREE.Group(); ch.position.set(0, 0, -1.1); g.add(ch)
  ch.add(mesh(new RoundedBoxGeometry(0.7, 0.12, 0.7, 3, 0.05), glossy('#3a4a80'), [0, 0.5, 0]))
  ch.add(mesh(new RoundedBoxGeometry(0.66, 0.62, 0.1, 3, 0.05), glossy('#2f3b66'), [0, 0.9, -0.34]))
  ch.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 10), dark, [0, 0.28, 0]))
  ch.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 5), dark, [0, 0.04, 0]))
  return g
}

// ── 장면 ──────────────────────────────────────────────
type Actor = { id: string; item: SceneItem; rig: Rig; home: THREE.Vector3; pos: THREE.Vector3; yaw: number; homeYaw: number; deskGroup: THREE.Group | null; phase: number; mode: 'sit' | 'walk' | 'wave' }

export default function Office3D(props: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const overlay = useRef<HTMLDivElement>(null)
  const P = useRef(props); P.current = props
  const api = useRef<{ rebuild: () => void } | null>(null)
  const sigRef = useRef('')

  const sig = props.clusters.map(c => c.dept + ':' + c.items.map(i => i.id).join(',')).join('|')

  useEffect(() => {
    const el = wrap.current, ov = overlay.current; if (!el || !ov) return
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace
    el.appendChild(renderer.domElement); renderer.domElement.style.display = 'block'
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200)
    let zoom = 1, tx = 0, tz = 0, zoomT = 1, txT = 0, tzT = 0

    // 조명
    scene.add(new THREE.HemisphereLight('#cfdcff', '#4a5a8c', 1.5)); scene.add(new THREE.AmbientLight('#8fa6e0', 0.5))
    const sun = new THREE.DirectionalLight('#fff2dd', 1.5); sun.position.set(9, 16, 6); sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -24; sun.shadow.camera.right = 24; sun.shadow.camera.top = 24; sun.shadow.camera.bottom = -24; sun.shadow.camera.far = 80; sun.shadow.bias = -0.0004
    scene.add(sun)
    const holoLight = new THREE.PointLight('#4cc3ff', 14, 12, 1.6); holoLight.position.set(0, 2.2, 0); scene.add(holoLight)

    // 바닥(팔각 슬래브)
    const rfPts: [number, number][] = [[-HW + CH, -HD], [HW - CH, -HD], [HW, -HD + CH], [HW, HD - CH], [HW - CH, HD], [-HW + CH, HD], [-HW, HD - CH], [-HW, -HD + CH]]
    const octShape = new THREE.Shape(); rfPts.forEach(([x, z], k) => { const w = RF(x, z); k ? octShape.lineTo(w.x, -w.z) : octShape.moveTo(w.x, -w.z) })
    const slabGeo = new THREE.ExtrudeGeometry(octShape, { depth: 0.7, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.08, bevelSegments: 2 }); slabGeo.rotateX(-Math.PI / 2)
    const tile = document.createElement('canvas'); tile.width = tile.height = 256; { const x = tile.getContext('2d')!; x.fillStyle = '#3b4b6e'; x.fillRect(0, 0, 256, 256); x.strokeStyle = 'rgba(160,185,235,.28)'; x.lineWidth = 3; x.strokeRect(2, 2, 252, 252); x.fillStyle = 'rgba(255,255,255,.035)'; x.fillRect(0, 0, 128, 128); x.fillRect(128, 128, 128, 128) }
    const tileTex = new THREE.CanvasTexture(tile); tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping; tileTex.repeat.set(0.16, 0.16); tileTex.colorSpace = THREE.SRGBColorSpace; tileTex.anisotropy = 8
    const slab = new THREE.Mesh(slabGeo, [new THREE.MeshStandardMaterial({ color: '#ffffff', map: tileTex, roughness: 0.55, metalness: 0.05, emissive: '#22305a', emissiveIntensity: 0.55 }), mat('#101a36', { roughness: 0.6 })]); slab.position.y = -0.7; slab.receiveShadow = true; scene.add(slab)
    // 정면 가장자리 네온
    const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(rfPts.map(([x, z]) => { const w = RF(x * 1.005, z * 1.005); w.y = -0.62; return w })), new THREE.LineBasicMaterial({ color: '#4aa3ff', transparent: true, opacity: 0.6 })); scene.add(edge)
    // 뒤쪽 벽 + 유리
    for (let k = 0; k < 8; k++) {
      const q0 = rfPts[k], q1 = rfPts[(k + 1) % 8]
      const p0 = RF(q0[0], q0[1]), p1 = RF(q1[0], q1[1])
      const mid = p0.clone().add(p1).multiplyScalar(0.5), nrm = new THREE.Vector2(q1[1] - q0[1], -(q1[0] - q0[0])).normalize()   // 바깥쪽 법선(우·앞 좌표)
      if (nrm.y > -0.3) continue
      const len = p0.distanceTo(p1), wall = new THREE.Group(); wall.position.copy(mid); wall.rotation.y = Math.atan2(-(p1.z - p0.z), p1.x - p0.x) * 1
      wall.add(mesh(new THREE.BoxGeometry(len, 0.35, 0.3), mat('#16213f'), [0, 0.18, 0]))
      wall.add(mesh(new THREE.BoxGeometry(len, 0.18, 0.3), glossy('#5a7dc0', { roughness: 0.3 }), [0, 3.4, 0]))
      for (let s = 0; s < 3; s++) {
        const w = len / 3 - 0.12
        const glass = new THREE.Mesh(new THREE.BoxGeometry(w, 2.8, 0.06), new THREE.MeshPhysicalMaterial({ color: '#8fc0ff', transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, clearcoat: 1 })); glass.position.set((s - 1) * (len / 3), 1.85, 0); wall.add(glass)
        wall.add(mesh(new THREE.BoxGeometry(0.07, 2.9, 0.12), mat('#2a3c6c'), [(s - 1) * (len / 3) + w / 2 + 0.05, 1.85, 0]))
      }
      scene.add(wall)
    }
    // 가운데 홀로그램 테이블
    const holo = new THREE.Group(); scene.add(holo)
    const tableBase = mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.7, 8), glossy('#dfe6f3', { roughness: 0.3 }), [0, 0.35, 0]); tableBase.rotation.y = Math.PI / 8; holo.add(tableBase)
    const tableTop = mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.06, 8), new THREE.MeshStandardMaterial({ color: '#0f2c5e', emissive: '#1a4fa0', emissiveIntensity: 0.9, roughness: 0.3 }), [0, 0.72, 0], false); tableTop.rotation.y = Math.PI / 8; holo.add(tableTop)
    const ringM = new THREE.MeshStandardMaterial({ color: '#7fd8ff', emissive: '#4cc3ff', emissiveIntensity: 2 })
    for (const r of [1.9, 1.25]) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 8, 64), ringM); t.rotation.x = Math.PI / 2; t.position.y = 0.76; holo.add(t) }
    const sphere = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 2), new THREE.MeshBasicMaterial({ color: '#a6e3ff', wireframe: true, transparent: true, opacity: 0.75 })); sphere.position.y = 2.1; holo.add(sphere)
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.5, 1.6, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#5bc8ff', transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false })); beam.position.y = 1.55; holo.add(beam)
    // 화분·장식
    const plant = (x: number, z: number) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.add(mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.5, 14), glossy('#e9edf6'), [0, 0.25, 0])); for (let i = 0; i < 7; i++) { const l = mesh(new THREE.SphereGeometry(0.22, 10, 8), mat('#2fa76a', { roughness: 0.7 }), [Math.cos(i) * 0.2, 0.75 + (i % 3) * 0.14, Math.sin(i) * 0.2]); l.scale.set(0.7, 1.4, 0.7); g.add(l) } scene.add(g) }
    for (const [x, z] of [[-14, -7.6], [14, -7.6], [-14.2, 8], [14.2, 8], [-4.8, -8.2], [4.8, -8.2], [-4.6, 8.2], [4.6, 8.2]]) { const w = RF(x, z); plant(w.x, w.z) }

    // 배우(사람·AI) 만들기
    const actors = new Map<string, Actor>(), clusterGroups = new Map<DeptKey, THREE.Group>(), clusterCenters = new Map<DeptKey, THREE.Vector3>()
    const pickables: THREE.Object3D[] = []
    const actorsRoot = new THREE.Group(); scene.add(actorsRoot)
    let ceoDesk = RF(...CLUSTER_POS.ceo)
    const slotPoint = (i: number) => { const off = [0, -2.6, 2.6, -5.2, 5.2, -7.8, 7.8][i % 7], row = Math.floor(i / 7); return ceoDesk.clone().addScaledVector(FRONT, 3.3 + row * 1.7).addScaledVector(RIGHT, off) }
    const faceYaw = (from: THREE.Vector3, to: THREE.Vector3) => Math.atan2(to.x - from.x, to.z - from.z)

    const rebuild = () => {
      for (const a of actors.values()) { actorsRoot.remove(a.rig.group); if (a.deskGroup) actorsRoot.remove(a.deskGroup) }
      actors.clear(); clusterGroups.clear(); clusterCenters.clear(); pickables.length = 0
      const d = new THREE.Vector3(0, 0, 1)        // 사람이 보는 방향(= 화면 아래쪽·약간 왼쪽으로 3/4 얼굴이 보인다)
      for (const c of P.current.clusters) {
        const center = RF(...CLUSTER_POS[c.dept])
        clusterCenters.set(c.dept, center); if (c.dept === 'ceo') ceoDesk = center.clone()
        const n = c.items.length, cols = n <= 2 ? n : n <= 6 ? 2 : 3, rows = Math.ceil(n / cols)
        c.items.forEach((it, i) => {
          const col = i % cols, row = Math.floor(i / cols)
          const seat = center.clone().addScaledVector(RIGHT, (col - (cols - 1) / 2) * 3.4).addScaledVector(FRONT, (row - (rows - 1) / 2) * 3.2)
          const desk = makeDesk(c.accent, !it.roam); desk.position.copy(seat).addScaledVector(d, 1.1 * 1.15); desk.rotation.y = 0; desk.scale.setScalar(1.15)
          actorsRoot.add(desk); desk.traverse(o => { (o as any).userData.dept = c.dept; if ((o as THREE.Mesh).isMesh) pickables.push(o) })
          const rig = it.kind === 'bot' ? makeBot(it.accent) : makeHuman(it.name, it.shirt)
          rig.group.traverse(o => { (o as any).userData.dept = c.dept; (o as any).userData.itemId = it.id })
          if (!it.roam || true) rig.group.position.copy(seat)
          actorsRoot.add(rig.group)
          rig.group.traverse(o => { if ((o as THREE.Mesh).isMesh) pickables.push(o) })
          actors.set(it.id, { id: it.id, item: it, rig, home: seat.clone(), pos: seat.clone(), yaw: 0, homeYaw: 0, deskGroup: desk, phase: Math.random() * 6, mode: 'sit' })
          if (it.roam) { desk.visible = true }
        })
      }
    }
    api.current = { rebuild }
    rebuild(); sigRef.current = sig

    // 크기
    const updateCam = () => {
      const w = el.clientWidth || 800, h = el.clientHeight || 500
      const asp = w / h, halfH = Math.max(9.2, 17.6 / asp) / zoom, halfW = halfH * asp
      camera.left = -halfW; camera.right = halfW; camera.top = halfH; camera.bottom = -halfH; camera.updateProjectionMatrix()
    }
    const resize = () => {
      const w = el.clientWidth || 800, h = el.clientHeight || 500
      renderer.setSize(w, h, false); renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px'; updateCam()
    }
    resize(); const ro = new ResizeObserver(resize); ro.observe(el)

    // 마우스
    const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(); let hovD: DeptKey | null = null, hovI: string | null = null
    const hit = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect(); mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(mouse, camera); const h = ray.intersectObjects(pickables, false)[0]
      return h ? { dept: ((h.object as any).userData.dept || null) as DeptKey | null, id: ((h.object as any).userData.itemId || null) as string | null } : { dept: null, id: null }
    }
    const onMove = (e: PointerEvent) => { const h = hit(e); if (h.dept !== hovD || h.id !== hovI) { hovD = h.dept; hovI = h.id; P.current.onHover(h.dept, h.id); renderer.domElement.style.cursor = h.dept ? 'pointer' : 'default' } }
    const onClick = (e: PointerEvent) => { const h = hit(e); P.current.onPick(h.dept, h.id) }
    const onLeave = () => { hovD = null; hovI = null; P.current.onHover(null, null) }
    renderer.domElement.addEventListener('pointermove', onMove); renderer.domElement.addEventListener('click', onClick as any); renderer.domElement.addEventListener('pointerleave', onLeave)

    // 오버레이 위치 갱신
    const v = new THREE.Vector3()
    const place = (node: HTMLElement | null, wp: THREE.Vector3, dy: number, w: number, h: number, below = false) => {
      if (!node) return; v.copy(wp); v.y += dy; v.project(camera)
      const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h
      node.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,${below ? '0%' : '-100%'})`; node.style.zIndex = String(Math.round(1000 - v.y * 400))
    }

    // 루프
    const clock = new THREE.Clock(); let raf = 0, pinkT = 0, pinkIdx = 0
    const patrol = Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * Math.PI * 2 + 0.4; return RF(Math.cos(a) * 5.4, Math.sin(a) * 3.6) })
    const tick = () => {
      raf = requestAnimationFrame(tick); const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime
      const pr = P.current
      // 카메라 줌·이동
      const fd = pr.focusDept ? clusterCenters.get(pr.focusDept) : null
      zoomT = fd ? 2.1 : 1; txT = fd ? fd.x + RIGHT.x * 3.2 : 0; tzT = fd ? fd.z + RIGHT.z * 3.2 : 0
      zoom += (zoomT - zoom) * Math.min(1, dt * 5); tx += (txT - tx) * Math.min(1, dt * 5); tz += (tzT - tz) * Math.min(1, dt * 5)
      camera.position.set(tx + CAM_DIR.x * 40, CAM_DIR.y * 40, tz + CAM_DIR.z * 40); camera.lookAt(tx, 0, tz); updateCam()
      sphere.rotation.y = t * 0.4; sphere.rotation.x = Math.sin(t * 0.3) * 0.2; holoLight.intensity = 12 + Math.sin(t * 2) * 2
      // 배우
      for (const a of actors.values()) {
        const it = a.item, slot = pr.slots[a.id]; let target = a.home
        if (it.roam) {
          // 핑크: 보고가 있으면 그쪽, 없으면 순찰
          pinkT += dt
          if (pr.pinkSlot != null) target = slotPoint(pr.pinkSlot).addScaledVector(RIGHT, 1.4).addScaledVector(FRONT, 0.4)
          else { if (pinkT > 5) { pinkT = 0; pinkIdx = (pinkIdx + 1) % patrol.length } target = patrol[pinkIdx] }
        } else if (slot != null) target = slotPoint(slot)
        const to = target.clone().sub(a.pos); to.y = 0; const dist = to.length()
        if (dist > 0.06) { const step = Math.min(dist, 3.0 * dt); a.pos.addScaledVector(to.normalize(), step); a.mode = 'walk'; const ty = Math.atan2(to.x, to.z); let dy = ty - a.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; a.yaw += dy * Math.min(1, dt * 10) }
        else if (!it.roam && slot != null) { a.mode = 'wave'; const ty = faceYaw(a.pos, ceoDesk); let dy = ty - a.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; a.yaw += dy * Math.min(1, dt * 8) }
        else if (it.roam) { a.mode = 'walk'; a.yaw += (0.0) }
        else { a.mode = 'sit'; let dy = a.homeYaw - a.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; a.yaw += dy * Math.min(1, dt * 8) }
        const { rig } = a, seated = a.mode === 'sit'
        rig.group.position.copy(a.pos); rig.group.rotation.y = seated ? 0.0 : a.yaw
        // 자세
        const bob = Math.sin(t * 2 + a.phase) * 0.012
        if (seated) {
          rig.body.position.y = 0.12 + bob; rig.legL.rotation.x = rig.legR.rotation.x = -1.35
          rig.armL.rotation.x = -1.0 + Math.sin(t * 9 + a.phase) * 0.12; rig.armR.rotation.x = -1.0 + Math.cos(t * 9 + a.phase) * 0.12
          rig.head.rotation.y = 0.18 + Math.sin(t * 0.7 + a.phase) * 0.1; rig.head.rotation.x = 0.06
        } else if (a.mode === 'walk') {
          const s = Math.sin(t * 9 + a.phase); rig.body.position.y = Math.abs(s) * 0.06
          rig.legL.rotation.x = s * 0.7; rig.legR.rotation.x = -s * 0.7; rig.armL.rotation.x = -s * 0.6; rig.armR.rotation.x = s * 0.6; rig.head.rotation.y = 0; rig.head.rotation.x = 0
        } else {
          rig.body.position.y = Math.abs(Math.sin(t * 5 + a.phase)) * 0.05; rig.legL.rotation.x = rig.legR.rotation.x = 0
          rig.armL.rotation.x = 0; rig.armR.rotation.z = Math.PI - 0.35 + Math.sin(t * 8) * 0.25; rig.armR.rotation.x = 0; rig.head.rotation.y = 0
        }
        if (a.mode !== 'wave') rig.armR.rotation.z = 0
        // 앉을 때 몸 방향: 3/4 얼굴이 보이게 살짝 틀어 둔다
        if (seated) rig.group.rotation.y = 0.35
        if (rig.ball) (rig.ball.material as THREE.MeshStandardMaterial).emissiveIntensity = 1 + Math.sin(t * 3 + a.phase) * 0.5
        // 눈 깜빡임
        const blink = (Math.sin(t * 0.9 + a.phase * 3) > 0.985) ? 0.1 : 1; rig.eyes.forEach(e => (e.scale.y = (e.userData.base ??= e.scale.y) * blink))
        // 선택 강조
        rig.group.scale.setScalar(1.3 * (pr.selectedId === a.id ? 1.1 : 1))
      }
      renderer.render(scene, camera)
      // 오버레이
      const w = el.clientWidth, h = el.clientHeight
      ov.querySelectorAll<HTMLElement>('[data-anchor]').forEach(n => {
        const key = n.dataset.anchor!, [kind, id] = key.split('|')
        if (kind === 'sign') { const c = clusterCenters.get(id as DeptKey); if (c) place(n, c, 4.2, w, h) }
        else if (kind === 'pill' || kind === 'bubble' || kind === 'say') { const a = actors.get(id); if (a) { const below = kind === 'bubble' && (P.current.slots[id] ?? 0) % 2 === 1; place(n, a.pos, kind === 'pill' ? 3.0 : below ? 0.2 : 3.6, w, h, below) } }
      })
    }
    tick()
    return () => { cancelAnimationFrame(raf); ro.disconnect(); renderer.domElement.removeEventListener('pointermove', onMove); renderer.domElement.removeEventListener('click', onClick as any); renderer.domElement.removeEventListener('pointerleave', onLeave); renderer.dispose(); scene.traverse(o => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose() }); el.removeChild(renderer.domElement); api.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 구성원이 바뀌면 장면을 다시 만든다
  useEffect(() => { if (api.current && sigRef.current !== sig) { api.current.rebuild(); sigRef.current = sig } }, [sig])

  const items = props.clusters.flatMap(c => c.items)
  return (
    <div ref={wrap} className="absolute inset-0">
      <div ref={overlay} className="absolute inset-0 overflow-hidden pointer-events-none">
        {props.clusters.map(c => (
          <div key={'sign' + c.dept} data-anchor={`sign|${c.dept}`} className="absolute left-0 top-0 pointer-events-auto will-change-transform">{props.renderSign(c.dept)}</div>
        ))}
        {items.map(it => (
          <div key={'pill' + it.id} data-anchor={`pill|${it.id}`} className="absolute left-0 top-0 pointer-events-none will-change-transform">
            <span className="of3-pill" style={it.kind === 'bot' ? { background: it.accent, color: '#101521', borderColor: 'transparent' } : it.dept === 'ceo' ? { background: '#fde047', color: '#111', borderColor: 'transparent' } : undefined}>{it.label}</span>
          </div>
        ))}
        {props.bubbleIds.map(id => (
          <div key={'bub' + id} data-anchor={`bubble|${id}`} className="absolute left-0 top-0 pointer-events-auto will-change-transform">{props.renderBubble(id, (props.slots[id] ?? 0) % 2 === 1)}</div>
        ))}
        {props.pinkSay && (
          <div key="pinksay" data-anchor="say|bot:qa" className="absolute left-0 top-0 pointer-events-none will-change-transform"><div className="of3-say">{props.pinkSay}</div></div>
        )}
      </div>
    </div>
  )
}
