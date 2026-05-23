"use client";

import { useRef, useState, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html, Edges, ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";
import { STATUS_COLORS, HIGHLIGHT_COLOR, type BuildingFloor, type BuildingRoom } from "./types";

interface RoomMeshProps {
  room: BuildingRoom;
  highlighted: boolean;
  active: boolean;
  onSelect: (room: BuildingRoom) => void;
  onHover: (room: BuildingRoom | null) => void;
}

function RoomMesh({ room, highlighted, active, onSelect, onHover }: RoomMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const w = Math.max(1, room.dimensions.width_m);
  const l = Math.max(1, room.dimensions.length_m);
  const h = Math.max(1, room.dimensions.height_m);
  const x = room.coordinates_3d.x;
  const z = room.coordinates_3d.z;

  const baseColor = highlighted ? HIGHLIGHT_COLOR : STATUS_COLORS[room.availability_status];
  const emissive = active || hovered || highlighted;

  return (
    <group position={[x, h / 2, z]}>
      <mesh
        ref={meshRef}
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
        scale={hovered ? 1.04 : 1}
        castShadow
      >
        <boxGeometry args={[w, h, l]} />
        <meshStandardMaterial
          color={baseColor}
          transparent
          opacity={emissive ? 0.92 : 0.72}
          emissive={baseColor}
          emissiveIntensity={emissive ? 0.4 : 0.08}
          roughness={0.35}
          metalness={0.1}
        />
        <Edges threshold={15} color={active || highlighted ? "#ffffff" : "#1e293b"} />
      </mesh>

      {(hovered || active) && (
        <Html center distanceFactor={40} position={[0, h / 2 + 1.5, 0]} zIndexRange={[20, 0]}>
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
  activeRoomId: string | null;
  onSelectRoom: (room: BuildingRoom | null) => void;
}

function FloorScene({ rooms, highlightRoomIds, activeRoomId, onSelectRoom }: SceneProps) {
  const [, setHovered] = useState<BuildingRoom | null>(null);
  const highlightSet = useMemo(() => new Set(highlightRoomIds), [highlightRoomIds]);

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[20, 30, 20]} intensity={1.1} castShadow />
      <directionalLight position={[-20, 20, -10]} intensity={0.3} />

      {/* Floor slab */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[48, 40]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.9} />
      </mesh>
      <gridHelper args={[48, 24, "#cbd5e1", "#e2e8f0"]} position={[0, 0, 0]} />

      {rooms.map((room) => (
        <RoomMesh
          key={room.id}
          room={room}
          highlighted={highlightSet.has(room.id)}
          active={activeRoomId === room.id}
          onSelect={onSelectRoom}
          onHover={setHovered}
        />
      ))}

      <ContactShadows position={[0, 0.01, 0]} opacity={0.35} scale={50} blur={2} far={10} />
      <Environment preset="city" />
    </>
  );
}

interface Building3DSceneProps {
  floor: BuildingFloor;
  highlightRoomIds?: string[];
  activeRoomId?: string | null;
  onSelectRoom?: (room: BuildingRoom | null) => void;
}

export default function Building3DScene({
  floor,
  highlightRoomIds = [],
  activeRoomId = null,
  onSelectRoom = () => {},
}: Building3DSceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [22, 20, 24], fov: 42 }}
      performance={{ min: 0.5 }}
      onPointerMissed={() => onSelectRoom(null)}
    >
      <color attach="background" args={["#f8fafc"]} />
      <FloorScene
        rooms={floor.rooms}
        highlightRoomIds={highlightRoomIds}
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
