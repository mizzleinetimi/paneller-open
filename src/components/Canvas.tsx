"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, Group, Image as KImage, Layer, Line, Rect, Shape, Stage, Text } from "react-konva";
import type Konva from "konva";
import { FAMILY, balloonPath, measure } from "@/lib/bubble";
import { type Bubble, type Panel, bounds, flatten } from "@/lib/doc";
import { useEditor } from "@/lib/store";

/**
 * Loads a URL into an <img> for Konva. The image is kept with the src it came
 * from, so while a new src loads we return nothing rather than the old picture.
 */
function useImage(src: string | undefined) {
  const [loaded, setLoaded] = useState<{ src: string; img: HTMLImageElement }>();
  useEffect(() => {
    if (!src) return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setLoaded({ src, img });
    img.src = src;
    return () => {
      img.onload = null;
    };
  }, [src]);
  return loaded && loaded.src === src ? loaded.img : undefined;
}

function PanelShape({
  panel,
  selected,
  hasPageArt,
  onZoom,
}: {
  panel: Panel;
  selected: boolean;
  hasPageArt: boolean;
  onZoom: (to: { x: number; y: number; width: number; height: number }) => void;
}) {
  const { select, updatePanel } = useEditor();
  const art = useImage(panel.art?.src);
  const box = useMemo(() => bounds(panel.shape), [panel.shape]);
  const groupRef = useRef<Konva.Group>(null);

  // The polygon lives in page coordinates, so after a drag we fold the offset
  // back into the points and put the group back at the origin.
  const onDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const { x, y } = e.target.position();
    e.target.position({ x: 0, y: 0 });
    if (x || y) updatePanel(panel.id, { shape: panel.shape.map((p) => ({ x: p.x + x, y: p.y + y })) });
  };

  return (
    <Group
      ref={groupRef}
      draggable
      onDragEnd={onDragEnd}
      onMouseDown={() => select({ kind: "panel", id: panel.id })}
      onTap={() => select({ kind: "panel", id: panel.id })}
      onDblClick={() => onZoom(box)}
      onDblTap={() => onZoom(box)}
    >
      <Group
        clipFunc={(ctx) => {
          ctx.beginPath();
          panel.shape.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.closePath();
        }}
      >
        {!hasPageArt && <Rect x={box.x} y={box.y} width={box.width} height={box.height} fill="#f1f1ef" />}
        {art && panel.art && (
          <KImage image={art} x={panel.art.x} y={panel.art.y} width={panel.art.width} height={panel.art.height} />
        )}
      </Group>
      <Line
        points={flatten(panel.shape)}
        closed
        stroke={selected ? "#2563eb" : "#111111"}
        strokeWidth={selected ? 6 : 4}
      />
    </Group>
  );
}

