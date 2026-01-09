'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';

type Layer = {
  id: string;
  type: 'image' | 'text';
  img?: HTMLImageElement;
  text?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  rotation: number; // radians
  visible?: boolean;
};

type Props = {
  width?: number; // canvas pixel width (texture resolution)
  height?: number;
  onChange?: (dataUrl: string) => void;
  initialBg?: string;
};

export default function DesignCanvas({ width = 2048, height = 1024, onChange, initialBg = '#ffffff' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [bgColor, setBgColor] = useState(initialBg);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<boolean>(false);
  const [mode, setMode] = useState<'idle' | 'move' | 'resize' | 'rotate'>('idle');
  const pointerRef = useRef({ startX: 0, startY: 0, sx: 0, sy: 0, origW: 0, origH: 0 });

  // helpers
  function addImageFromDataURL(dataUrl: string) {
    const img = new Image();
    img.onload = () => {
      const w = img.width;
      const h = img.height;
      setLayers((prev) => [
        ...prev,
        {
          id: 'L' + Date.now(),
          type: 'image',
          img,
          x: width / 2,
          y: height / 2,
          width: Math.min(width * 0.7, w),
          height: Math.min(height * 0.7, h),
          scale: 1,
          rotation: 0,
          visible: true,
        },
      ]);
    };
    img.src = dataUrl;
  }

  function addImageFromFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      addImageFromDataURL(String(reader.result));
    };
    reader.readAsDataURL(file);
  }

  function addTextLayer(text: string) {
    const size = Math.min(160, Math.floor(width * 0.08));
    const ctx = canvasRef.current?.getContext('2d')!;
    ctx.font = `${size}px sans-serif`;
    const metrics = ctx.measureText(text);
    const w = metrics.width;
    const h = size * 1.2;
    setLayers((prev) => [
      ...prev,
      {
        id: 'L' + Date.now(),
        type: 'text',
        text,
        x: width / 2,
        y: height / 2,
        width: w,
        height: h,
        scale: 1,
        rotation: 0,
        visible: true,
      },
    ]);
  }

  // redraw
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // draw layers in order
    for (const l of layers) {
      if (!l.visible) continue;
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(l.rotation);
      ctx.scale(l.scale, l.scale);
      if (l.type === 'image' && l.img) {
        const w = l.width;
        const h = l.height;
        ctx.drawImage(l.img, -w / 2, -h / 2, w, h);
      }
      if (l.type === 'text' && l.text) {
        ctx.fillStyle = '#000000';
        const fontSize = Math.floor(l.height);
        ctx.font = `${fontSize}px sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(l.text, 0, 0);
      }
      // outline when selected
      if (selectedId === l.id) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.strokeRect(-l.width / 2, -l.height / 2, l.width, l.height);
      }
      ctx.restore();
    }
  }, [layers, bgColor, selectedId]);

  // schedule export whenever layers/bg change
  useEffect(() => {
    redraw();
    const canvas = canvasRef.current!
    let timeout = setTimeout(() => {
      try {
        const data = canvas.toDataURL('image/png');
        onChange && onChange(data);
      } catch (e) {
        // ignore
      }
    }, 80);
    return () => clearTimeout(timeout);
  }, [layers, bgColor, onChange, redraw]);

  // hit testing: map point to layer local coords
  function pointToLayerLocal(px: number, py: number, layer: Layer) {
    const dx = px - layer.x;
    const dy = py - layer.y;
    // rotate back
    const c = Math.cos(-layer.rotation);
    const s = Math.sin(-layer.rotation);
    const rx = dx * c - dy * s;
    const ry = dx * s + dy * c;
    const lx = rx / layer.scale;
    const ly = ry / layer.scale;
    return { x: lx, y: ly };
  }

  const hitTest = useCallback((px: number, py: number) => {
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      const local = pointToLayerLocal(px, py, l);
      if (local.x >= -l.width / 2 && local.x <= l.width / 2 && local.y >= -l.height / 2 && local.y <= l.height / 2) {
        return l;
      }
    }
    return null;
  }, [layers]);

  // mouse / pointer events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function getPointer(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      const px = (e.clientX - rect.left) * (canvas!.width / rect.width);
      const py = (e.clientY - rect.top) * (canvas!.height / rect.height);
      return { px, py };
    }

    function onPointerDown(e: PointerEvent) {
      (e.target as Element).setPointerCapture(e.pointerId);
      const { px, py } = getPointer(e);
      const hit = hitTest(px, py);
      if (hit) {
        setSelectedId(hit.id);
        setDragging(true);
        setMode('move');
        pointerRef.current = { startX: px, startY: py, sx: hit.x, sy: hit.y, origW: hit.width, origH: hit.height };
      } else {
        setSelectedId(null);
      }
    }

    function onPointerMove(e: PointerEvent) {
      if (!dragging) return;
      const { px, py } = getPointer(e);
      if (mode === 'move' && selectedId) {
        setLayers((prev) => prev.map((l) => (l.id === selectedId ? { ...l, x: l.x + (px - pointerRef.current.startX), y: l.y + (py - pointerRef.current.startY) } : l)));
        pointerRef.current.startX = px;
        pointerRef.current.startY = py;
      }
    }

    function onPointerUp(e: PointerEvent) {
      try { (e.target as Element).releasePointerCapture(e.pointerId); } catch (e) {}
      setDragging(false);
      setMode('idle');
    }

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [layers, selectedId, dragging, mode, hitTest]);

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ width: 420, border: '1px solid rgba(255,255,255,0.04)', padding: 8, borderRadius: 8 }}>
        <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <input type="file" accept="image/*" onChange={(e) => addImageFromFile(e.target.files ? e.target.files[0] : null)} />
          </label>
          <button onClick={() => { const t = prompt('Enter text'); if (t) addTextLayer(t); }}>Add Text</button>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            Background <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
          </label>
        </div>

        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Layers</div>
          <div style={{ maxHeight: 220, overflow: 'auto', marginTop: 6 }}>
            {layers.map((l) => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 6, background: selectedId === l.id ? 'rgba(255,255,255,0.03)' : 'transparent', borderRadius: 6 }}>
                <button onClick={() => setSelectedId(l.id)} style={{ width: 20, height: 20 }}>{selectedId === l.id ? '●' : '○'}</button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}>{l.type === 'image' ? 'Image' : 'Text'}</div>
                  {l.type === 'text' && <div style={{ color: 'var(--muted)', fontSize: 12 }}>{l.text}</div>}
                </div>
                <button onClick={() => setLayers((prev) => prev.filter((x) => x.id !== l.id))} style={{ background: 'transparent', color: '#ff6b6b' }}>Delete</button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
          Tip: drag items on the canvas to move them. Use Add Image / Add Text to create layers. This is a lightweight editor—features like rotate/resize handles are intentionally minimal for now.
        </div>
      </div>

      <div style={{ flex: 1, border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8 }}>
        <canvas ref={canvasRef} width={width} height={height} style={{ width: 600, height: 300, display: 'block' }} />
      </div>
    </div>
  );
}
