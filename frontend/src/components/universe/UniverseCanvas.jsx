import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Line, OrbitControls, Stars } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";

import CameraPilot from "./CameraPilot";
import {
  AsteroidNode,
  CommandMeteors,
  ConstellationHalo,
  LinkChannel,
  MouseGuideOverlay,
  SourceCoreStar,
  TableNode,
  buildConstellationClusters,
  curvePoints,
  setBodyCursor,
} from "./UniverseSceneObjects";

export default function UniverseCanvas({
  level,
  tableNodes,
  asteroidNodes,
  tableLinks,
  asteroidLinks,
  cameraState,
  starCore,
  starFocused = false,
  starControlOpen = false,
  starDiveActive = false,
  selectedTableId,
  selectedAsteroidId,
  cameraFocusOffset = [0, 0, 0],
  cameraMicroNudgeKey = "",
  linkDraft,
  builderDropActive = false,
  builderDropHover = false,
  hideMouseGuide = false,
  onSelectStar,
  onOpenStarControlCenter,
  onClearStarFocus,
  onSelectTable,
  onSelectAsteroid,
  onOpenContext,
  onLinkStart,
  onLinkMove,
  onLinkComplete,
  onLinkCancel,
  onHoverLink,
  onLeaveLink,
  onSelectLink,
}) {
  const controlsRef = useRef(null);
  const dragRef = useRef(null);
  const suppressContextMenuUntilRef = useRef(0);
  const [hoveredNode, setHoveredNode] = useState(null);
  const interactionPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);

  const tableById = useMemo(() => new Map(tableNodes.map((node) => [node.id, node])), [tableNodes]);
  const asteroidById = useMemo(() => new Map(asteroidNodes.map((node) => [node.id, node])), [asteroidNodes]);
  const constellationClusters = useMemo(() => buildConstellationClusters(tableNodes), [tableNodes]);

  const selectedTableNode = selectedTableId ? tableById.get(selectedTableId) || null : null;
  const selectedAsteroidNode = selectedAsteroidId ? asteroidById.get(selectedAsteroidId) || null : null;

  useEffect(() => () => setBodyCursor("auto"), []);
  useEffect(() => {
    setHoveredNode(null);
  }, [level]);

  const isDragLinkGesture = (event, node) => {
    if (level < 3) return false;
    if (!node || node.kind !== "asteroid") return false;
    if (event.button === 2) return true;
    if (event.button === 0 && event.shiftKey) return true;
    return false;
  };

  const releaseDragState = ({ suppressContextMenu = false } = {}) => {
    dragRef.current = null;
    if (controlsRef.current) {
      controlsRef.current.enabled = true;
    }
    if (suppressContextMenu) {
      suppressContextMenuUntilRef.current = Date.now() + 320;
    }
    onLinkCancel();
  };

  const resolveLinePoint = (event) => {
    const out = new THREE.Vector3();
    const hit = event.ray?.intersectPlane?.(interactionPlane, out);
    if (!hit) return [0, 0, 0];
    return [hit.x, hit.y, hit.z];
  };

  const beginNodeDrag = (event, node) => {
    if (!isDragLinkGesture(event, node)) return;
    event.stopPropagation();
    event.preventDefault();
    if (controlsRef.current) {
      controlsRef.current.enabled = false;
    }
    dragRef.current = {
      sourceId: node.id,
      sourceKind: node.kind,
      sourceButton: event.button,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
    };
    const from = [node.position[0], node.position[1], node.position[2]];
    onLinkStart({ sourceId: node.id, sourceKind: node.kind, from, to: from });
  };

  const endNodeDrag = (event, node) => {
    const draft = dragRef.current;
    if (!draft || draft.sourceId !== linkDraft?.sourceId) return;
    if (event.button !== draft.sourceButton) return;
    event.stopPropagation();
    event.preventDefault();
    if (draft.moved && draft.sourceId !== node.id && draft.sourceKind === "asteroid" && node.kind === "asteroid") {
      onLinkComplete({
        sourceId: draft.sourceId,
        sourceKind: draft.sourceKind,
        targetId: node.id,
        targetKind: node.kind,
      });
    }
    releaseDragState({ suppressContextMenu: draft.sourceButton === 2 && draft.moved });
  };

  const onBackgroundMove = (event) => {
    const draft = dragRef.current;
    if (!draft) return;
    const dx = event.clientX - draft.startX;
    const dy = event.clientY - draft.startY;
    if (!draft.moved && Math.sqrt(dx * dx + dy * dy) > 6) {
      draft.moved = true;
    }
    onLinkMove(resolveLinePoint(event));
  };

  const onBackgroundUp = (event) => {
    const draft = dragRef.current;
    if (!draft) return;
    if (event.button !== draft.sourceButton) return;
    event.stopPropagation();
    event.preventDefault();
    releaseDragState({ suppressContextMenu: draft.sourceButton === 2 && draft.moved });
  };

  const resolveLinkEndpoint = (value) => {
    if (!value) return "";
    if (typeof value === "object") return String(value.id || "");
    return String(value);
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        camera={{
          position: cameraState.position,
          fov: 54,
          near: 0.1,
          far: 8000,
        }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.18 }}
        style={{ width: "100%", height: "100%", background: "#020205" }}
        onPointerMove={onBackgroundMove}
        onPointerUp={onBackgroundUp}
        onContextMenu={(event) => {
          event.preventDefault();
        }}
        onPointerMissed={() => {
          releaseDragState();
          if (typeof onClearStarFocus === "function") {
            onClearStarFocus();
          }
          setBodyCursor("auto");
        }}
      >
        <color attach="background" args={["#020205"]} />
        <fog attach="fog" args={["#020205", 260, 1600]} />

        <ambientLight intensity={0.46} />
        <directionalLight position={[240, 220, 200]} intensity={1.1} color="#b5e8ff" />
        <directionalLight position={[-220, -120, -180]} intensity={0.38} color="#6fa5ff" />

        <Stars radius={2200} depth={900} count={8200} factor={8} saturation={0} fade speed={0.1} />
        <SourceCoreStar
          starCore={starCore}
          isFocused={starFocused}
          isControlCenterOpen={starControlOpen}
          onSelectStar={onSelectStar}
          onOpenControlCenter={onOpenStarControlCenter}
        />
        <CommandMeteors enabled />
        {level < 3
          ? constellationClusters.map((cluster) => <ConstellationHalo key={cluster.id} cluster={cluster} />)
          : null}

        {level < 3
          ? tableLinks.map((link) => {
              const sourceId = resolveLinkEndpoint(link.source);
              const targetId = resolveLinkEndpoint(link.target);
              const sourceNode = tableById.get(sourceId);
              const targetNode = tableById.get(targetId);
              if (!sourceNode || !targetNode) return null;
              const isRelated = selectedTableId
                ? sourceId === String(selectedTableId) || targetId === String(selectedTableId)
                : true;
              return (
                <LinkChannel
                  key={String(link.id)}
                  link={link}
                  sourceNode={sourceNode}
                  targetNode={targetNode}
                  dimmed={!isRelated}
                  emphasized={isRelated}
                  onHoverLink={onHoverLink}
                  onLeaveLink={onLeaveLink}
                  onSelectLink={onSelectLink}
                />
              );
            })
          : null}
        {level >= 3
          ? asteroidLinks.map((link) => {
              const sourceId = resolveLinkEndpoint(link.source);
              const targetId = resolveLinkEndpoint(link.target);
              const sourceNode = asteroidById.get(sourceId);
              const targetNode = asteroidById.get(targetId);
              if (!sourceNode || !targetNode) return null;
              const isRelated = selectedAsteroidId
                ? sourceId === String(selectedAsteroidId) || targetId === String(selectedAsteroidId)
                : true;
              return (
                <LinkChannel
                  key={String(link.id)}
                  link={link}
                  sourceNode={sourceNode}
                  targetNode={targetNode}
                  dimmed={!isRelated}
                  emphasized={isRelated}
                  onHoverLink={onHoverLink}
                  onLeaveLink={onLeaveLink}
                  onSelectLink={onSelectLink}
                />
              );
            })
          : null}

        {tableNodes.map((node) => (
          <TableNode
            key={node.id}
            node={node}
            selected={node.id === selectedTableId}
            onPointerDownNode={beginNodeDrag}
            onPointerUpNode={endNodeDrag}
            onSelectNode={(current) => onSelectTable(current.id)}
            onHoverNode={(current) => setHoveredNode({ kind: "table", id: current.id, label: current.label })}
            onLeaveNode={(current) =>
              setHoveredNode((prev) => (prev && prev.kind === "table" && prev.id === current.id ? null : prev))
            }
            onContextNode={(event, current) => {
              event.stopPropagation();
              event.preventDefault();
              if (Date.now() < suppressContextMenuUntilRef.current) return;
              onOpenContext({
                kind: "table",
                id: current.id,
                label: current.label,
                x: event.nativeEvent.clientX,
                y: event.nativeEvent.clientY,
              });
            }}
          />
        ))}

        {level >= 3
          ? asteroidNodes.map((node) => (
              <AsteroidNode
                key={node.id}
                node={node}
                selected={node.id === selectedAsteroidId}
                onPointerDownNode={beginNodeDrag}
                onPointerUpNode={endNodeDrag}
                onSelectNode={(current) => onSelectAsteroid(current.id)}
                onHoverNode={(current) => setHoveredNode({ kind: "asteroid", id: current.id, label: current.label })}
                onLeaveNode={(current) =>
                  setHoveredNode((prev) => (prev && prev.kind === "asteroid" && prev.id === current.id ? null : prev))
                }
                onContextNode={(event, current) => {
                  event.stopPropagation();
                  event.preventDefault();
                  if (Date.now() < suppressContextMenuUntilRef.current) return;
                  onOpenContext({
                    kind: "asteroid",
                    id: current.id,
                    label: current.label,
                    x: event.nativeEvent.clientX,
                    y: event.nativeEvent.clientY,
                  });
                }}
              />
            ))
          : null}

        {linkDraft?.from && linkDraft?.to ? (
          <Line
            points={curvePoints(linkDraft.from, linkDraft.to, 0.03, 20)}
            color="#9de8ff"
            lineWidth={2}
            transparent
            opacity={0.88}
          />
        ) : null}

        <EffectComposer>
          <Bloom intensity={0.62} luminanceThreshold={0.1} luminanceSmoothing={0.34} mipmapBlur />
        </EffectComposer>

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={cameraState.minDistance}
          maxDistance={cameraState.maxDistance}
        />
        <CameraPilot
          controlsRef={controlsRef}
          cameraState={cameraState}
          tableNodes={tableNodes}
          selectedTableNode={selectedTableNode}
          selectedAsteroidNode={selectedAsteroidNode}
          selectedTableId={selectedTableId}
          selectedAsteroidId={selectedAsteroidId}
          focusOffset={cameraFocusOffset}
          microNudgeKey={cameraMicroNudgeKey}
          starDiveActive={starDiveActive}
          focusKey={`${level}:${selectedTableId || "-"}:${selectedAsteroidId || "-"}:${starDiveActive ? "star" : "space"}`}
        />
      </Canvas>
      {builderDropActive ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            border: builderDropHover ? "2px solid rgba(125, 226, 255, 0.7)" : "2px dashed rgba(125, 226, 255, 0.36)",
            boxShadow: builderDropHover
              ? "inset 0 0 48px rgba(89, 209, 255, 0.22)"
              : "inset 0 0 24px rgba(89, 209, 255, 0.1)",
            background:
              "repeating-linear-gradient(0deg, rgba(64, 177, 220, 0.06), rgba(64, 177, 220, 0.06) 1px, transparent 1px, transparent 28px), repeating-linear-gradient(90deg, rgba(64, 177, 220, 0.06), rgba(64, 177, 220, 0.06) 1px, transparent 1px, transparent 28px)",
            opacity: builderDropHover ? 1 : 0.72,
            transition: "opacity 160ms ease, border-color 180ms ease, box-shadow 180ms ease",
          }}
        />
      ) : null}
      {!hideMouseGuide ? <MouseGuideOverlay level={level} hoveredNode={hoveredNode} /> : null}
    </div>
  );
}
