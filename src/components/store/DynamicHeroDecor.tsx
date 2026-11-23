"use client";

import { useEffect, useState } from "react";

interface ParallaxOffset {
  x: number;
  y: number;
}

function FourPointSparkle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 1.5C12.9 7.2 16.8 11.1 22.5 12C16.8 12.9 12.9 16.8 12 22.5C11.1 16.8 7.2 12.9 1.5 12C7.2 11.1 11.1 7.2 12 1.5Z" />
    </svg>
  );
}

export function DynamicHeroDecor() {
  const [offset, setOffset] = useState<ParallaxOffset>({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      setOffset({ x: nx, y: ny });
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Orbes pastel difuminados con paralaje suave */}
      <div
        className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#FAD4E4]/55 blur-3xl transition-transform duration-700 ease-out"
        style={{
          transform: `translate3d(${offset.x * -18}px, ${offset.y * -14}px, 0)`,
        }}
      />
      <div
        className="absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-[#F9A8D4]/30 blur-3xl transition-transform duration-700 ease-out"
        style={{
          transform: `translate3d(${offset.x * 16}px, ${offset.y * 12}px, 0)`,
        }}
      />

      {/* Burbujas glossy rosadas flotantes (inspiradas en el efecto burbuja del logo) */}
      <div
        className="absolute left-[8%] top-[18%] hidden sm:block transition-transform duration-500 ease-out"
        style={{
          transform: `translate3d(${offset.x * 14}px, ${offset.y * 10}px, 0)`,
        }}
      >
        <div className="animate-zoe-float relative h-12 w-12 rounded-full border border-white/80 bg-gradient-to-br from-[#FFAED4]/70 via-[#FAD4E4]/55 to-white/80 shadow-[inset_-4px_-6px_12px_rgba(216,92,138,0.18),0_8px_20px_rgba(216,92,138,0.12)]">
          <span className="absolute left-2.5 top-2 h-2.5 w-4 rotate-[-28deg] rounded-full bg-white/85" />
        </div>
      </div>

      <div
        className="absolute right-[10%] top-[22%] hidden sm:block transition-transform duration-500 ease-out"
        style={{
          transform: `translate3d(${offset.x * -16}px, ${offset.y * 12}px, 0)`,
        }}
      >
        <div
          className="animate-zoe-float-reverse relative h-16 w-16 rounded-full border border-white/85 bg-gradient-to-br from-[#FF9ECE]/55 via-[#FFF1F5]/75 to-white/90 shadow-[inset_-5px_-7px_14px_rgba(216,92,138,0.16),0_10px_24px_rgba(216,92,138,0.10)]"
          style={{ animationDelay: "0.8s" }}
        >
          <span className="absolute left-3 top-2.5 h-3 w-5 rotate-[-25deg] rounded-full bg-white/90" />
        </div>
      </div>

      <div
        className="absolute bottom-[16%] left-[14%] hidden md:block transition-transform duration-500 ease-out"
        style={{
          transform: `translate3d(${offset.x * 12}px, ${offset.y * -12}px, 0)`,
        }}
      >
        <div
          className="animate-zoe-float-reverse relative h-9 w-9 rounded-full border border-white/80 bg-gradient-to-br from-[#D85C8A]/30 via-[#FAD4E4]/65 to-white/85 shadow-sm"
          style={{ animationDelay: "1.5s" }}
        >
          <span className="absolute left-2 top-1.5 h-1.5 w-2.5 rotate-[-28deg] rounded-full bg-white/90" />
        </div>
      </div>

      <div
        className="absolute bottom-[18%] right-[14%] hidden md:block transition-transform duration-500 ease-out"
        style={{
          transform: `translate3d(${offset.x * -12}px, ${offset.y * -10}px, 0)`,
        }}
      >
        <div
          className="animate-zoe-float relative h-10 w-10 rounded-full border border-white/80 bg-gradient-to-br from-[#FFAED4]/60 to-white/90 shadow-sm"
          style={{ animationDelay: "2s" }}
        >
          <span className="absolute left-2 top-1.5 h-2 w-3 rotate-[-25deg] rounded-full bg-white/90" />
        </div>
      </div>

      {/* Destellos 4 puntas (✦) exactamente como los del logo de Zoe */}
      <div
        className="absolute left-[18%] top-[28%] text-[#D85C8A]/65 transition-transform duration-500"
        style={{
          transform: `translate3d(${offset.x * 20}px, ${offset.y * 14}px, 0)`,
        }}
      >
        <FourPointSparkle className="animate-zoe-twinkle h-6 w-6" />
      </div>

      <div
        className="absolute right-[20%] top-[34%] text-[#D85C8A]/75 transition-transform duration-500"
        style={{
          transform: `translate3d(${offset.x * -22}px, ${offset.y * 16}px, 0)`,
        }}
      >
        <FourPointSparkle
          className="animate-zoe-twinkle h-7 w-7"
        />
      </div>

      <div
        className="absolute left-[26%] bottom-[22%] text-[#F472B6]/60 hidden sm:block transition-transform duration-500"
        style={{
          transform: `translate3d(${offset.x * 16}px, ${offset.y * -14}px, 0)`,
        }}
      >
        <FourPointSparkle className="animate-zoe-twinkle h-4 w-4" />
      </div>

      <div
        className="absolute right-[24%] bottom-[24%] text-[#D85C8A]/55 hidden sm:block transition-transform duration-500"
        style={{
          transform: `translate3d(${offset.x * -18}px, ${offset.y * -12}px, 0)`,
        }}
      >
        <FourPointSparkle className="animate-zoe-twinkle h-5 w-5" />
      </div>

      {/* Tarjeta flotante de tono (mini swatch dinámico decorativo) */}
      <div
        className="absolute left-[4%] bottom-[28%] hidden lg:flex items-center gap-2 rounded-2xl border border-[#FAD4E4] bg-white/85 px-3 py-2 shadow-sm backdrop-blur-xs transition-transform duration-500"
        style={{
          transform: `translate3d(${offset.x * 10}px, ${offset.y * -8}px, 0)`,
        }}
      >
        <div className="animate-zoe-float flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-full bg-[#E5989B] ring-2 ring-white shadow-xs" />
          <span className="h-3.5 w-3.5 rounded-full bg-[#D85C8A] ring-2 ring-white shadow-xs" />
          <span className="h-3.5 w-3.5 rounded-full bg-[#F48FB1] ring-2 ring-white shadow-xs" />
          <span className="ml-1 text-[11px] font-semibold text-[#B94470]">
            Tonos en vivo
          </span>
        </div>
      </div>

      <div
        className="absolute right-[4%] bottom-[30%] hidden lg:flex items-center gap-2 rounded-2xl border border-[#FAD4E4] bg-white/85 px-3 py-2 shadow-sm backdrop-blur-xs transition-transform duration-500"
        style={{
          transform: `translate3d(${offset.x * -10}px, ${offset.y * 8}px, 0)`,
        }}
      >
        <div className="animate-zoe-float-reverse flex items-center gap-1.5">
          <FourPointSparkle className="h-3.5 w-3.5 text-[#D85C8A]" />
          <span className="text-[11px] font-semibold text-[#B94470]">
            Mayorista automático
          </span>
        </div>
      </div>
    </div>
  );
}
