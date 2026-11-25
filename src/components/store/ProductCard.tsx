"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import type { ProductVariant, ProductWithVariants } from "@/types/database";
import { formatCOP } from "@/lib/format";

interface ProductCardProps {
  product: ProductWithVariants;
  categoryName?: string;
  brandName?: string;
  wholesaleActive: boolean;
  index: number;
  onAddToCart: (product: ProductWithVariants, variant: ProductVariant) => void;
}

export const ProductCard = memo(function ProductCard({
  product,
  categoryName,
  brandName,
  wholesaleActive,
  index,
  onAddToCart,
}: ProductCardProps) {
  const activeVariants = useMemo(
    () => product.product_variants.filter((v) => v.is_active),
    [product.product_variants]
  );

  // Selecciona por defecto el primer tono con stock > 0, o el primer tono activo si todos están agotados
  const defaultVariantId = useMemo(() => {
    const inStock = activeVariants.find((v) => v.stock > 0);
    return inStock?.id ?? activeVariants[0]?.id ?? null;
  }, [activeVariants]);

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    defaultVariantId
  );
  const [photoIndex, setPhotoIndex] = useState(0);
  const [justAdded, setJustAdded] = useState(false);
  const justAddedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (justAddedTimerRef.current) {
        clearTimeout(justAddedTimerRef.current);
      }
    };
  }, []);

  const selectedVariant = useMemo(
    () =>
      activeVariants.find((v) => v.id === selectedVariantId) ??
      activeVariants[0] ??
      null,
    [activeVariants, selectedVariantId]
  );

  // Galería: si el tono seleccionado tiene foto propia, va primero, seguida por las fotos del producto
  const galleryImages = useMemo(() => {
    const list: string[] = [];
    if (selectedVariant?.image_url) {
      list.push(selectedVariant.image_url);
    }
    const prodImgs =
      product.image_urls && product.image_urls.length > 0
        ? product.image_urls
        : product.image_url
        ? [product.image_url]
        : [];
    for (const url of prodImgs) {
      if (url && !list.includes(url)) {
        list.push(url);
      }
    }
    return list;
  }, [product.image_urls, product.image_url, selectedVariant?.image_url]);

  const safePhotoIndex =
    galleryImages.length > 0 ? photoIndex % galleryImages.length : 0;
  const displayImageUrl = galleryImages[safePhotoIndex] ?? null;
  const hasMultiplePhotos = galleryImages.length > 1;
  const isOutOfStock = !selectedVariant || selectedVariant.stock <= 0;

  const goPrevPhoto = () => {
    if (galleryImages.length <= 1) return;
    setPhotoIndex(
      (prev) => (prev - 1 + galleryImages.length) % galleryImages.length
    );
  };

  const goNextPhoto = () => {
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
      if (delta <= -32) goNextPhoto();
      else if (delta >= 32) goPrevPhoto();
    }
    touchStartXRef.current = null;
  };

  const handleAdd = () => {
    if (!selectedVariant || selectedVariant.stock <= 0) return;
    onAddToCart(product, selectedVariant);
    setJustAdded(true);
    if (justAddedTimerRef.current) clearTimeout(justAddedTimerRef.current);
    justAddedTimerRef.current = setTimeout(() => setJustAdded(false), 1200);
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-[#FAD4E4]/70 bg-white shadow-[0_8px_30px_rgb(216,92,138,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#FAD4E4] hover:shadow-[0_14px_34px_rgb(216,92,138,0.12)] sm:rounded-3xl">
      {/* Imagen / carrusel de fotos del producto */}
      <div
        className="relative aspect-square w-full overflow-hidden bg-[#FFF1F5]"
        onTouchStart={hasMultiplePhotos ? handleTouchStart : undefined}
        onTouchEnd={hasMultiplePhotos ? handleTouchEnd : undefined}
      >
        {displayImageUrl ? (
          <Image
            src={displayImageUrl}
            alt={`${product.name}${selectedVariant ? ` - ${selectedVariant.shade_name}` : ""}`}
            fill
            sizes="(max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
            loading={index < 4 ? "eager" : "lazy"}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="relative flex h-full w-full flex-col items-center justify-center p-4 text-center sm:p-6">
            <div
              className="absolute h-20 w-20 rounded-full opacity-35 blur-2xl sm:h-24 sm:w-24"
              style={{
                backgroundColor: selectedVariant?.shade_hex || "#D85C8A",
              }}
            />
            <div
              className="relative flex h-12 w-12 items-center justify-center rounded-full border-4 border-white shadow-md sm:h-16 sm:w-16"
              style={{
                backgroundColor: selectedVariant?.shade_hex || "#FAD4E4",
              }}
            >
              <Sparkles className="h-5 w-5 text-white drop-shadow-sm sm:h-6 sm:w-6" />
            </div>
            <span className="relative mt-2 text-[11px] font-medium tracking-wide text-[#B94470]/80 sm:mt-3 sm:text-xs">
              {selectedVariant?.shade_name || "ZOÉ COSMETICS"}
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
                isOutOfStock ? "bottom-7 sm:bottom-8" : "bottom-2"
              }`}
            >
              {galleryImages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPhotoIndex(i)}
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

        {isOutOfStock && (
          <div className="absolute inset-x-0 bottom-0 bg-[#2D2226]/70 py-1 text-center text-[11px] font-medium text-white backdrop-blur-xs sm:py-1.5 sm:text-xs">
            Tono agotado
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="flex flex-1 flex-col p-3 sm:p-5">
        {brandName && (
          <span className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#B94470] sm:text-[11px]">
            {brandName}
          </span>
        )}
        <h3 className="line-clamp-2 font-[family-name:var(--font-playfair)] text-sm font-semibold leading-snug text-[#2D2226] sm:text-lg">
          {product.name}
        </h3>

        {product.description && (
          <p className="mt-1 hidden line-clamp-2 text-xs leading-relaxed text-[#2D2226]/65 sm:block">
            {product.description}
          </p>
        )}

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

        {/* Selector visual de tonos */}
        <div className="mt-3 flex-1 sm:mt-4">
          <div className="flex items-center justify-between gap-1 text-[11px] sm:text-xs">
            <span className="truncate font-medium text-[#2D2226]/70">
              <span className="hidden sm:inline">Tono: </span>
              <strong className="font-semibold text-[#2D2226]">
                {selectedVariant ? selectedVariant.shade_name : "Sin tonos"}
              </strong>
            </span>
            {selectedVariant && (
              <span
                className={`shrink-0 text-[10px] font-medium sm:text-[11px] ${
                  selectedVariant.stock > 0
                    ? "text-[#B94470]"
                    : "text-rose-500"
                }`}
              >
                {selectedVariant.stock > 0
                  ? `${selectedVariant.stock} disp.`
                  : "Agotado"}
              </span>
            )}
          </div>

          {activeVariants.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-2.5 sm:gap-2">
              {activeVariants.map((variant) => {
                const selected = selectedVariant?.id === variant.id;
                const depleted = variant.stock <= 0;

                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => {
                      setSelectedVariantId(variant.id);
                      setPhotoIndex(0);
                    }}
                    title={
                      depleted
                        ? `${variant.shade_name} (Agotado)`
                        : `${variant.shade_name} (${variant.stock} disponibles)`
                    }
                    aria-label={`Tono ${variant.shade_name}${
                      depleted ? " agotado" : ""
                    }`}
                    className={`relative h-6 w-6 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D85C8A] focus-visible:ring-offset-1 sm:h-8 sm:w-8 sm:focus-visible:ring-offset-2 ${
                      selected
                        ? "scale-110 ring-2 ring-[#D85C8A] ring-offset-1 sm:ring-offset-2"
                        : "ring-1 ring-[#2D2226]/15 hover:scale-105"
                    } ${depleted ? "cursor-not-allowed opacity-45" : "cursor-pointer"}`}
                    style={{ backgroundColor: variant.shade_hex || "#F48FB1" }}
                  >
                    {depleted && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 flex items-center justify-center"
                      >
                        <span className="h-[2px] w-5 rotate-45 rounded-full bg-[#2D2226]/80 sm:w-7" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-[#2D2226]/50 sm:text-xs">
              Sin tonos disponibles.
            </p>
          )}
        </div>

        {/* CTA agregar al carrito */}
        <button
          type="button"
          onClick={handleAdd}
          disabled={isOutOfStock}
          className={`mt-3.5 flex w-full items-center justify-center gap-1.5 rounded-xl px-2.5 py-2.5 text-xs font-semibold transition-all sm:mt-5 sm:gap-2 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm ${
            isOutOfStock
              ? "cursor-not-allowed bg-[#FAD4E4]/40 text-[#2D2226]/40"
              : justAdded
              ? "bg-emerald-600 text-white shadow-sm"
              : "cursor-pointer bg-[#D85C8A] text-white shadow-sm hover:bg-[#B94470] active:scale-[0.99]"
          }`}
        >
          {justAdded ? (
            <>
              <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Agregado</span>
            </>
          ) : isOutOfStock ? (
            "Agotado"
          ) : (
            <>
              <ShoppingBag className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="sm:hidden">Agregar</span>
              <span className="hidden sm:inline">Agregar al carrito</span>
            </>
          )}
        </button>
      </div>
    </article>
  );
});
