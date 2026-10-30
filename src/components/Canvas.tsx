"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

function PanelShape({ panel, selected, hasPageArt }: { panel: Panel; selected: boolean; hasPageArt: boolean }) {
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
        draggable
        x={x}
        y={y}
        onMouseDown={pick}
        onTap={pick}
        dragBoundFunc={(pos) => {
          // Keep it on the page: a bubble dragged off the edge is gone for good
          // at this zoom, with nothing left to grab.
          const margin = 24;
          return {
            x: Math.min(Math.max(pos.x, margin * scale), (page.width - margin) * scale),
            y: Math.min(Math.max(pos.y, margin * scale), (page.height - margin) * scale),
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

export default function Canvas({ stageRef }: { stageRef: React.RefObject<Konva.Stage | null> }) {
  const { selection, select } = useEditor();
  const page = useEditor((s) => s.doc.pages[s.pageIndex]);
  const pageArt = useImage(page.art);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);

  useEffect(() => {
    const fit = () => {
      const el = wrapRef.current;
      if (el) setScale(Math.min((el.clientWidth - 48) / page.width, (el.clientHeight - 48) / page.height));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [page.width, page.height]);

  return (
    <div ref={wrapRef} className="flex h-full w-full items-center justify-center overflow-hidden bg-neutral-200 dark:bg-neutral-900">
      <Stage
        ref={stageRef}
        width={page.width * scale}
        height={page.height * scale}
        scale={{ x: scale, y: scale }}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) select(null);
        }}
        className="shadow-xl"
      >
        <Layer>
          <Rect width={page.width} height={page.height} fill={page.background} />
          {pageArt && <KImage image={pageArt} width={page.width} height={page.height} listening={false} />}
          {page.panels.map((panel) => (
            <PanelShape
              key={panel.id}
              panel={panel}
              hasPageArt={Boolean(page.art)}
              selected={selection?.kind === "panel" && selection.id === panel.id}
            />
          ))}
          {page.bubbles.map((bubble) => (
            <BubbleShape
              key={bubble.id}
              bubble={bubble}
              scale={scale}
              page={page}
              selected={selection?.kind === "bubble" && selection.id === bubble.id}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
