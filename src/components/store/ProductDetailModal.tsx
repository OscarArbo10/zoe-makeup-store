"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";
import type { ProductVariant, ProductWithVariants } from "@/types/database";
import { formatCOP } from "@/lib/format";

interface ProductDetailModalProps {
  product: ProductWithVariants;
  categoryName?: string;
  brandName?: string;
  wholesaleActive: boolean;
  onClose: () => void;
  onAddToCart: (
    product: ProductWithVariants,
    variant: ProductVariant,
    quantity: number
  ) => void;
}

export function ProductDetailModal({
  product,
  categoryName,
  brandName,
  wholesaleActive,
  onClose,
  onAddToCart,
}: ProductDetailModalProps) {
  const activeVariants = useMemo(
    () => product.product_variants.filter((v) => v.is_active),
    [product.product_variants]
  );

  const defaultVariantId = useMemo(() => {
    const inStock = activeVariants.find((v) => v.stock > 0);
    return inStock?.id ?? activeVariants[0]?.id ?? null;
  }, [activeVariants]);

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    defaultVariantId
  );
  const [photoIndex, setPhotoIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const addedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (addedTimerRef.current) clearTimeout(addedTimerRef.current);
    };
  }, [onClose]);

  const selectedVariant = useMemo(
    () =>
      activeVariants.find((v) => v.id === selectedVariantId) ??
      activeVariants[0] ??
      null,
    [activeVariants, selectedVariantId]
  );

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
  }, [product.image_urls, product.image_url, selectedVariant]);

  const safePhotoIndex =
    galleryImages.length > 0 ? photoIndex % galleryImages.length : 0;
  const displayImageUrl = galleryImages[safePhotoIndex] ?? null;
  const hasMultiplePhotos = galleryImages.length > 1;
  const maxStock = selectedVariant?.stock ?? 0;
  const isOutOfStock = !selectedVariant || maxStock <= 0;
  const clampedQty = isOutOfStock ? 1 : Math.min(Math.max(1, quantity), maxStock);

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
    if (!selectedVariant || isOutOfStock) return;
    onAddToCart(product, selectedVariant, clampedQty);
    setJustAdded(true);
    if (addedTimerRef.current) clearTimeout(addedTimerRef.current);
    addedTimerRef.current = setTimeout(() => setJustAdded(false), 1400);
  };

  const showShades = product.has_shades !== false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#2D2226]/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Detalle de ${product.name}`}
    >
      {/* Overlay clicable */}
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Tarjeta modal */}
      <div className="animate-zoe-pop-in relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-[#FAD4E4] bg-white shadow-2xl sm:rounded-3xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar detalle del producto"
          className="absolute right-3 top-3 z-20 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/90 text-[#2D2226] shadow-md ring-1 ring-[#FAD4E4] backdrop-blur-xs transition-colors hover:bg-[#FFF1F5]"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid grid-cols-1 overflow-y-auto md:grid-cols-2">
          {/* Columna izquierda: galería de fotos */}
          <div className="bg-[#FFF1F5]/55 p-4 sm:p-5">
            <div
              className="relative aspect-square w-full overflow-hidden rounded-2xl border border-[#FAD4E4]/70 bg-[#FFF1F5]"
              onTouchStart={hasMultiplePhotos ? handleTouchStart : undefined}
              onTouchEnd={hasMultiplePhotos ? handleTouchEnd : undefined}
            >
              {displayImageUrl ? (
                <Image
                  src={displayImageUrl}
                  alt={`${product.name}${
                    showShades && selectedVariant
                      ? ` - ${selectedVariant.shade_name}`
                      : ""
                  }`}
                  fill
                  sizes="(max-width: 768px) 100vw, 384px"
                  className="object-cover"
                />
              ) : (
                <div className="relative flex h-full w-full flex-col items-center justify-center p-6 text-center">
                  <div
                    className="absolute h-28 w-28 rounded-full opacity-35 blur-2xl"
                    style={{
                      backgroundColor: selectedVariant?.shade_hex || "#D85C8A",
                    }}
                  />
                  <div
                    className="relative flex h-16 w-16 items-center justify-center rounded-full border-4 border-white shadow-md"
                    style={{
                      backgroundColor: selectedVariant?.shade_hex || "#FAD4E4",
                    }}
                  >
                    <Sparkles className="h-7 w-7 text-white drop-shadow-sm" />
                  </div>
                  <span className="relative mt-3 text-xs font-semibold text-[#B94470]">
                    ZOÉ COSMETICS
                  </span>
                </div>
              )}

              {hasMultiplePhotos && (
                <>
                  <button
                    type="button"
                    onClick={goPrevPhoto}
                    aria-label="Foto anterior"
                    className="absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/90 text-[#2D2226] shadow-sm hover:bg-white"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={goNextPhoto}
                    aria-label="Siguiente foto"
                    className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/90 text-[#2D2226] shadow-sm hover:bg-white"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>

            {/* Tira de miniaturas */}
            {hasMultiplePhotos && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {galleryImages.map((url, idx) => (
                  <button
                    key={`${url}-${idx}`}
                    type="button"
                    onClick={() => setPhotoIndex(idx)}
                    aria-label={`Ver imagen ${idx + 1}`}
                    className={`relative h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 transition-all ${
                      idx === safePhotoIndex
                        ? "border-[#D85C8A] ring-2 ring-[#D85C8A]/25"
                        : "border-[#FAD4E4] opacity-75 hover:opacity-100"
                    }`}
                  >
                    <Image
                      src={url}
                      alt={`${product.name} miniatura ${idx + 1}`}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Columna derecha: información, descripción, tonos (si aplica) y compra */}
          <div className="flex flex-col p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2 pr-8">
              {categoryName && (
                <span className="rounded-full bg-[#FFF1F5] px-3 py-1 text-[11px] font-semibold text-[#B94470] ring-1 ring-[#FAD4E4]">
                  {categoryName}
                </span>
              )}
              {brandName && (
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#B94470]">
                  {brandName}
                </span>
              )}
            </div>

            <h2 className="mt-2.5 text-xl font-extrabold leading-snug tracking-tight text-[#2D2226] sm:text-2xl">
              {product.name}
            </h2>

            {product.description ? (
              <p className="mt-2.5 whitespace-pre-line text-sm leading-relaxed text-[#2D2226]/75">
                {product.description}
              </p>
            ) : (
              <p className="mt-2.5 text-sm italic text-[#2D2226]/45">
                Producto original disponible al detal y al por mayor.
              </p>
            )}

            {/* Precios detal y mayor */}
            <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-2xl bg-[#FFF1F5] p-2.5">
              <div
                className={`rounded-xl px-3 py-2 transition-colors ${
                  !wholesaleActive ? "bg-white shadow-xs" : "opacity-65"
                }`}
              >
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#2D2226]/55">
                  Precio Detal
                </span>
                <span
                  className={`text-base font-bold ${
                    wholesaleActive
                      ? "text-[#2D2226]/55 line-through"
                      : "text-[#2D2226]"
                  }`}
                >
                  {formatCOP(product.retail_price)}
                </span>
              </div>

              <div
                className={`rounded-xl px-3 py-2 transition-colors ${
                  wholesaleActive
                    ? "bg-[#D85C8A] text-white shadow-xs"
                    : "bg-[#FAD4E4]/55 text-[#B94470]"
                }`}
              >
                <span
                  className={`block text-[10px] font-semibold uppercase tracking-wider ${
                    wholesaleActive ? "text-white/85" : "text-[#B94470]/80"
                  }`}
                >
                  Al por mayor
                </span>
                <span className="text-base font-bold">
                  {formatCOP(product.wholesale_price)}
                </span>
              </div>
            </div>

            {/* Tonos (solo si el producto funciona con tonos) */}
            {showShades ? (
              <div className="mt-5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#2D2226]/80">
                    Elige tu tono:{" "}
                    <strong className="text-[#2D2226]">
                      {selectedVariant ? selectedVariant.shade_name : "Sin tonos"}
                    </strong>
                  </span>
                  {selectedVariant && (
                    <span
                      className={`font-semibold ${
                        selectedVariant.stock > 0
                          ? "text-[#B94470]"
                          : "text-rose-500"
                      }`}
                    >
                      {selectedVariant.stock > 0
                        ? `${selectedVariant.stock} disponibles`
                        : "Agotado"}
                    </span>
                  )}
                </div>

                {activeVariants.length > 0 ? (
                  <div className="mt-2.5 flex flex-wrap gap-2">
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
                            setQuantity(1);
                          }}
                          title={
                            depleted
                              ? `${variant.shade_name} (Agotado)`
                              : `${variant.shade_name} (${variant.stock} disponibles)`
                          }
                          aria-label={`Tono ${variant.shade_name}${
                            depleted ? " agotado" : ""
                          }`}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D85C8A] focus-visible:ring-offset-1 ${
                            selected
                              ? "border-[#D85C8A] bg-[#D85C8A] text-white shadow-xs"
                              : "border-[#FAD4E4] bg-white text-[#2D2226] hover:border-[#D85C8A]/60 hover:bg-[#FFF1F5]"
                          } ${
                            depleted
                              ? "cursor-not-allowed line-through opacity-45"
                              : "cursor-pointer"
                          }`}
                        >
                          {variant.shade_name}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-[#2D2226]/55">
                    No hay tonos disponibles por el momento.
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-5 flex items-center justify-between rounded-2xl border border-[#FAD4E4]/80 bg-[#FFF1F5]/50 px-3.5 py-2.5 text-xs">
                <span className="font-semibold text-[#2D2226]/75">
                  Disponibilidad
                </span>
                <span
                  className={`font-bold ${
                    !isOutOfStock ? "text-emerald-700" : "text-rose-600"
                  }`}
                >
                  {!isOutOfStock
                    ? `Disponible (${maxStock} uds.)`
                    : "Agotado"}
                </span>
              </div>
            )}

            {/* Cantidad + Botón agregar */}
            <div className="mt-auto pt-6">
              <div className="flex items-center gap-3">
                {!isOutOfStock && (
                  <div className="flex items-center rounded-2xl border border-[#FAD4E4] bg-[#FFF1F5]/60 px-1 py-1">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={clampedQty <= 1}
                      aria-label="Disminuir cantidad"
                      className="cursor-pointer rounded-xl p-2 text-[#2D2226] hover:bg-white hover:text-[#D85C8A] disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-8 text-center text-sm font-bold text-[#2D2226]">
                      {clampedQty}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity((q) => Math.min(maxStock, q + 1))
                      }
                      disabled={clampedQty >= maxStock}
                      aria-label="Aumentar cantidad"
                      className="cursor-pointer rounded-xl p-2 text-[#2D2226] hover:bg-white hover:text-[#D85C8A] disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={isOutOfStock}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold transition-all ${
                    isOutOfStock
                      ? "cursor-not-allowed bg-[#FAD4E4]/40 text-[#2D2226]/40"
                      : justAdded
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "cursor-pointer bg-[#D85C8A] text-white shadow-md shadow-[#D85C8A]/25 hover:bg-[#B94470] active:scale-[0.99]"
                  }`}
                >
                  {justAdded ? (
                    <>
                      <Check className="h-4 w-4" />
                      ¡Agregado al carrito!
                    </>
                  ) : isOutOfStock ? (
                    "Agotado"
                  ) : (
                    <>
                      <ShoppingBag className="h-4 w-4" />
                      Agregar al carrito
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
