"use client";

import { useRef, useState, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html, Edges, ContactShadows, Instances, Instance } from "@react-three/drei";
import * as THREE from "three";
import { STATUS_COLORS, HIGHLIGHT_COLOR, type BuildingFloor, type BuildingRoom } from "./types";

// ---------------------------------------------------------------------------
// Lightweight furniture: every chair/table on a floor is drawn with just a
// few instanced meshes (3 draw calls total), regardless of room count.
// Geometry is low-poly boxes and there are no per-object shadow maps.
// ---------------------------------------------------------------------------

type Vec3 = [number, number, number];
interface TableInst {
  pos: Vec3;
  scale: Vec3;
}

function computeFurniture(rooms: BuildingRoom[]) {
  const seats: Vec3[] = [];
  const backs: Vec3[] = [];
  const tables: TableInst[] = [];

  for (const r of rooms) {
    const x = r.coordinates_3d.x;
    const z = r.coordinates_3d.z;
    const w = Math.max(1, r.dimensions.width_m);
    const l = Math.max(1, r.dimensions.length_m);

    const tableW = Math.min(w * 0.4, 3);
    const tableL = Math.min(l * 0.55, 4.4);
    tables.push({ pos: [x, 0.37, z], scale: [tableW, 0.72, tableL] });

    // Cap visible chairs so big rooms stay cheap and uncluttered.
    const n = Math.min(r.capacity, 10);
    const perRow = Math.ceil(n / 2);
    const rowXOff = tableW / 2 + 0.42;
    let placed = 0;

    for (let row = 0; row < 2 && placed < n; row++) {
      const sideX = row === 0 ? -rowXOff : rowXOff;
      const cnt = Math.min(perRow, n - placed);
      for (let i = 0; i < cnt; i++) {
        const t = cnt === 1 ? 0.5 : i / (cnt - 1);
        const cz = z + (t - 0.5) * tableL * 0.82;
        const cx = x + sideX;
        seats.push([cx, 0.24, cz]);
        backs.push([cx + (row === 0 ? -0.2 : 0.2), 0.52, cz]);
        placed++;
      }
    }
  }

  return { seats, backs, tables };
}

function Furniture({ rooms }: { rooms: BuildingRoom[] }) {
  const { seats, backs, tables } = useMemo(() => computeFurniture(rooms), [rooms]);

  return (
    <group>
      {tables.length > 0 && (
        <Instances limit={tables.length} range={tables.length}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#b0896b" roughness={0.75} />
          {tables.map((tbl, i) => (
            <Instance key={i} position={tbl.pos} scale={tbl.scale} />
          ))}
        </Instances>
      )}
      {seats.length > 0 && (
        <Instances limit={seats.length} range={seats.length}>
          <boxGeometry args={[0.42, 0.46, 0.42]} />
          <meshStandardMaterial color="#475569" roughness={0.6} />
          {seats.map((p, i) => (
            <Instance key={i} position={p} />
          ))}
        </Instances>
      )}
      {backs.length > 0 && (
        <Instances limit={backs.length} range={backs.length}>
          <boxGeometry args={[0.08, 0.5, 0.42]} />
          <meshStandardMaterial color="#334155" roughness={0.6} />
          {backs.map((p, i) => (
            <Instance key={i} position={p} />
          ))}
        </Instances>
      )}
    </group>
  );
}

interface RoomMeshProps {
  room: BuildingRoom;
  highlighted: boolean;
  inCart: boolean;
  active: boolean;
  onSelect: (room: BuildingRoom) => void;
  onHover: (room: BuildingRoom | null) => void;
}

