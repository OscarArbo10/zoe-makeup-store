"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Search,
  ShoppingBag,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import type {
  CartItem,
  Category,
  ProductVariant,
  ProductWithVariants,
  StoreSettings,
} from "@/types/database";
import { formatCOP } from "@/lib/format";
import { ProductCard } from "./ProductCard";
import { CartDrawer } from "./CartDrawer";
import { DynamicHeroDecor } from "./DynamicHeroDecor";

const CART_STORAGE_KEY = "zoe_makeup_cart_v1";
const CART_CHANGE_EVENT = "zoe-cart-change";
const EMPTY_CART: CartItem[] = [];

let cachedRawCart: string | null = null;
let cachedParsedCart: CartItem[] = EMPTY_CART;

function subscribeToCart(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CART_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CART_CHANGE_EVENT, callback);
  };
}

function getCartSnapshot(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (raw === cachedRawCart) return cachedParsedCart;
    cachedRawCart = raw;
    if (!raw) {
      cachedParsedCart = EMPTY_CART;
      return cachedParsedCart;
    }
    const parsed = JSON.parse(raw) as CartItem[];
    cachedParsedCart = Array.isArray(parsed) ? parsed : EMPTY_CART;
    return cachedParsedCart;
  } catch {
    return EMPTY_CART;
  }
}

function getServerCartSnapshot(): CartItem[] {
  return EMPTY_CART;
}

function writeCartStorage(nextItems: CartItem[]) {
  try {
    const raw = JSON.stringify(nextItems);
    localStorage.setItem(CART_STORAGE_KEY, raw);
    cachedRawCart = raw;
    cachedParsedCart = nextItems;
    window.dispatchEvent(new Event(CART_CHANGE_EVENT));
  } catch {
    // Ignora cuotas de almacenamiento
  }
}

interface StorefrontClientProps {
  settings: StoreSettings;
  categories: Category[];
  products: ProductWithVariants[];
}

