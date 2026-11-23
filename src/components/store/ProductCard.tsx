"use client";

import { useMemo, useState } from "react";
import { Check, ShoppingBag, Sparkles } from "lucide-react";
import type { ProductVariant, ProductWithVariants } from "@/types/database";
import { formatCOP } from "@/lib/format";

interface ProductCardProps {
  product: ProductWithVariants;
  categoryName?: string;
  wholesaleActive: boolean;
  onAddToCart: (product: ProductWithVariants, variant: ProductVariant) => void;
}

export function ProductCard({
  product,
  categoryName,
  wholesaleActive,
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
  const [justAdded, setJustAdded] = useState(false);

  const selectedVariant = useMemo(
    () =>
      activeVariants.find((v) => v.id === selectedVariantId) ??
      activeVariants[0] ??
      null,
    [activeVariants, selectedVariantId]
  );

  // Si el tono seleccionado tiene imagen propia, se muestra esa; si no, la imagen principal del producto
  const displayImageUrl = selectedVariant?.image_url || product.image_url;
  const isOutOfStock = !selectedVariant || selectedVariant.stock <= 0;

  const handleAdd = () => {
    if (!selectedVariant || selectedVariant.stock <= 0) return;
    onAddToCart(product, selectedVariant);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-[#FAD4E4]/70 bg-white shadow-[0_8px_30px_rgb(216,92,138,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#FAD4E4] hover:shadow-[0_14px_34px_rgb(216,92,138,0.12)]">
      {/* Imagen del producto / tono */}
      <div className="relative aspect-[4/4] w-full overflow-hidden bg-[#FFF1F5]">
        {displayImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayImageUrl}
            alt={`${product.name}${selectedVariant ? ` - ${selectedVariant.shade_name}` : ""}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center relative">
            <div
              className="h-24 w-24 rounded-full opacity-35 blur-2xl absolute"
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
              <Sparkles className="h-6 w-6 text-white drop-shadow-sm" />
            </div>
            <span className="relative mt-3 text-xs font-medium tracking-wide text-[#B94470]/80">
              {selectedVariant?.shade_name || "Zoe Beauty"}
            </span>
          </div>
        )}

        {/* Badges superiores */}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {categoryName && (
            <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold tracking-wide text-[#2D2226] backdrop-blur-sm shadow-sm">
              {categoryName}
            </span>
          )}
        </div>

        {wholesaleActive && (
          <div className="absolute right-3 top-3">
            <span className="rounded-full bg-[#D85C8A] px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
              Mayor activo
            </span>
          </div>
        )}

        {isOutOfStock && (
          <div className="absolute inset-x-0 bottom-0 bg-[#2D2226]/70 py-1.5 text-center text-xs font-medium text-white backdrop-blur-xs">
            Tono agotado
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="font-[family-name:var(--font-playfair)] text-lg font-semibold leading-snug text-[#2D2226]">
          {product.name}
        </h3>

        {product.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#2D2226]/65">
            {product.description}
          </p>
        )}

        {/* Precios detal y mayor */}
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-[#FFF1F5] p-2.5">
          <div
            className={`rounded-xl px-2.5 py-1.5 transition-colors ${
              !wholesaleActive ? "bg-white shadow-xs" : "opacity-65"
            }`}
          >
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#2D2226]/55">
              Detal
            </span>
            <span
              className={`text-sm font-bold ${
                wholesaleActive
                  ? "text-[#2D2226]/55 line-through"
                  : "text-[#2D2226]"
              }`}
            >
              {formatCOP(product.retail_price)}
            </span>
          </div>

          <div
            className={`rounded-xl px-2.5 py-1.5 transition-colors ${
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
            <span className="text-sm font-bold">
              {formatCOP(product.wholesale_price)}
            </span>
          </div>
        </div>

        {/* Selector visual de tonos */}
        <div className="mt-4 flex-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-[#2D2226]/70">
              Tono:{" "}
              <strong className="font-semibold text-[#2D2226]">
                {selectedVariant ? selectedVariant.shade_name : "Sin tonos"}
              </strong>
            </span>
            {selectedVariant && (
              <span
                className={`text-[11px] font-medium ${
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
            <div className="mt-2.5 flex flex-wrap gap-2">
              {activeVariants.map((variant) => {
                const selected = selectedVariant?.id === variant.id;
                const depleted = variant.stock <= 0;

                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => setSelectedVariantId(variant.id)}
                    title={
                      depleted
                        ? `${variant.shade_name} (Agotado)`
                        : `${variant.shade_name} (${variant.stock} disponibles)`
                    }
                    aria-label={`Tono ${variant.shade_name}${
                      depleted ? " agotado" : ""
                    }`}
                    className={`relative h-8 w-8 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D85C8A] focus-visible:ring-offset-2 ${
                      selected
                        ? "scale-110 ring-2 ring-[#D85C8A] ring-offset-2"
                        : "ring-1 ring-[#2D2226]/15 hover:scale-105"
                    } ${depleted ? "opacity-45 cursor-not-allowed" : "cursor-pointer"}`}
                    style={{ backgroundColor: variant.shade_hex || "#F48FB1" }}
                  >
                    {depleted && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 flex items-center justify-center"
                      >
                        <span className="h-[2px] w-7 rotate-45 rounded-full bg-[#2D2226]/80" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 text-xs text-[#2D2226]/50">
              No hay tonos disponibles por el momento.
            </p>
          )}
        </div>

        {/* CTA agregar al carrito */}
        <button
          type="button"
          onClick={handleAdd}
          disabled={isOutOfStock}
          className={`mt-5 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-all ${
            isOutOfStock
              ? "cursor-not-allowed bg-[#FAD4E4]/40 text-[#2D2226]/40"
              : justAdded
              ? "bg-emerald-600 text-white shadow-sm"
              : "cursor-pointer bg-[#D85C8A] text-white shadow-sm hover:bg-[#B94470] active:scale-[0.99]"
          }`}
        >
          {justAdded ? (
            <>
              <Check className="h-4 w-4" />
              Agregado al carrito
            </>
          ) : isOutOfStock ? (
            "Tono agotado"
          ) : (
            <>
              <ShoppingBag className="h-4 w-4" />
              Agregar al carrito
            </>
          )}
        </button>
      </div>
    </article>
  );
}
