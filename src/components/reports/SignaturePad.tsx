"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";

export interface SignaturePadHandle {
  isEmpty: () => boolean;
  getDataURL: () => string;
  clear: () => void;
}

interface SignaturePadProps {
  label: string;
  existingUrl?: string | null;
}

const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad({ label, existingUrl }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const [hasStroke, setHasStroke] = useState(false);
    const [showExisting, setShowExisting] = useState(!!existingUrl);

    useEffect(() => {
      setShowExisting(!!existingUrl);
    }, [existingUrl]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#1e3a5f";
    }, []);

    function getPos(e: React.MouseEvent | React.TouchEvent) {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      if ("touches" in e) {
        return {
          x: (e.touches[0].clientX - rect.left) * scaleX,
          y: (e.touches[0].clientY - rect.top) * scaleY,
        };
      }
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }

    function start(e: React.MouseEvent | React.TouchEvent) {
      e.preventDefault();
      setShowExisting(false);
      drawing.current = true;
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const { x, y } = getPos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    }

    function move(e: React.MouseEvent | React.TouchEvent) {
      if (!drawing.current) return;
      e.preventDefault();
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const { x, y } = getPos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
      setHasStroke(true);
    }

    function end() {
      drawing.current = false;
    }

    function clear() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      setHasStroke(false);
      setShowExisting(false);
    }

    useImperativeHandle(ref, () => ({
      isEmpty: () => !hasStroke && !showExisting,
      getDataURL: () => {
        if (showExisting && existingUrl) return existingUrl;
        return canvasRef.current?.toDataURL("image/png") || "";
      },
      clear,
    }));

    return (
      <div>
        <p className="text-sm font-medium text-navy-800 mb-1.5">{label}</p>
        <div className="relative rounded-lg border border-border bg-white overflow-hidden">
          {showExisting && existingUrl && (
            <img
              src={existingUrl}
              alt="Existing signature"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none opacity-90"
            />
          )}
          <canvas
            ref={canvasRef}
            width={400}
            height={140}
            className="w-full h-[120px] touch-none cursor-crosshair block"
            onMouseDown={start}
            onMouseMove={move}
            onMouseUp={end}
            onMouseLeave={end}
            onTouchStart={start}
            onTouchMove={move}
            onTouchEnd={end}
          />
        </div>
        <Button type="button" variant="ghost" size="sm" className="mt-1 h-8 px-2" onClick={clear}>
          Clear
        </Button>
      </div>
    );
  }
);

export default SignaturePad;
