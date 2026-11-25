"use client";

import { useEffect, useRef } from "react";

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
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let rafId: number | null = null;
    let nextX = 0;
    let nextY = 0;
    let listenersActive = false;

    const scheduleUpdate = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        el.style.setProperty("--px", nextX.toFixed(4));
        el.style.setProperty("--py", nextY.toFixed(4));
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      nextX = (e.clientX / window.innerWidth - 0.5) * 2;
      nextY = (e.clientY / window.innerHeight - 0.5) * 2;
      scheduleUpdate();
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      nextX = (touch.clientX / window.innerWidth - 0.5) * 2;
      nextY = (touch.clientY / window.innerHeight - 0.5) * 2;
      scheduleUpdate();
    };

    const handleScroll = () => {
      const progress = Math.min(window.scrollY / 320, 1.5);
      nextY = Math.max(-1.2, Math.min(1.2, progress - 0.2));
      scheduleUpdate();
    };

    const attachListeners = () => {
      if (listenersActive) return;
      listenersActive = true;
      window.addEventListener("mousemove", handleMouseMove, { passive: true });
      window.addEventListener("touchmove", handleTouchMove, { passive: true });
      window.addEventListener("scroll", handleScroll, { passive: true });
    };

    const detachListeners = () => {
      if (!listenersActive) return;
      listenersActive = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("scroll", handleScroll);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries[0]?.isIntersecting ?? false;
        if (isVisible) {
          attachListeners();
        } else {
          detachListeners();
        }
      },
      { threshold: 0 }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      detachListeners();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Orbes pastel difuminados con animación propia + paralaje suave */}
      <div
        className="absolute -right-24 -top-24 transition-transform duration-700 ease-out"
        style={{
          transform:
            "translate3d(calc(var(--px, 0) * -18px), calc(var(--py, 0) * -14px), 0)",
        }}
      >
        <div className="animate-zoe-orb-drift h-64 w-64 rounded-full bg-[#FAD4E4]/60 blur-3xl sm:h-80 sm:w-80" />
      </div>
      <div
        className="absolute -left-24 bottom-0 transition-transform duration-700 ease-out"
        style={{
          transform:
            "translate3d(calc(var(--px, 0) * 16px), calc(var(--py, 0) * 12px), 0)",
        }}
      >
        <div className="animate-zoe-orb-drift-reverse h-56 w-56 rounded-full bg-[#F9A8D4]/35 blur-3xl sm:h-72 sm:w-72" />
      </div>

      {/* Burbujas glossy rosadas flotantes (visibles en móvil y escritorio) */}
      <div
        className="absolute left-[4%] top-[12%] sm:left-[8%] sm:top-[18%] transition-transform duration-500 ease-out"
        style={{
          transform:
            "translate3d(calc(var(--px, 0) * 14px), calc(var(--py, 0) * 10px), 0)",
        }}
      >
        <div className="animate-zoe-float relative h-9 w-9 sm:h-12 sm:w-12 rounded-full border border-white/80 bg-gradient-to-br from-[#FFAED4]/70 via-[#FAD4E4]/55 to-white/80 shadow-[inset_-4px_-6px_12px_rgba(216,92,138,0.18),0_8px_20px_rgba(216,92,138,0.12)]">
          <span className="absolute left-2 top-1.5 h-2 w-3 sm:left-2.5 sm:top-2 sm:h-2.5 sm:w-4 rotate-[-28deg] rounded-full bg-white/85" />
        </div>
      </div>

      <div
        className="absolute right-[4%] top-[14%] sm:right-[10%] sm:top-[22%] transition-transform duration-500 ease-out"
        style={{
          transform:
            "translate3d(calc(var(--px, 0) * -16px), calc(var(--py, 0) * 12px), 0)",
        }}
      >
        <div
          className="animate-zoe-float-reverse relative h-11 w-11 sm:h-16 sm:w-16 rounded-full border border-white/85 bg-gradient-to-br from-[#FF9ECE]/55 via-[#FFF1F5]/75 to-white/90 shadow-[inset_-5px_-7px_14px_rgba(216,92,138,0.16),0_10px_24px_rgba(216,92,138,0.10)]"
          style={{ animationDelay: "0.8s" }}
        >
          <span className="absolute left-2.5 top-2 h-2.5 w-3.5 sm:left-3 sm:top-2.5 sm:h-3 sm:w-5 rotate-[-25deg] rounded-full bg-white/90" />
        </div>
      </div>

      <div
        className="absolute bottom-[10%] left-[6%] sm:bottom-[16%] sm:left-[14%] transition-transform duration-500 ease-out"
        style={{
          transform:
            "translate3d(calc(var(--px, 0) * 12px), calc(var(--py, 0) * -12px), 0)",
        }}
      >
        <div
          className="animate-zoe-float-reverse relative h-7 w-7 sm:h-9 sm:w-9 rounded-full border border-white/80 bg-gradient-to-br from-[#D85C8A]/30 via-[#FAD4E4]/65 to-white/85 shadow-sm"
          style={{ animationDelay: "1.5s" }}
        >
          <span className="absolute left-1.5 top-1 h-1.5 w-2 sm:left-2 sm:top-1.5 sm:w-2.5 rotate-[-28deg] rounded-full bg-white/90" />
        </div>
      </div>

      <div
        className="absolute bottom-[12%] right-[6%] sm:bottom-[18%] sm:right-[14%] transition-transform duration-500 ease-out"
        style={{
          transform:
            "translate3d(calc(var(--px, 0) * -12px), calc(var(--py, 0) * -10px), 0)",
        }}
      >
        <div
          className="animate-zoe-float relative h-8 w-8 sm:h-10 sm:w-10 rounded-full border border-white/80 bg-gradient-to-br from-[#FFAED4]/60 to-white/90 shadow-sm"
          style={{ animationDelay: "2s" }}
        >
          <span className="absolute left-1.5 top-1.5 h-1.5 w-2.5 sm:left-2 sm:h-2 sm:w-3 rotate-[-25deg] rounded-full bg-white/90" />
        </div>
      </div>

      {/* Destellos 4 puntas (✦) */}
      <div
        className="absolute left-[14%] top-[24%] sm:left-[18%] sm:top-[28%] text-[#D85C8A]/65 transition-transform duration-500"
        style={{
          transform:
            "translate3d(calc(var(--px, 0) * 20px), calc(var(--py, 0) * 14px), 0)",
        }}
      >
        <FourPointSparkle className="animate-zoe-twinkle h-5 w-5 sm:h-6 sm:w-6" />
      </div>

      <div
        className="absolute right-[15%] top-[28%] sm:right-[20%] sm:top-[34%] text-[#D85C8A]/75 transition-transform duration-500"
        style={{
          transform:
            "translate3d(calc(var(--px, 0) * -22px), calc(var(--py, 0) * 16px), 0)",
        }}
      >
        <FourPointSparkle className="animate-zoe-twinkle h-6 w-6 sm:h-7 sm:w-7" />
      </div>

      <div
        className="absolute left-[18%] bottom-[20%] sm:left-[26%] sm:bottom-[22%] text-[#F472B6]/65 transition-transform duration-500"
        style={{
          transform:
            "translate3d(calc(var(--px, 0) * 16px), calc(var(--py, 0) * -14px), 0)",
        }}
      >
        <FourPointSparkle className="animate-zoe-twinkle h-4 w-4" />
      </div>

      <div
        className="absolute right-[18%] bottom-[22%] sm:right-[24%] sm:bottom-[24%] text-[#D85C8A]/60 transition-transform duration-500"
        style={{
          transform:
            "translate3d(calc(var(--px, 0) * -18px), calc(var(--py, 0) * -12px), 0)",
        }}
      >
        <FourPointSparkle className="animate-zoe-twinkle h-4 w-4 sm:h-5 sm:w-5" />
      </div>

      {/* Tarjeta flotante de tono (mini swatch dinámico decorativo) */}
      <div
        className="absolute left-[4%] bottom-[28%] hidden lg:flex items-center gap-2 rounded-2xl border border-[#FAD4E4] bg-white/85 px-3 py-2 shadow-sm backdrop-blur-xs transition-transform duration-500"
        style={{
          transform:
            "translate3d(calc(var(--px, 0) * 10px), calc(var(--py, 0) * -8px), 0)",
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
          transform:
            "translate3d(calc(var(--px, 0) * -10px), calc(var(--py, 0) * 8px), 0)",
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
