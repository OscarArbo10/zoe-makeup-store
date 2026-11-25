"use client";

import { memo, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Eye, Sparkles } from "lucide-react";
import type { ProductWithVariants } from "@/types/database";
import { formatCOP } from "@/lib/format";

interface ProductCardProps {
  product: ProductWithVariants;
  categoryName?: string;
  brandName?: string;
  wholesaleActive: boolean;
  index: number;
  onSelect: (product: ProductWithVariants) => void;
}

export const ProductCard = memo(function ProductCard({
  product,
  categoryName,
  brandName,
  wholesaleActive,
  index,
  onSelect,
}: ProductCardProps) {
  const activeVariants = useMemo(
    () => product.product_variants.filter((v) => v.is_active),
    [product.product_variants]
  );

  const [photoIndex, setPhotoIndex] = useState(0);
  const touchStartXRef = useRef<number | null>(null);

  const galleryImages = useMemo(() => {
    const prodImgs =
      product.image_urls && product.image_urls.length > 0
        ? product.image_urls
        : product.image_url
        ? [product.image_url]
        : [];
    return prodImgs.filter(Boolean);
  }, [product.image_urls, product.image_url]);

  const safePhotoIndex =
    galleryImages.length > 0 ? photoIndex % galleryImages.length : 0;
  const displayImageUrl = galleryImages[safePhotoIndex] ?? null;
  const hasMultiplePhotos = galleryImages.length > 1;
  const isAllOutOfStock =
    activeVariants.length === 0 || activeVariants.every((v) => v.stock <= 0);

  const goPrevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (galleryImages.length <= 1) return;
    setPhotoIndex(
      (prev) => (prev - 1 + galleryImages.length) % galleryImages.length
    );
  };

  const goNextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (galleryImages.length <= 1) return;
    setPhotoIndex((prev) => (prev + 1) % galleryImages.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!hasMultiplePhotos || touchStartXRef.current === null) return;
    const endX = e.changedTouches[0]?.clientX;
    if (typeof endX === "number") {
      const delta = endX - touchStartXRef.current;
      if (delta <= -32) {
        setPhotoIndex((prev) => (prev + 1) % galleryImages.length);
      } else if (delta >= 32) {
        setPhotoIndex(
          (prev) => (prev - 1 + galleryImages.length) % galleryImages.length
        );
      }
    }
    touchStartXRef.current = null;
  };

  return (
    <article
      onClick={() => onSelect(product)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(product);
        }
      }}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-[#FAD4E4]/70 bg-white shadow-[0_8px_30px_rgb(216,92,138,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#FAD4E4] hover:shadow-[0_14px_34px_rgb(216,92,138,0.12)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D85C8A] sm:rounded-3xl"
    >
      {/* Imagen / carrusel de fotos del producto */}
      <div
        className="relative aspect-square w-full overflow-hidden bg-[#FFF1F5]"
        onTouchStart={hasMultiplePhotos ? handleTouchStart : undefined}
        onTouchEnd={hasMultiplePhotos ? handleTouchEnd : undefined}
      >
        {displayImageUrl ? (
          <Image
            src={displayImageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
            loading={index < 4 ? "eager" : "lazy"}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="relative flex h-full w-full flex-col items-center justify-center p-4 text-center sm:p-6">
            <div className="absolute h-20 w-20 rounded-full bg-[#D85C8A] opacity-35 blur-2xl sm:h-24 sm:w-24" />
            <div className="relative flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-[#FAD4E4] shadow-md sm:h-16 sm:w-16">
              <Sparkles className="h-5 w-5 text-white drop-shadow-sm sm:h-6 sm:w-6" />
            </div>
            <span className="relative mt-2 text-[11px] font-medium tracking-wide text-[#B94470]/80 sm:mt-3 sm:text-xs">
              ZOÉ COSMETICS
            </span>
          </div>
        )}

        {/* Controles del carrusel si tiene varias fotos */}
        {hasMultiplePhotos && (
          <>
            <button
              type="button"
              onClick={goPrevPhoto}
              aria-label="Foto anterior"
              className="absolute left-1.5 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/85 text-[#2D2226] shadow-sm backdrop-blur-xs transition-opacity hover:bg-white sm:left-2 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goNextPhoto}
              aria-label="Siguiente foto"
              className="absolute right-1.5 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/85 text-[#2D2226] shadow-sm backdrop-blur-xs transition-opacity hover:bg-white sm:right-2 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <div
              className={`absolute left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full bg-[#2D2226]/35 px-2 py-1 backdrop-blur-xs ${
                isAllOutOfStock ? "bottom-7 sm:bottom-8" : "bottom-2"
              }`}
            >
              {galleryImages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPhotoIndex(i);
                  }}
                  aria-label={`Ver foto ${i + 1}`}
                  className={`h-1.5 cursor-pointer rounded-full transition-all ${
                    i === safePhotoIndex
                      ? "w-3.5 bg-white"
                      : "w-1.5 bg-white/60 hover:bg-white/90"
                  }`}
                />
              ))}
            </div>
          </>
        )}

        {/* Badges superiores */}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1 sm:left-3 sm:top-3 sm:gap-1.5">
          {categoryName && (
            <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#2D2226] shadow-sm backdrop-blur-sm sm:px-3 sm:py-1 sm:text-[11px]">
              {categoryName}
            </span>
          )}
        </div>

        {wholesaleActive && (
          <div className="absolute right-2 top-2 sm:right-3 sm:top-3">
            <span className="rounded-full bg-[#D85C8A] px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm sm:px-2.5 sm:py-1 sm:text-[11px]">
              Mayor activo
            </span>
          </div>
        )}

        {isAllOutOfStock && (
          <div className="absolute inset-x-0 bottom-0 bg-[#2D2226]/70 py-1 text-center text-[11px] font-medium text-white backdrop-blur-xs sm:py-1.5 sm:text-xs">
            Agotado
          </div>
        )}
      </div>

      {/* Contenido limpio en la grilla */}
      <div className="flex flex-1 flex-col p-3 sm:p-5">
        {brandName && (
          <span className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#B94470] sm:text-[11px]">
            {brandName}
          </span>
        )}
        <h3 className="line-clamp-2 text-sm font-bold leading-snug tracking-tight text-[#2D2226] sm:text-lg">
          {product.name}
        </h3>

        {/* Precios detal y mayor */}
        <div className="mt-2.5 grid grid-cols-2 gap-1.5 rounded-xl bg-[#FFF1F5] p-1.5 sm:mt-3 sm:gap-2 sm:rounded-2xl sm:p-2.5">
          <div
            className={`rounded-lg px-2 py-1 transition-colors sm:rounded-xl sm:px-2.5 sm:py-1.5 ${
              !wholesaleActive ? "bg-white shadow-xs" : "opacity-65"
            }`}
          >
            <span className="block text-[9px] font-semibold uppercase tracking-wider text-[#2D2226]/55 sm:text-[10px]">
              Detal
            </span>
            <span
              className={`text-xs font-bold sm:text-sm ${
                wholesaleActive
                  ? "text-[#2D2226]/55 line-through"
                  : "text-[#2D2226]"
              }`}
            >
              {formatCOP(product.retail_price)}
            </span>
          </div>

          <div
            className={`rounded-lg px-2 py-1 transition-colors sm:rounded-xl sm:px-2.5 sm:py-1.5 ${
              wholesaleActive
                ? "bg-[#D85C8A] text-white shadow-xs"
                : "bg-[#FAD4E4]/55 text-[#B94470]"
            }`}
          >
            <span
              className={`block text-[9px] font-semibold uppercase tracking-wider sm:text-[10px] ${
                wholesaleActive ? "text-white/85" : "text-[#B94470]/80"
              }`}
            >
              Mayor
            </span>
            <span className="text-xs font-bold sm:text-sm">
              {formatCOP(product.wholesale_price)}
            </span>
          </div>
        </div>

        {/* Botón para abrir detalle del producto */}
        <div className="mt-auto pt-3 sm:pt-4">
          <span className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#FFF1F5] px-2.5 py-2 text-xs font-semibold text-[#B94470] ring-1 ring-[#FAD4E4] transition-colors group-hover:bg-[#D85C8A] group-hover:text-white group-hover:ring-[#D85C8A] sm:rounded-2xl sm:px-4 sm:py-2.5 sm:text-sm">
            <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Ver detalles</span>
          </span>
        </div>
      </div>
    </article>
  );
});