export function StorefrontClient({
  settings,
  categories,
  products,
}: StorefrontClientProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState<{
    productName: string;
    shadeName: string;
    shadeHex: string;
  } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cartItems = useSyncExternalStore(
    subscribeToCart,
    getCartSnapshot,
    getServerCartSnapshot
  );

  const updateCart = (updater: (prev: CartItem[]) => CartItem[]) => {
    const next = updater(getCartSnapshot());
    writeCartStorage(next);
  };

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      map.set(c.id, c.name);
    }
    return map;
  }, [categories]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory =
        selectedCategoryId === "all" ||
        product.category_id === selectedCategoryId;
      const matchesSearch =
        !q ||
        product.name.toLowerCase().includes(q) ||
        (product.description?.toLowerCase().includes(q) ?? false) ||
        product.product_variants.some((v) =>
          v.shade_name.toLowerCase().includes(q)
        );
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategoryId, searchQuery]);

  const retailSubtotal = useMemo(
    () =>
      cartItems.reduce((sum, item) => sum + item.retailPrice * item.quantity, 0),
    [cartItems]
  );

  const wholesaleSubtotal = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) => sum + item.wholesalePrice * item.quantity,
        0
      ),
    [cartItems]
  );

  const wholesaleThreshold = settings.wholesale_threshold ?? 100000;
  const wholesaleActive =
    cartItems.length > 0 && wholesaleSubtotal >= wholesaleThreshold;
  const totalItemsCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);
  const activeTotal = wholesaleActive ? wholesaleSubtotal : retailSubtotal;

  const handleAddToCart = (
    product: ProductWithVariants,
    variant: ProductVariant
  ) => {
    const key = `${product.id}:${variant.id}`;
    updateCart((prev) => {
      const existing = prev.find((item) => item.key === key);
      if (existing) {
        const nextQty = Math.min(variant.stock, existing.quantity + 1);
        return prev.map((item) =>
          item.key === key
            ? { ...item, quantity: nextQty, maxStock: variant.stock }
            : item
        );
      }

      return [
        ...prev,
        {
          key,
          productId: product.id,
          variantId: variant.id,
          productName: product.name,
          shadeName: variant.shade_name,
          shadeHex: variant.shade_hex || "#F48FB1",
          imageUrl: variant.image_url || product.image_url,
          retailPrice: product.retail_price,
          wholesalePrice: product.wholesale_price,
          maxStock: variant.stock,
          quantity: 1,
        },
      ];
    });

    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({
      productName: product.name,
      shadeName: variant.shade_name,
      shadeHex: variant.shade_hex || "#F48FB1",
    });
    toastTimerRef.current = setTimeout(() => setToast(null), 2800);
  };

  const handleUpdateQuantity = (key: string, delta: number) => {
    updateCart((prev) =>
      prev
        .map((item) => {
          if (item.key !== key) return item;
          const nextQty = Math.min(item.maxStock, item.quantity + delta);
          return { ...item, quantity: nextQty };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveItem = (key: string) => {
    updateCart((prev) => prev.filter((item) => item.key !== key));
  };

  const handleClearCart = () => {
    updateCart(() => []);
  };

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#2D2226]">
      {/* Barra superior de beneficio mayorista con brillo sutil */}
      <div className="animate-zoe-shimmer bg-gradient-to-r from-[#D85C8A] via-[#E879A5] to-[#D85C8A] px-4 py-2 text-center text-xs font-medium text-white sm:text-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2">
          <Sparkles className="h-3.5 w-3.5 shrink-0 animate-pulse" />
          <span>
            Activa <strong>precios al por mayor</strong> automáticamente al
            alcanzar <strong>{formatCOP(wholesaleThreshold)}</strong> en precio
            al por mayor
          </span>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#FAD4E4]/80 bg-white/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="group flex items-center gap-3">
            <div className="relative h-11 w-11 overflow-hidden rounded-2xl border-2 border-[#FAD4E4] bg-[#FFA6DA] shadow-sm transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/zoe-logo.jpg"
                alt={`Logo ${settings.store_name || "ZOÉ COSMETICS"}`}
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <span className="block font-[family-name:var(--font-playfair)] text-xl font-bold leading-none tracking-tight text-[#2D2226] sm:text-2xl">
                {settings.store_name || "ZOÉ COSMETICS"}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#B94470]">
                Maquillaje & Belleza
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="relative flex cursor-pointer items-center gap-2.5 rounded-2xl bg-[#FFF1F5] px-4 py-2.5 text-sm font-semibold text-[#2D2226] ring-1 ring-[#FAD4E4] transition-all hover:-translate-y-0.5 hover:bg-[#FAD4E4]/50 hover:shadow-sm"
            >
              <ShoppingBag className="h-4 w-4 text-[#D85C8A]" />
              <span className="hidden sm:inline">Carrito</span>
              {totalItemsCount > 0 && (
                <>
                  <span className="hidden text-xs font-bold text-[#D85C8A] md:inline">
                    · {formatCOP(activeTotal)}
                  </span>
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#D85C8A] px-1.5 text-[11px] font-bold text-white">
                    {totalItemsCount}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero femenino pastel con logo destacado y objetos dinámicos */}
      <section className="relative overflow-hidden border-b border-[#FAD4E4]/60 bg-gradient-to-b from-[#FFF1F5] via-[#FFF8FA] to-white">
        <DynamicHeroDecor />

        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            {/* Medallón animado del logo Zoe */}
            <div className="relative mx-auto mb-6 flex w-fit items-center justify-center">
              <div className="animate-zoe-orbit-pulse absolute -inset-3 rounded-[2.2rem] bg-gradient-to-tr from-[#FAD4E4] via-[#FFAED4]/50 to-[#FFF1F5] blur-xl" />
              <div className="animate-zoe-float relative h-28 w-28 overflow-hidden rounded-[2rem] border-4 border-white bg-[#FFA6DA] shadow-[0_16px_40px_rgba(216,92,138,0.25)] sm:h-32 sm:w-32">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/zoe-logo.jpg"
                  alt={`Logo ${settings.store_name || "Zoe"}`}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FAD4E4] bg-white/90 px-3.5 py-1 text-xs font-semibold text-[#B94470] shadow-xs backdrop-blur-xs">
              <Tag className="h-3.5 w-3.5" />
              Detal y Mayorista en un solo carrito
            </span>

            <h1 className="mt-4 font-[family-name:var(--font-playfair)] text-4xl font-bold tracking-tight text-[#2D2226] sm:text-5xl">
              Maquillaje pensado para{" "}
              <span className="text-[#D85C8A]">resaltar tu brillo</span>
            </h1>

            <p className="mt-4 text-sm leading-relaxed text-[#2D2226]/70 sm:text-base">
              Elige tus productos y tonos favoritos. Si tu carrito alcanza{" "}
              <strong className="font-semibold text-[#2D2226]">
                {formatCOP(wholesaleThreshold)}
              </strong>{" "}
              en precio al por mayor, todo tu pedido cambia automáticamente a{" "}
              <strong className="font-semibold text-[#D85C8A]">
                tarifa mayorista
              </strong>
              .
            </p>
          </div>
        </div>
      </section>

      {/* Catálogo: buscador + filtros de categorías + grilla */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {/* Controles de búsqueda y categorías */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* Categorías */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategoryId("all")}
              className={`cursor-pointer rounded-full px-4 py-2 text-xs font-semibold transition-all sm:text-sm ${
                selectedCategoryId === "all"
                  ? "bg-[#D85C8A] text-white shadow-sm"
                  : "bg-[#FFF1F5] text-[#2D2226] hover:bg-[#FAD4E4]/70"
              }`}
            >
              Todos
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategoryId(category.id)}
                className={`cursor-pointer rounded-full px-4 py-2 text-xs font-semibold transition-all sm:text-sm ${
                  selectedCategoryId === category.id
                    ? "bg-[#D85C8A] text-white shadow-sm"
                    : "bg-[#FFF1F5] text-[#2D2226] hover:bg-[#FAD4E4]/70"
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          {/* Buscador */}
          <div className="relative w-full md:w-72">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#D85C8A]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar producto o tono..."
              className="w-full rounded-2xl border border-[#FAD4E4] bg-[#FFF1F5]/40 py-2.5 pl-10 pr-9 text-sm text-[#2D2226] placeholder:text-[#2D2226]/45 focus:border-[#D85C8A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D85C8A]/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Limpiar búsqueda"
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-[#2D2226]/45 hover:text-[#2D2226]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Estado del carrito en móvil si tiene ítems */}
        {totalItemsCount > 0 && (
          <div className="mt-5 flex items-center justify-between rounded-2xl border border-[#FAD4E4] bg-[#FFF1F5] px-4 py-3 text-xs sm:text-sm">
            <div>
              {wholesaleActive ? (
                <span className="font-semibold text-[#D85C8A]">
                  ¡Precio al por mayor activado en tu carrito!
                </span>
              ) : (
                <span className="text-[#2D2226]/80">
                  Te faltan{" "}
                  <strong className="text-[#D85C8A]">
                    {formatCOP(
                      Math.max(0, wholesaleThreshold - wholesaleSubtotal)
                    )}
                  </strong>{" "}
                  en precio mayorista para activar tarifa al por mayor.
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="ml-3 shrink-0 cursor-pointer rounded-xl bg-[#D85C8A] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#B94470]"
            >
              Ver carrito ({totalItemsCount})
            </button>
          </div>
        )}

        {/* Grilla de productos */}
        {filteredProducts.length > 0 ? (
          <div className="mt-7 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                categoryName={
                  product.category_id
                    ? categoryMap.get(product.category_id)
                    : undefined
                }
                wholesaleActive={wholesaleActive}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        ) : (
          <div className="mt-12 rounded-3xl border border-dashed border-[#FAD4E4] bg-[#FFF1F5]/40 px-6 py-16 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-[#D85C8A]/70" />
            <h3 className="mt-3 font-[family-name:var(--font-playfair)] text-xl font-semibold text-[#2D2226]">
              No encontramos productos
            </h3>
            <p className="mt-1 text-sm text-[#2D2226]/65">
              Prueba con otro nombre o selecciona otra categoría.
            </p>
            {(searchQuery || selectedCategoryId !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategoryId("all");
                }}
                className="mt-4 cursor-pointer rounded-xl bg-[#D85C8A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B94470]"
              >
                Ver todo el catálogo
              </button>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-[#FAD4E4]/70 bg-[#FFF1F5]/50">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-[#2D2226]/65 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/zoe-logo.jpg"
              alt="Zoe"
              className="h-7 w-7 rounded-lg border border-[#FAD4E4] object-cover"
            />
            <p>
              © {new Date().getFullYear()}{" "}
              <strong className="font-semibold text-[#2D2226]">
                {settings.store_name || "ZOÉ COSMETICS"}
              </strong>
              . Todos los derechos reservados.
            </p>
          </div>
          <Link
            href="/admin"
            className="font-medium text-[#B94470]/80 transition-colors hover:text-[#D85C8A]"
          >
            Panel de administración
          </Link>
        </div>
      </footer>

      {/* Toast dinámico al agregar un tono al carrito */}
      {toast && !cartOpen && (
        <div className="animate-zoe-pop-in fixed bottom-20 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-[#FAD4E4] bg-white/95 px-4 py-3 shadow-[0_12px_36px_rgba(216,92,138,0.22)] backdrop-blur-md sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white shadow-xs"
              style={{ backgroundColor: toast.shadeHex }}
            >
              <CheckCircle2 className="h-4 w-4 text-white drop-shadow-xs" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-[#2D2226]">
                {toast.productName}
              </p>
              <p className="truncate text-[11px] text-[#B94470]">
                Tono: {toast.shadeName} agregado
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setToast(null);
              setCartOpen(true);
            }}
            className="shrink-0 cursor-pointer rounded-xl bg-[#D85C8A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#B94470]"
          >
            Ver
          </button>
        </div>
      )}

      {/* Botón flotante móvil del carrito */}
      {totalItemsCount > 0 && !cartOpen && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex cursor-pointer items-center gap-2.5 rounded-full bg-[#D85C8A] px-5 py-3.5 text-sm font-semibold text-white shadow-xl shadow-[#D85C8A]/35 transition-transform hover:scale-105 hover:bg-[#B94470] sm:hidden"
        >
          <ShoppingBag className="h-4 w-4" />
          <span>{formatCOP(activeTotal)}</span>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-[#D85C8A]">
            {totalItemsCount}
          </span>
        </button>
      )}

      {/* Drawer del carrito */}
      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cartItems}
        settings={settings}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
      />
    </div>
  );
}