function RoomMesh({ room, highlighted, inCart, active, onSelect, onHover }: RoomMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const w = Math.max(1, room.dimensions.width_m);
  const l = Math.max(1, room.dimensions.length_m);
  const h = Math.max(1, room.dimensions.height_m);
  const x = room.coordinates_3d.x;
  const z = room.coordinates_3d.z;

  const baseColor = inCart
    ? STATUS_COLORS.selected
    : highlighted
    ? HIGHLIGHT_COLOR
    : STATUS_COLORS[room.availability_status];
  const emphasized = active || hovered || highlighted || inCart;

  return (
    <group position={[x, 0, z]}>
      {/* Colored floor tile — keeps room status readable from any angle */}
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w - 0.15, l - 0.15]} />
        <meshStandardMaterial
          color={baseColor}
          transparent
          opacity={emphasized ? 0.95 : 0.82}
          roughness={0.65}
        />
      </mesh>

      {/* Glass volume — the interactive target; furniture shows through it */}
      <mesh
        ref={meshRef}
        position={[0, h / 2, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(room);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          onHover(room);
        }}
        onPointerOut={() => {
          setHovered(false);
          onHover(null);
        }}
        scale={hovered ? 1.02 : 1}
      >
        <boxGeometry args={[w, h, l]} />
        <meshStandardMaterial
          color={baseColor}
          transparent
          opacity={emphasized ? 0.26 : 0.12}
          emissive={baseColor}
          emissiveIntensity={emphasized ? 0.35 : 0.04}
          roughness={0.2}
          depthWrite={false}
        />
        <Edges threshold={15} color={emphasized ? "#ffffff" : "#334155"} />
      </mesh>

      {(hovered || active) && (
        <Html center distanceFactor={40} position={[0, h + 1.2, 0]} zIndexRange={[20, 0]}>
          <div className="pointer-events-none whitespace-nowrap rounded-lg bg-slate-900/95 px-2.5 py-1.5 text-xs text-white shadow-lg">
            <div className="font-semibold">{room.name}</div>
            <div className="text-slate-300">
              {room.capacity} seats · {room.availability_status}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

interface SceneProps {
  rooms: BuildingRoom[];
  highlightRoomIds: string[];
  cartRoomIds: string[];
  activeRoomId: string | null;
  onSelectRoom: (room: BuildingRoom | null) => void;
}

function FloorScene({ rooms, highlightRoomIds, cartRoomIds, activeRoomId, onSelectRoom }: SceneProps) {
  const [, setHovered] = useState<BuildingRoom | null>(null);
  const highlightSet = useMemo(() => new Set(highlightRoomIds), [highlightRoomIds]);
  const cartSet = useMemo(() => new Set(cartRoomIds), [cartRoomIds]);

  return (
    <>
      {/* Lightweight lighting — no HDRI environment map */}
      <ambientLight intensity={0.75} />
      <hemisphereLight args={["#ffffff", "#cbd5e1", 0.65]} />
      <directionalLight position={[18, 28, 16]} intensity={0.7} />

      {/* Floor + grid */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[48, 40]} />
        <meshStandardMaterial color="#eef2f6" roughness={0.95} />
      </mesh>
      <gridHelper args={[48, 24, "#cbd5e1", "#e2e8f0"]} position={[0, 0.01, 0]} />

      {rooms.map((room) => (
        <RoomMesh
          key={room.id}
          room={room}
          highlighted={highlightSet.has(room.id) && !cartSet.has(room.id)}
          inCart={cartSet.has(room.id)}
          active={activeRoomId === room.id}
          onSelect={onSelectRoom}
          onHover={setHovered}
        />
      ))}

      <Furniture rooms={rooms} />

      {/* Static (single-frame) contact shadow — grounds the scene cheaply */}
      <ContactShadows
        frames={1}
        position={[0, 0.02, 0]}
        opacity={0.3}
        scale={50}
        blur={2.5}
        far={9}
        resolution={256}
      />
    </>
  );
}

interface Building3DSceneProps {
  floor: BuildingFloor;
  highlightRoomIds?: string[];
  cartRoomIds?: string[];
  activeRoomId?: string | null;
  onSelectRoom?: (room: BuildingRoom | null) => void;
}

export default function Building3DScene({
  floor,
  highlightRoomIds = [],
  cartRoomIds = [],
  activeRoomId = null,
  onSelectRoom = () => {},
}: Building3DSceneProps) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [22, 20, 24], fov: 42 }}
      performance={{ min: 0.5 }}
      onPointerMissed={() => onSelectRoom(null)}
    >
      <color attach="background" args={["#f8fafc"]} />
      <FloorScene
        rooms={floor.rooms}
        highlightRoomIds={highlightRoomIds}
        cartRoomIds={cartRoomIds}
        activeRoomId={activeRoomId}
        onSelectRoom={onSelectRoom}
      />
      <OrbitControls
        enablePan={false}
        minDistance={14}
        maxDistance={60}
        maxPolarAngle={Math.PI / 2.15}
        makeDefault
      />
    </Canvas>
  );
}