function BubbleShape({
  bubble,
  selected,
  scale,
  page,
}: {
  bubble: Bubble;
  selected: boolean;
  /** The stage's zoom, so handles stay the same size on screen at any zoom. */
  scale: number;
  page: { width: number; height: number };
}) {
  const { select, updateBubble } = useEditor();
  const { id, kind, x, y, text, fontSize, tail, clear } = bubble;
  const pick = () => select({ kind: "bubble", id });
  const groupRef = useRef<Konva.Group>(null);

  // The text decides the size unless the reader has set one by hand.
  const measured = useMemo(() => measure(text, kind, fontSize), [text, kind, fontSize]);
  const width = bubble.width ?? measured.width;
  const height = bubble.height ?? measured.height;
  const body = measured.lines.join("\n");

  // Balloon and tail are one closed path, so there is no seam where they meet.
  const localTail = tail ? { x: tail.x - x, y: tail.y - y } : undefined;

  return (
    <>
      <Group
        ref={groupRef}
        draggable
        x={x}
        y={y}
        onMouseDown={pick}
        onTap={pick}
        dragBoundFunc={(pos) => {
          // Keep it on the page: a bubble dragged off the edge is gone for good
          // at this zoom, with nothing left to grab.
          //
          // This is handed absolute coordinates on the stage, not coordinates
          // on the page, and the stage is both scaled and panned. Clamping as
          // though it sat at the origin is out by however far it has been
          // panned, which is what made bubbles jump.
          const stage = groupRef.current?.getStage();
          if (!stage) return pos;
          const zoom = stage.scaleX();
          const margin = 24;
          const onPage = (v: number, offset: number, extent: number) =>
            Math.min(Math.max(v, margin * zoom + offset), (extent - margin) * zoom + offset);
          return {
            x: onPage(pos.x, stage.x(), page.width),
            y: onPage(pos.y, stage.y(), page.height),
          };
        }}
        // The tail is anchored to whoever is speaking, so it stays where it is
        // and the balloon re-forms around it: move the balloon and the tail
        // stretches, turns and re-curves to keep pointing at the same head.
        // Updating live rather than on drop is what makes that visible while
        // dragging instead of snapping into place afterwards.
        onDragMove={(e) => updateBubble(id, { x: e.target.x(), y: e.target.y() }, true)}
        onDragEnd={(e) => updateBubble(id, { x: e.target.x(), y: e.target.y() })}
      >
        {kind === "speech" && (
          <Shape
            sceneFunc={(ctx, shape) => {
              balloonPath(ctx, width / 2, height / 2, localTail);
              ctx.fillStrokeShape(shape);
            }}
            hitFunc={(ctx, shape) => {
              balloonPath(ctx, width / 2, height / 2, localTail);
              ctx.fillStrokeShape(shape);
            }}
            fill="#ffffff"
            stroke={selected ? "#2563eb" : "#111111"}
            strokeWidth={selected ? 6 : 4}
            lineJoin="round"
          />
        )}
        {kind === "caption" && (
          <Rect
            x={-width / 2}
            y={-height / 2}
            width={width}
            height={height}
            fill="#fdf1c7"
            stroke={selected ? "#2563eb" : "#111111"}
            strokeWidth={selected ? 5 : 3}
          />
        )}
        {kind === "sfx" && clear && text && (
          <Rect x={-width / 2} y={-height / 2} width={width} height={height} fill={clear} />
        )}

        <Text
          x={-width / 2}
          y={-height / 2}
          width={width}
          height={height}
          text={body}
          align="center"
          verticalAlign="middle"
          lineHeight={1.22}
          fontSize={fontSize}
          fontStyle={kind === "sfx" ? "bold" : "normal"}
          fontFamily={FAMILY[kind]}
          fill={kind === "sfx" ? "#f5c518" : "#111111"}
          stroke={kind === "sfx" ? "#111111" : undefined}
          strokeWidth={kind === "sfx" ? 2.5 : 0}
          listening={false}
        />
        {kind === "sfx" && selected && (
          <Rect x={-width / 2} y={-height / 2} width={width} height={height} stroke="#2563eb" strokeWidth={4} dash={[10, 6]} />
        )}
      </Group>

      {/* Drag the tip to aim the tail at whoever is speaking. */}
      {selected && kind === "speech" && tail && (
        <Circle
          x={tail.x}
          y={tail.y}
          radius={11 / scale}
          hitStrokeWidth={22 / scale}
          fill="#2563eb"
          stroke="#ffffff"
          strokeWidth={3 / scale}
          draggable
          onDragMove={(e) => updateBubble(id, { tail: { x: e.target.x(), y: e.target.y() } }, true)}
          onDragEnd={(e) => updateBubble(id, { tail: { x: e.target.x(), y: e.target.y() } })}
        />
      )}
    </>
  );
}

