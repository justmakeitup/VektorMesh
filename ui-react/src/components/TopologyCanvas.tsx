import React, { useRef, useEffect, useCallback } from "react";
import {
  ServiceNodeDb,
  ServiceEdgeDb,
  SystemStateSnapshot,
  ServiceNodeStatus,
  CircuitState,
  FaultType
} from "../types/mesh";

interface TopologyCanvasProps {
  topology: { nodes: ServiceNodeDb[]; edges: ServiceEdgeDb[] };
  snapshot: SystemStateSnapshot | null;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

interface NodeLayout {
  id: string;
  name: string;
  tier: string;
  x: number;
  y: number;
  width: number;
  height: number;
  circuitState: CircuitState;
  cascadeProbability: number;
  p99Ms: number;
  heapPct: number;
  activeFault?: { type: FaultType; intensityPct: number; remaining: number };
}

interface Particle {
  sourceId: string;
  targetId: string;
  progress: number; // 0.0 to 1.0
  speed: number;
  size: number;
  color: string;
  trail: { x: number; y: number }[];
  isColdReplica: boolean;
}

export const TopologyCanvas: React.FC<TopologyCanvasProps> = ({
  topology,
  snapshot,
  selectedNodeId,
  onSelectNode
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const hoveredNodeIdRef = useRef<string | null>(null);
  const nodeLayoutsRef = useRef<Map<string, NodeLayout>>(new Map());
  const particlesRef = useRef<Particle[]>([]);
  const animFrameIdRef = useRef<number | null>(null);
  const blastPulseRef = useRef<number>(0);

  // --------------------------------------------------------------------------
  // 1. Deterministic Layered DAG Layout Calculator
  // --------------------------------------------------------------------------
  const updateNodeLayouts = useCallback(
    (width: number, height: number) => {
      const layouts = new Map<string, NodeLayout>();

      // Deterministic layout grid (3 columns x 2 rows)
      // Col 1 (Edge): api-gateway
      // Col 2 (Core): auth-service (top), order-processor (bottom)
      // Col 3 (Data & Workers): payment-ledger, inventory-db-proxy, notification-worker
      const nodeWidth = 190;
      const nodeHeight = 110;

      const col1X = width * 0.16;
      const col2X = width * 0.48;
      const col3X = width * 0.82;

      const positions: Record<string, { x: number; y: number }> = {
        "api-gateway": { x: col1X, y: height * 0.46 },
        "auth-service": { x: col2X, y: height * 0.24 },
        "order-processor": { x: col2X, y: height * 0.68 },
        "payment-ledger": { x: col3X, y: height * 0.20 },
        "inventory-db-proxy": { x: col3X, y: height * 0.52 },
        "notification-worker": { x: col3X, y: height * 0.82 }
      };

      for (const node of topology.nodes) {
        const pos = positions[node.id] || { x: width * 0.5, y: height * 0.5 };
        const liveStatus: ServiceNodeStatus | undefined = snapshot?.nodes?.find(
          (n) => n.serviceId === node.id
        );

        let circuitState: CircuitState = liveStatus ? liveStatus.circuitState : "CLOSED";
        let cascadeProbability = liveStatus?.latestVerdict?.cascadeProbability || 0;
        let p99Ms = liveStatus?.latestTelemetry?.p99LatencyMs || 0;
        let heapUsed = liveStatus?.latestTelemetry?.heapUsedMb || 0;
        let heapMax = liveStatus?.latestTelemetry?.heapMaxMb || 1024;
        let heapPct = Math.min(100, Math.round((heapUsed / (heapMax || 1)) * 100));

        let activeFault = undefined;
        if (liveStatus?.activeFaults && liveStatus.activeFaults.length > 0) {
          const f = liveStatus.activeFaults[0];
          activeFault = {
            type: f.faultType,
            intensityPct: f.intensityPct,
            remaining: f.remainingSeconds
          };
        }

        layouts.set(node.id, {
          id: node.id,
          name: node.service_name || node.id,
          tier: node.tier || "CORE",
          x: pos.x,
          y: pos.y,
          width: nodeWidth,
          height: nodeHeight,
          circuitState,
          cascadeProbability,
          p99Ms,
          heapPct,
          activeFault
        });
      }

      nodeLayoutsRef.current = layouts;
    },
    [topology.nodes, snapshot]
  );

  // --------------------------------------------------------------------------
  // 2. Particle Initialization
  // --------------------------------------------------------------------------
  const syncParticles = useCallback(() => {
    if (topology.edges.length === 0) return;

    if (particlesRef.current.length === 0) {
      const initialParticles: Particle[] = [];

      for (const edge of topology.edges) {
        for (let i = 0; i < 3; i++) {
          initialParticles.push({
            sourceId: edge.source_service_id,
            targetId: edge.target_service_id,
            progress: Math.random(),
            speed: 0.006 + Math.random() * 0.004,
            size: 2.8,
            color: "#D1E8E2",
            trail: [],
            isColdReplica: false
          });
        }
      }
      particlesRef.current = initialParticles;
    }
  }, [topology.edges]);

  // --------------------------------------------------------------------------
  // 3. Main 60fps Canvas Render Loop
  // --------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const container = containerRef.current;
      if (!container || !canvas) return;

      const rect = container.getBoundingClientRect();
      dpr = window.devicePixelRatio || 1;

      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      updateNodeLayouts(rect.width, rect.height);
      syncParticles();
    };

    resize();
    window.addEventListener("resize", resize);

    const render = () => {
      blastPulseRef.current = (blastPulseRef.current + 0.035) % (Math.PI * 2);

      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Theme Dark Background (#2C3531) with tactical matrix grid
      ctx.fillStyle = "#2C3531";
      ctx.fillRect(0, 0, width, height);

      drawTacticalGrid(ctx, width, height);

      // 2. Draw Directed Edge Links & Active Routes
      drawEdgeLinks(ctx, width, height);

      // 3. Update & Draw Traffic Particles
      drawTrafficParticles(ctx);

      // 4. Draw Blast Radius Pulse Rings
      drawBlastRadiusRings(ctx);

      // 5. Draw Service Nodes
      drawServiceNodes(ctx);

      ctx.restore();
      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [topology, snapshot, selectedNodeId, updateNodeLayouts, syncParticles]);

  // --------------------------------------------------------------------------
  // Canvas Sub-Routines
  // --------------------------------------------------------------------------

  const drawTacticalGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.strokeStyle = "rgba(17, 100, 102, 0.22)";
    ctx.lineWidth = 1;

    const gridSize = 40;
    ctx.beginPath();
    for (let x = 0; x < width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Subtle crosshairs
    ctx.fillStyle = "rgba(209, 232, 226, 0.22)";
    for (let x = 0; x < width; x += gridSize * 4) {
      for (let y = 0; y < height; y += gridSize * 4) {
        ctx.fillRect(x - 2, y - 2, 4, 4);
      }
    }
  };

  const drawEdgeLinks = (
    ctx: CanvasRenderingContext2D,
    _width: number,
    _height: number
  ) => {
    const layouts = nodeLayoutsRef.current;

    for (const edge of topology.edges) {
      const src = layouts.get(edge.source_service_id);
      const dst = layouts.get(edge.target_service_id);
      if (!src || !dst) continue;

      const sx = src.x + src.width / 2;
      const sy = src.y;
      const dx = dst.x - dst.width / 2;
      const dy = dst.y;

      const liveRoute = snapshot?.activeRoutes?.find(
        (r) =>
          r.sourceServiceId === edge.source_service_id &&
          r.targetServiceId === edge.target_service_id
      );

      const primaryWeight = liveRoute ? liveRoute.primaryWeightPct : edge.primary_weight_pct;
      const coldWeight = liveRoute ? liveRoute.coldReplicaWeightPct : edge.cold_replica_weight_pct;
      const isCircuitOpen = dst.circuitState === "OPEN";

      // 1. Draw Background Edge Path
      ctx.beginPath();
      const cp1x = sx + (dx - sx) * 0.5;
      const cp1y = sy;
      const cp2x = sx + (dx - sx) * 0.5;
      const cp2y = dy;

      ctx.moveTo(sx, sy);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, dx, dy);

      if (isCircuitOpen) {
        ctx.strokeStyle = "rgba(239, 68, 68, 0.45)";
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.5;
      } else if (coldWeight > 40) {
        // Cold replica active path: Warm Peach Amber (#FFCB9A)
        ctx.strokeStyle = "rgba(255, 203, 154, 0.75)";
        ctx.setLineDash([]);
        ctx.lineWidth = 2.5;
      } else {
        // Normal Edge: Deep Teal (#116466)
        ctx.strokeStyle = "rgba(17, 100, 102, 0.75)";
        ctx.setLineDash([]);
        ctx.lineWidth = 2;
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // 2. Draw Circuit Open Barrier Marker if tripped
      if (isCircuitOpen) {
        const midX = (sx + dx) / 2;
        const midY = (sy + dy) / 2;
        ctx.fillStyle = "#EF4444";
        ctx.beginPath();
        ctx.arc(midX, midY, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(midX - 3, midY - 3);
        ctx.lineTo(midX + 3, midY + 3);
        ctx.moveTo(midX + 3, midY - 3);
        ctx.lineTo(midX - 3, midY + 3);
        ctx.stroke();
      }

      // 3. Draw Route Weight Badge at edge midpoint
      const midX = (sx + dx) / 2;
      const midY = (sy + dy) / 2;
      ctx.fillStyle = "#1E2623";
      ctx.strokeStyle = "#116466";
      ctx.lineWidth = 1;
      ctx.fillRect(midX - 24, midY - 10, 48, 20);
      ctx.strokeRect(midX - 24, midY - 10, 48, 20);

      ctx.fillStyle = coldWeight > 0 ? "#FFCB9A" : "#D1E8E2";
      ctx.font = "bold 9px 'Share Tech Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label = coldWeight > 0 ? `C:${Math.round(coldWeight)}%` : `P:${Math.round(primaryWeight)}%`;
      ctx.fillText(label, midX, midY);
    }
  };

  const drawTrafficParticles = (ctx: CanvasRenderingContext2D) => {
    const layouts = nodeLayoutsRef.current;

    for (const p of particlesRef.current) {
      const src = layouts.get(p.sourceId);
      const dst = layouts.get(p.targetId);
      if (!src || !dst) continue;

      if (dst.circuitState === "OPEN") {
        continue;
      }

      const liveRoute = snapshot?.activeRoutes?.find(
        (r) => r.sourceServiceId === p.sourceId && r.targetServiceId === p.targetId
      );
      const coldReplicaActive = liveRoute ? liveRoute.coldReplicaWeightPct >= 40 : false;
      const targetLatency = dst.p99Ms || 30;

      let baseSpeed = 0.007;
      if (targetLatency > 200) baseSpeed = 0.003;
      else if (targetLatency > 100) baseSpeed = 0.005;

      p.progress += baseSpeed;
      if (p.progress >= 1.0) {
        p.progress = 0;
        p.trail = [];
      }

      const sx = src.x + src.width / 2;
      const sy = src.y;
      const dx = dst.x - dst.width / 2;
      const dy = dst.y;
      const cp1x = sx + (dx - sx) * 0.5;
      const cp1y = sy;
      const cp2x = sx + (dx - sx) * 0.5;
      const cp2y = dy;

      const t = p.progress;
      const cx =
        Math.pow(1 - t, 3) * sx +
        3 * Math.pow(1 - t, 2) * t * cp1x +
        3 * (1 - t) * Math.pow(t, 2) * cp2x +
        Math.pow(t, 3) * dx;
      const cy =
        Math.pow(1 - t, 3) * sy +
        3 * Math.pow(1 - t, 2) * t * cp1y +
        3 * (1 - t) * Math.pow(t, 2) * cp2y +
        Math.pow(t, 3) * dy;

      // Particle Color: Mint (#D1E8E2) for primary, Warm Peach (#FFCB9A) for cold replica
      const particleColor = coldReplicaActive ? "#FFCB9A" : "#D1E8E2";

      ctx.beginPath();
      ctx.arc(cx, cy, p.size, 0, Math.PI * 2);
      ctx.fillStyle = particleColor;
      ctx.shadowColor = particleColor;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  };

  const drawBlastRadiusRings = (ctx: CanvasRenderingContext2D) => {
    const layouts = nodeLayoutsRef.current;
    const pulse = blastPulseRef.current;

    for (const node of layouts.values()) {
      const isSevere = node.cascadeProbability >= 0.70 || !!node.activeFault;
      if (!isSevere) continue;

      const cx = node.x;
      const cy = node.y;

      for (let r = 1; r <= 3; r++) {
        const ringRadius = 70 + ((pulse * 15 * r) % 65);
        const opacity = Math.max(0, 0.45 - ringRadius / 150);

        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 203, 154, ${opacity})`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  };

  const drawServiceNodes = (ctx: CanvasRenderingContext2D) => {
    const layouts = nodeLayoutsRef.current;

    for (const node of layouts.values()) {
      const isSelected = selectedNodeId === node.id;
      const isHovered = hoveredNodeIdRef.current === node.id;
      const isCritical = node.cascadeProbability >= 0.70 || node.circuitState === "OPEN";

      const left = node.x - node.width / 2;
      const top = node.y - node.height / 2;

      // 1. Outer Glow / Aura
      if (isCritical) {
        ctx.shadowColor = "#EF4444";
        ctx.shadowBlur = 24;
      } else if (node.cascadeProbability >= 0.40) {
        ctx.shadowColor = "#FFCB9A";
        ctx.shadowBlur = 18;
      } else if (isSelected) {
        ctx.shadowColor = "#FFCB9A";
        ctx.shadowBlur = 20;
      } else {
        ctx.shadowBlur = 0;
      }

      // 2. Node Card Background & Border
      ctx.fillStyle = isHovered ? "#2A3530" : "#202824";
      roundRect(ctx, left, top, node.width, node.height, 8);
      ctx.fill();

      // Border styling
      if (isSelected) {
        ctx.strokeStyle = "#FFCB9A";
        ctx.lineWidth = 2;
      } else if (isCritical) {
        ctx.strokeStyle = "#EF4444";
        ctx.lineWidth = 1.8;
      } else if (node.cascadeProbability >= 0.40) {
        ctx.strokeStyle = "#D9B08C";
        ctx.lineWidth = 1.5;
      } else {
        ctx.strokeStyle = isHovered ? "#D9B08C" : "#116466";
        ctx.lineWidth = 1.2;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 3. Selection Corner Brackets
      if (isSelected) {
        drawCornerBrackets(ctx, left, top, node.width, node.height);
      }

      // 4. Header Badge: Tier Pill + Circuit State Pill
      ctx.textAlign = "left";
      ctx.textBaseline = "top";

      // Tier badge
      ctx.fillStyle = "rgba(17, 100, 102, 0.45)";
      roundRect(ctx, left + 10, top + 10, 48, 16, 4);
      ctx.fill();
      ctx.fillStyle = "#D1E8E2";
      ctx.font = "bold 9px 'Share Tech Mono', monospace";
      ctx.fillText(node.tier, left + 16, top + 14);

      // Circuit State indicator
      const stateColor =
        node.circuitState === "CLOSED"
          ? "#D1E8E2"
          : node.circuitState === "HALF_OPEN"
          ? "#FFCB9A"
          : "#EF4444";

      ctx.fillStyle = stateColor;
      ctx.beginPath();
      ctx.arc(left + node.width - 18, top + 18, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = "bold 9px 'Share Tech Mono', monospace";
      ctx.textAlign = "right";
      ctx.fillText(node.circuitState, left + node.width - 26, top + 14);

      // 5. Service ID / Name in Matrix Heading Font
      ctx.fillStyle = "#D1E8E2";
      ctx.font = "bold 13px 'Share Tech Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText(node.id.toUpperCase(), left + 10, top + 34);

      ctx.fillStyle = "#D9B08C";
      ctx.font = "10px 'Chakra Petch', sans-serif";
      const truncatedName =
        node.name.length > 24 ? node.name.substring(0, 22) + "..." : node.name;
      ctx.fillText(truncatedName, left + 10, top + 50);

      // 6. Metrics Strip: P99 Latency & Heap Usage
      const metricTop = top + 70;
      ctx.fillStyle = "#161D1A";
      roundRect(ctx, left + 8, metricTop, node.width - 16, 30, 4);
      ctx.fill();

      // P99 badge
      ctx.fillStyle = "#D9B08C";
      ctx.font = "9px 'Share Tech Mono', monospace";
      ctx.fillText("p99:", left + 14, metricTop + 6);

      const p99Color = node.p99Ms > 150 ? "#EF4444" : node.p99Ms > 80 ? "#FFCB9A" : "#D1E8E2";
      ctx.fillStyle = p99Color;
      ctx.font = "bold 10px 'Share Tech Mono', monospace";
      ctx.fillText(`${Math.round(node.p99Ms)}ms`, left + 40, metricTop + 6);

      // Heap % badge
      ctx.fillStyle = "#D9B08C";
      ctx.font = "9px 'Share Tech Mono', monospace";
      ctx.fillText("Heap:", left + 100, metricTop + 6);

      const heapColor = node.heapPct > 80 ? "#EF4444" : node.heapPct > 65 ? "#FFCB9A" : "#D1E8E2";
      ctx.fillStyle = heapColor;
      ctx.font = "bold 10px 'Share Tech Mono', monospace";
      ctx.fillText(`${node.heapPct}%`, left + 135, metricTop + 6);

      // Mini Cascade Probability Bar at bottom of card
      const barY = metricTop + 22;
      ctx.fillStyle = "#116466";
      ctx.fillRect(left + 14, barY, node.width - 28, 3);

      const probWidth = (node.width - 28) * Math.min(1.0, node.cascadeProbability);
      ctx.fillStyle =
        node.cascadeProbability > 0.70
          ? "#EF4444"
          : node.cascadeProbability > 0.40
          ? "#FFCB9A"
          : "#D1E8E2";
      ctx.fillRect(left + 14, barY, probWidth, 3);

      // 7. Active Chaos Warning Badge if fault injected
      if (node.activeFault) {
        ctx.fillStyle = "rgba(239, 68, 68, 0.95)";
        roundRect(ctx, left + 10, top - 11, node.width - 20, 18, 4);
        ctx.fill();

        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 9px 'Share Tech Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(`⚡ ${node.activeFault.type} (${node.activeFault.remaining}s)`, node.x, top - 7);
      }
    }
  };

  const drawCornerBrackets = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ) => {
    const len = 8;
    ctx.strokeStyle = "#FFCB9A";
    ctx.lineWidth = 2;

    // Top-Left
    ctx.beginPath();
    ctx.moveTo(x - 3, y - 3 + len);
    ctx.lineTo(x - 3, y - 3);
    ctx.lineTo(x - 3 + len, y - 3);
    ctx.stroke();

    // Top-Right
    ctx.beginPath();
    ctx.moveTo(x + w + 3 - len, y - 3);
    ctx.lineTo(x + w + 3, y - 3);
    ctx.lineTo(x + w + 3, y - 3 + len);
    ctx.stroke();

    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(x - 3, y + h + 3 - len);
    ctx.lineTo(x - 3, y + h + 3);
    ctx.lineTo(x - 3 + len, y + h + 3);
    ctx.stroke();

    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(x + w + 3 - len, y + h + 3);
    ctx.lineTo(x + w + 3, y + h + 3);
    ctx.lineTo(x + w + 3, y + h + 3 - len);
    ctx.stroke();
  };

  const roundRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // --------------------------------------------------------------------------
  // 4. Mouse Hit Testing & Selection
  // --------------------------------------------------------------------------
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let foundId: string | null = null;
    for (const [id, node] of nodeLayoutsRef.current.entries()) {
      const left = node.x - node.width / 2;
      const right = node.x + node.width / 2;
      const top = node.y - node.height / 2;
      const bottom = node.y + node.height / 2;

      if (mouseX >= left && mouseX <= right && mouseY >= top && mouseY <= bottom) {
        foundId = id;
        break;
      }
    }

    hoveredNodeIdRef.current = foundId;
    canvas.style.cursor = foundId ? "pointer" : "default";
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    for (const [id, node] of nodeLayoutsRef.current.entries()) {
      const left = node.x - node.width / 2;
      const right = node.x + node.width / 2;
      const top = node.y - node.height / 2;
      const bottom = node.y + node.height / 2;

      if (mouseX >= left && mouseX <= right && mouseY >= top && mouseY <= bottom) {
        onSelectNode(id);
        return;
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[540px] bg-[#2C3531] rounded-lg border border-[#116466]/50 overflow-hidden select-none"
    >
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        className="block w-full h-full"
      />

      {/* Canvas Overlay Legend */}
      <div className="absolute top-3 left-3 flex items-center space-x-4 px-3 py-1.5 bg-[#222B27]/90 border border-[#116466]/60 rounded text-xs text-[#D1E8E2] font-matrix backdrop-blur-sm pointer-events-none shadow-md">
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#D1E8E2] shadow-sm shadow-[#D1E8E2]/60"></span>
          <span className="text-[11px] uppercase tracking-wider">Primary Route</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FFCB9A] shadow-sm shadow-[#FFCB9A]/60"></span>
          <span className="text-[11px] uppercase tracking-wider">Cold Replica</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] shadow-sm shadow-[#EF4444]/60"></span>
          <span className="text-[11px] uppercase tracking-wider">Open Circuit</span>
        </div>
      </div>

      <div className="absolute bottom-3 left-3 text-[11px] text-[#D9B08C] font-matrix pointer-events-none tracking-wider">
        [SELECT NODE TO ACTIVATE DUAL-MODEL ML INSPECTOR & TELEMETRY STREAM]
      </div>
    </div>
  );
};
