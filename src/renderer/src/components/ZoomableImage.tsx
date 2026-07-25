import { useRef, useState, useEffect, useCallback } from 'react'

interface ZoomableImageProps {
  src: string
  alt: string
  onError?: () => void
}

const MAX_SCALE = 8

/**
 * Full-screen image viewer with pixel inspection:
 * - scroll wheel zooms around the cursor
 * - drag pans while zoomed
 * - double-click toggles between fit and 100% (1 image pixel = 1 screen pixel)
 */
export function ZoomableImage({ src, alt, onError }: ZoomableImageProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null)

  // Reset zoom whenever the photo changes
  useEffect(() => {
    setScale(1)
    setPos({ x: 0, y: 0 })
  }, [src])

  const clampPos = useCallback((x: number, y: number, s: number): { x: number; y: number } => {
    const img = imgRef.current
    const cont = containerRef.current
    if (!img || !cont) return { x, y }
    const maxX = Math.max(0, (img.clientWidth * s - cont.clientWidth) / 2 + 48)
    const maxY = Math.max(0, (img.clientHeight * s - cont.clientHeight) / 2 + 48)
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y))
    }
  }, [])

  const zoomTo = useCallback(
    (target: number, clientX?: number, clientY?: number): void => {
      const next = Math.min(MAX_SCALE, Math.max(1, target))
      setScale((prev) => {
        if (next === 1) {
          setPos({ x: 0, y: 0 })
          return 1
        }
        const cont = containerRef.current
        if (cont && clientX !== undefined && clientY !== undefined) {
          const rect = cont.getBoundingClientRect()
          const cx = clientX - rect.left - rect.width / 2
          const cy = clientY - rect.top - rect.height / 2
          const ratio = next / prev
          setPos((p) => clampPos(cx - (cx - p.x) * ratio, cy - (cy - p.y) * ratio, next))
        } else {
          setPos((p) => clampPos(p.x, p.y, next))
        }
        return next
      })
    },
    [clampPos]
  )

  // Wheel zoom needs a non-passive native listener so preventDefault works
  useEffect(() => {
    const cont = containerRef.current
    if (!cont) return undefined
    function onWheel(e: WheelEvent): void {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.25 : 0.8
      zoomTo(scaleRef.current * factor, e.clientX, e.clientY)
    }
    cont.addEventListener('wheel', onWheel, { passive: false })
    return () => cont.removeEventListener('wheel', onWheel)
  }, [zoomTo])

  // Keep the latest scale readable from the wheel handler without re-binding
  const scaleRef = useRef(scale)
  scaleRef.current = scale

  function pixelScale(): number {
    // scale at which one image pixel maps to one screen pixel
    const img = imgRef.current
    if (!img || img.clientWidth === 0) return 2
    return Math.max(1, img.naturalWidth / img.clientWidth)
  }

  function onDoubleClick(e: React.MouseEvent): void {
    if (scale > 1) zoomTo(1)
    else zoomTo(pixelScale(), e.clientX, e.clientY)
  }

  function onMouseDown(e: React.MouseEvent): void {
    if (scale <= 1 || e.button !== 0) return
    e.preventDefault()
    dragStart.current = { x: e.clientX, y: e.clientY, posX: pos.x, posY: pos.y }
    setDragging(true)

    function onMove(ev: MouseEvent): void {
      const start = dragStart.current
      if (!start) return
      setPos(clampPos(start.posX + ev.clientX - start.x, start.posY + ev.clientY - start.y, scaleRef.current))
    }
    function onUp(): void {
      dragStart.current = null
      setDragging(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const zoomPercent = imgRef.current
    ? Math.round(((imgRef.current.clientWidth * scale) / Math.max(1, imgRef.current.naturalWidth)) * 100)
    : 100

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center overflow-hidden"
      onDoubleClick={onDoubleClick}
      onMouseDown={onMouseDown}
      style={{ cursor: scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'zoom-in' }}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        draggable={false}
        onError={onError}
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl select-none"
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
          transition: dragging ? 'none' : 'transform 120ms ease-out'
        }}
      />
      {scale > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-black/70 text-[11px] text-zinc-300 pointer-events-none">
          {zoomPercent}%
        </div>
      )}
    </div>
  )
}