const MIN_ZOOM = 0.08;
const MAX_ZOOM = 6;
const clamp = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export default function Canvas({ stageRef }: { stageRef: React.RefObject<Konva.Stage | null> }) {
  const { selection, select } = useEditor();
  const page = useEditor((s) => s.doc.pages[s.pageIndex]);
  const pageArt = useImage(page.art);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // No view means "show the whole page": it is worked out while rendering from
  // the room available, so there is no effect racing the first paint.
  const [view, setView] = useState<{ zoom: number; x: number; y: number } | null>(null);
  const [shown, setShown] = useState(page.id);
  if (shown !== page.id) {
    setShown(page.id);
    setView(null);
  }

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /** The view that puts a rectangle of the page in the middle. */
  const framing = useCallback(
    (box: { x: number; y: number; width: number; height: number }, margin: number) => {
      const zoom = clamp(Math.min((size.width - margin) / box.width, (size.height - margin) / box.height));
      return {
        zoom,
        x: size.width / 2 - (box.x + box.width / 2) * zoom,
        y: size.height / 2 - (box.y + box.height / 2) * zoom,
      };
    },
    [size.width, size.height],
  );

  const whole = useMemo(
    () =>
      size.width && size.height
        ? framing({ x: 0, y: 0, width: page.width, height: page.height }, 48)
        : { zoom: 0.4, x: 0, y: 0 },
    [framing, size.width, size.height, page.width, page.height],
  );

  const current = view ?? whole;
  const frame = (box: { x: number; y: number; width: number; height: number }, margin = 48) => {
    if (size.width && size.height) setView(framing(box, margin));
  };
  const fit = () => setView(null);

  /** Zooms about a point, so what is under the cursor stays under it. */
  const zoomAt = (next: number, at: { x: number; y: number }) => {
    setView((v) => {
      const from = v ?? whole;
      const zoom = clamp(next);
      return {
        zoom,
        x: at.x - ((at.x - from.x) / from.zoom) * zoom,
        y: at.y - ((at.y - from.y) / from.zoom) * zoom,
      };
    });
  };

  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    // A trackpad pinch arrives as a wheel with ctrl held; plain wheel pans, as
    // it does in every other canvas anyone has used.
    if (e.evt.ctrlKey || e.evt.metaKey) {
      if (pointer) zoomAt(current.zoom * Math.pow(0.998, e.evt.deltaY), pointer);
    } else {
      setView((v) => {
        const from = v ?? whole;
        return { ...from, x: from.x - e.evt.deltaX, y: from.y - e.evt.deltaY };
      });
    }
  };

  const step = (by: number) => zoomAt(current.zoom * by, { x: size.width / 2, y: size.height / 2 });

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-[var(--paper-2)]">
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        scale={{ x: current.zoom, y: current.zoom }}
        x={current.x}
        y={current.y}
        draggable
        onWheel={onWheel}
        onDragEnd={(e) => {
          if (e.target === e.target.getStage()) setView((v) => ({ ...(v ?? whole), x: e.target.x(), y: e.target.y() }));
        }}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) select(null);
        }}
      >
        <Layer>
          <Rect
            width={page.width}
            height={page.height}
            fill={page.background}
            shadowColor="#000"
            shadowBlur={24 / current.zoom}
            shadowOpacity={0.18}
            shadowOffset={{ x: 0, y: 6 / current.zoom }}
          />
          {pageArt && <KImage image={pageArt} width={page.width} height={page.height} listening={false} />}
          {page.panels.map((panel) => (
            <PanelShape
              key={panel.id}
              panel={panel}
              hasPageArt={Boolean(page.art)}
              onZoom={(box) => frame(box, 24)}
              selected={selection?.kind === "panel" && selection.id === panel.id}
            />
          ))}
          {page.bubbles.map((bubble) => (
            <BubbleShape
              key={bubble.id}
              bubble={bubble}
              scale={current.zoom}
              page={page}
              selected={selection?.kind === "bubble" && selection.id === bubble.id}
            />
          ))}
        </Layer>
      </Stage>

      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-1 rounded-lg border-2 border-[var(--line)] bg-[var(--paper-raised)] px-1.5 py-1 shadow-[2px_2px_0_var(--line)]">
          <button className="px-2 text-[15px] leading-none" onClick={() => step(1 / 1.25)} title="Zoom out">-</button>
          <span className="w-12 text-center text-[11px] tabular-nums text-ink-soft">
            {Math.round(current.zoom * 100)}%
          </span>
          <button className="px-2 text-[15px] leading-none" onClick={() => step(1.25)} title="Zoom in">+</button>
          <span className="mx-0.5 h-4 w-px bg-[var(--rule)]" />
          <button className="px-2 text-[11px] font-bold" onClick={fit}>Fit</button>
        </div>
      </div>

      <p className="pointer-events-none absolute bottom-3 right-3 hidden text-[11px] text-ink-faint lg:block">
        Pinch or ctrl-scroll to zoom · drag to pan · double-click a panel
      </p>
    </div>
  );
}
