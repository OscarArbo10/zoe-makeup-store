"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle2,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Menu,
  MessageCircle,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  Truck,
  X,
} from "lucide-react";
import type {
  Brand,
  CartItem,
  Category,
  ProductVariant,
  ProductWithVariants,
  StoreSettings,
} from "@/types/database";
import { formatCOP } from "@/lib/format";
import { ProductCard } from "./ProductCard";
import { DynamicHeroDecor } from "./DynamicHeroDecor";

const CartDrawer = dynamic(
  () => import("./CartDrawer").then((mod) => mod.CartDrawer),
  { ssr: false }
);

const ProductDetailModal = dynamic(
  () => import("./ProductDetailModal").then((mod) => mod.ProductDetailModal),
  { ssr: false }
);

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

const PRODUCTS_PER_PAGE = 20;

function normalizeSocialUrl(
  raw: string | null | undefined,
  platform: "instagram" | "tiktok"
): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const handle = trimmed.replace(/^@+/, "");
  if (!handle) return null;
  return platform === "instagram"
    ? `https://www.instagram.com/${handle}`
    : `https://www.tiktok.com/@${handle}`;
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
  brands: Brand[];
  products: ProductWithVariants[];
}

export function StorefrontClient({
  settings,
  categories,
  brands,
  products,
}: StorefrontClientProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuBrandId, setMenuBrandId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [selectedBrandId, setSelectedBrandId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] =
    useState<ProductWithVariants | null>(null);
  const [toast, setToast] = useState<{
    productName: string;
    shadeName: string;
    shadeHex: string;
  } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const cartItems = useSyncExternalStore(
    subscribeToCart,
    getCartSnapshot,
    getServerCartSnapshot
  );

  const updateCart = useCallback((updater: (prev: CartItem[]) => CartItem[]) => {
    const next = updater(getCartSnapshot());
    writeCartStorage(next);
  }, []);

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      map.set(c.id, c.name);
    }
    return map;
  }, [categories]);

  const brandMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of brands) {
      map.set(b.id, b.name);
    }
    return map;
  }, [brands]);

  const productCounts = useMemo(() => {
    const byCategory = new Map<string, number>();
    const byBrand = new Map<string, number>();
    for (const p of products) {
      if (p.category_id) {
        byCategory.set(p.category_id, (byCategory.get(p.category_id) ?? 0) + 1);
      }
      if (p.brand_id) {
        byBrand.set(p.brand_id, (byBrand.get(p.brand_id) ?? 0) + 1);
      }
    }
    return { byCategory, byBrand };
  }, [products]);

  // Categorías (tipos de producto) que tiene cada marca, con conteo
  const brandCategoryCounts = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const p of products) {
      if (!p.brand_id || !p.category_id) continue;
      const inner = map.get(p.brand_id) ?? new Map<string, number>();
      inner.set(p.category_id, (inner.get(p.category_id) ?? 0) + 1);
      map.set(p.brand_id, inner);
    }
    return map;
  }, [products]);

  const menuBrand = menuBrandId
    ? brands.find((b) => b.id === menuBrandId) ?? null
    : null;
  const menuBrandCategories = menuBrandId
    ? categories.filter((c) => brandCategoryCounts.get(menuBrandId)?.has(c.id))
    : [];

  const featuredProduct = settings.featured_product_id
    ? products.find((p) => p.id === settings.featured_product_id) ?? null
    : null;
  const promoTitle = settings.promo_title?.trim() ?? "";
  const promoText = settings.promo_text?.trim() ?? "";
  const hasPromo = Boolean(featuredProduct || promoTitle || promoText);
  const featuredImage =
    featuredProduct?.image_urls?.[0] || featuredProduct?.image_url || null;
  const featuredBrandName = featuredProduct?.brand_id
    ? brandMap.get(featuredProduct.brand_id)
    : undefined;

  const filteredProducts = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory =
        selectedCategoryId === "all" ||
        product.category_id === selectedCategoryId;
      const matchesBrand =
        selectedBrandId === "all" || product.brand_id === selectedBrandId;

      const brandName = product.brand_id
        ? brandMap.get(product.brand_id)?.toLowerCase() ?? ""
        : "";
      const categoryName = product.category_id
        ? categoryMap.get(product.category_id)?.toLowerCase() ?? ""
        : "";

      const matchesSearch =
        !q ||
        product.name.toLowerCase().includes(q) ||
        brandName.includes(q) ||
        categoryName.includes(q) ||
        (product.description?.toLowerCase().includes(q) ?? false) ||
        product.product_variants.some((v) =>
          v.shade_name.toLowerCase().includes(q)
        );
      return matchesCategory && matchesBrand && matchesSearch;
    });
  }, [
    products,
    selectedCategoryId,
    selectedBrandId,
    deferredSearchQuery,
    brandMap,
    categoryMap,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE)
  );
  const safePage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safePage - 1) * PRODUCTS_PER_PAGE;
  const paginatedProducts = filteredProducts.slice(
    pageStartIndex,
    pageStartIndex + PRODUCTS_PER_PAGE
  );

  const goToPage = (page: number) => {
    const clamped = Math.max(1, Math.min(totalPages, page));
    setCurrentPage(clamped);
    document
      .getElementById("catalogo")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const instagramHref = normalizeSocialUrl(
    settings.instagram_url,
    "instagram"
  );
  const tiktokHref = normalizeSocialUrl(settings.tiktok_url, "tiktok");

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

  const handleAddToCart = useCallback(
    (
      product: ProductWithVariants,
      variant: ProductVariant,
      quantity = 1
    ) => {
      const addQty = Math.max(1, Math.min(variant.stock, Math.floor(quantity)));
      const key = `${product.id}:${variant.id}`;
      updateCart((prev) => {
        const existing = prev.find((item) => item.key === key);
        if (existing) {
          const nextQty = Math.min(variant.stock, existing.quantity + addQty);
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
            imageUrl:
              variant.image_url ||
              product.image_urls?.[0] ||
              product.image_url,
            retailPrice: product.retail_price,
            wholesalePrice: product.wholesale_price,
            maxStock: variant.stock,
            quantity: addQty,
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
    },
    [updateCart]
  );

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

  const scrollToCatalog = () => {
    document
      .getElementById("catalogo")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSelectAll = () => {
    setSelectedCategoryId("all");
    setSelectedBrandId("all");
    setCurrentPage(1);
    setMenuOpen(false);
    scrollToCatalog();
  };

  const handleSelectBrandCategory = (brandId: string, categoryId: string) => {
    setSelectedBrandId(brandId);
    setSelectedCategoryId(categoryId);
    setCurrentPage(1);
    setMenuOpen(false);
    setMenuBrandId(null);
    scrollToCatalog();
  };

  const handleViewFeatured = () => {
    if (!featuredProduct) return;
    setSelectedProduct(featuredProduct);
  };

  const handleSelectBrand = (brandId: string) => {
    setSelectedBrandId(brandId);
    setSelectedCategoryId("all");
    setCurrentPage(1);
    setMenuOpen(false);
    setMenuBrandId(null);
    scrollToCatalog();
  };

  const activeFilterLabel = (() => {
    const parts: string[] = [];
    if (selectedBrandId !== "all") {
      parts.push(brandMap.get(selectedBrandId) ?? "");
    }
    if (selectedCategoryId !== "all") {
      parts.push(categoryMap.get(selectedCategoryId) ?? "");
    }
    return parts.length > 0 ? parts.filter(Boolean).join(" · ") : null;
  })();

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#2D2226]">
      {/* Barra superior de beneficio mayorista con brillo sutil */}
      <div className="animate-zoe-shimmer bg-gradient-to-r from-[#D85C8A] via-[#E879A5] to-[#D85C8A] px-4 py-2 text-center text-xs font-medium text-white sm:text-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2">
          <Sparkles className="h-3.5 w-3.5 shrink-0 animate-pulse" />
          <span>
            Accede a los <strong>precios al por mayor</strong> a partir de{" "}
            <strong>{formatCOP(wholesaleThreshold)} pesos</strong>
          </span>
        </div>
      </div>

      {/* Header con selector superior izquierdo, logo centrado y carrito a la derecha */}
      <header className="sticky top-0 z-40 border-b border-[#FAD4E4]/80 bg-white/92 backdrop-blur-md">
        <div className="mx-auto grid max-w-7xl grid-cols-3 items-center px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-start">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-expanded={menuOpen}
              aria-label="Abrir menú"
              className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl bg-[#FFF1F5] text-[#2D2226] ring-1 ring-[#FAD4E4] transition-all hover:-translate-y-0.5 hover:bg-[#FAD4E4]/50 hover:shadow-sm"
            >
              <Menu className="h-5 w-5 text-[#D85C8A]" />
              {activeFilterLabel && (
                <span
                  aria-hidden="true"
                  className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#D85C8A] ring-2 ring-white"
                />
              )}
            </button>
          </div>

          <div className="flex justify-center">
            <Link
              href="/"
              aria-label={settings.store_name || "ZOÉ COSMETICS"}
              className="group inline-flex items-center justify-center"
            >
              <div className="relative h-12 w-12 overflow-hidden rounded-2xl border-2 border-[#FAD4E4] bg-[#FFA6DA] shadow-sm transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3 sm:h-13 sm:w-13">
                <Image
                  src="/zoe-logo.jpg"
                  alt={`Logo ${settings.store_name || "ZOÉ COSMETICS"}`}
                  width={52}
                  height={52}
                  className="h-full w-full object-cover"
                />
              </div>
            </Link>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="relative flex cursor-pointer items-center gap-2 rounded-2xl bg-[#FFF1F5] px-3.5 py-2 text-sm font-semibold text-[#2D2226] ring-1 ring-[#FAD4E4] transition-all hover:-translate-y-0.5 hover:bg-[#FAD4E4]/50 hover:shadow-sm sm:gap-2.5 sm:px-4 sm:py-2.5"
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

      {/* Menú lateral: solo marcas; al elegir una marca se muestran sus categorías */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-start bg-[#2D2226]/40 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="Explorar marcas de la tienda"
        >
          <aside className="flex h-full w-full max-w-xs flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#FAD4E4] bg-[#FFF1F5] px-5 py-4">
              <div className="flex items-center gap-2.5">
                {menuBrand ? (
                  <button
                    type="button"
                    onClick={() => setMenuBrandId(null)}
                    aria-label="Volver a marcas"
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-[#FAD4E4] bg-white text-[#D85C8A] hover:bg-[#FAD4E4]/50"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                ) : (
                  <div className="h-9 w-9 overflow-hidden rounded-xl border border-[#FAD4E4] bg-[#FFA6DA]">
                    <Image
                      src="/zoe-logo.jpg"
                      alt={settings.store_name || "ZOÉ COSMETICS"}
                      width={36}
                      height={36}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <div>
                  <p className="text-base font-extrabold leading-tight tracking-tight text-[#2D2226]">
                    {menuBrand ? menuBrand.name : "Marcas"}
                  </p>
                  <p className="text-[11px] text-[#B94470]">
                    {menuBrand ? "Elige un tipo de producto" : "Elige una marca"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Cerrar menú"
                className="cursor-pointer rounded-full p-2 text-[#2D2226]/70 transition-colors hover:bg-[#FAD4E4]/60 hover:text-[#2D2226]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav
              className="flex-1 space-y-2 overflow-y-auto p-4"
              aria-label="Navegación de marcas y categorías"
            >
              {!menuBrand ? (
                <>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className={`flex w-full cursor-pointer items-center justify-between rounded-2xl px-3.5 py-3 text-left text-sm font-semibold transition-colors ${
                      selectedCategoryId === "all" && selectedBrandId === "all"
                        ? "bg-[#D85C8A] text-white shadow-xs"
                        : "bg-[#FFF1F5]/70 text-[#2D2226] hover:bg-[#FAD4E4]/55"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <LayoutGrid className="h-4 w-4" />
                      Ver todo el catálogo
                    </span>
                    <span className="rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-bold">
                      {products.length}
                    </span>
                  </button>

                  <ul className="space-y-1.5 pt-1">
                    {brands.map((brand) => {
                      const count = productCounts.byBrand.get(brand.id) ?? 0;
                      const active = selectedBrandId === brand.id;
                      return (
                        <li key={brand.id}>
                          <button
                            type="button"
                            onClick={() => setMenuBrandId(brand.id)}
                            className={`flex w-full cursor-pointer items-center justify-between rounded-2xl border px-3.5 py-3 text-left text-sm font-semibold transition-colors ${
                              active
                                ? "border-[#D85C8A] bg-[#FFF1F5] text-[#B94470]"
                                : "border-[#FAD4E4]/70 bg-white text-[#2D2226] hover:bg-[#FFF1F5]"
                            }`}
                          >
                            <span className="flex items-center gap-2.5">
                              <Tag className="h-4 w-4 text-[#D85C8A]" />
                              {brand.name}
                            </span>
                            <span className="flex items-center gap-2 text-[#B94470]">
                              <span className="rounded-full bg-[#FFF1F5] px-2 py-0.5 text-[11px] font-semibold">
                                {count}
                              </span>
                              <ChevronRight className="h-4 w-4" />
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleSelectBrand(menuBrand.id)}
                    className="flex w-full cursor-pointer items-center justify-between rounded-2xl bg-[#D85C8A] px-3.5 py-3 text-left text-sm font-semibold text-white shadow-xs hover:bg-[#B94470]"
                  >
                    <span>Todos los productos de {menuBrand.name}</span>
                    <span className="rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-bold">
                      {productCounts.byBrand.get(menuBrand.id) ?? 0}
                    </span>
                  </button>

                  {menuBrandCategories.length === 0 ? (
                    <p className="px-1 pt-2 text-xs text-[#2D2226]/60">
                      Esta marca aún no tiene productos clasificados por
                      categoría.
                    </p>
                  ) : (
                    <ul className="space-y-1.5 pt-1">
                      {menuBrandCategories.map((category) => {
                        const count =
                          brandCategoryCounts
                            .get(menuBrand.id)
                            ?.get(category.id) ?? 0;
                        const active =
                          selectedBrandId === menuBrand.id &&
                          selectedCategoryId === category.id;
                        return (
                          <li key={category.id}>
                            <button
                              type="button"
                              onClick={() =>
                                handleSelectBrandCategory(
                                  menuBrand.id,
                                  category.id
                                )
                              }
                              className={`flex w-full cursor-pointer items-center justify-between rounded-2xl border px-3.5 py-3 text-left text-sm font-medium transition-colors ${
                                active
                                  ? "border-[#D85C8A] bg-[#FFF1F5] font-semibold text-[#B94470]"
                                  : "border-[#FAD4E4]/70 bg-white text-[#2D2226] hover:bg-[#FFF1F5]"
                              }`}
                            >
                              <span>{category.name}</span>
                              <span className="rounded-full bg-[#FFF1F5] px-2 py-0.5 text-[11px] font-semibold text-[#B94470]">
                                {count}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </nav>
          </aside>

          <div
            className="flex-1"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
        </div>
      )}

      {/* Hero: logo + espacio para producto destacado o promoción (se elige desde el admin) */}
      <section className="relative overflow-hidden border-b border-[#FAD4E4]/60 bg-gradient-to-b from-[#FFF1F5] via-[#FFF8FA] to-white">
        <DynamicHeroDecor />

        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <h1 className="sr-only">{settings.store_name || "ZOÉ COSMETICS"}</h1>

            <div className="relative mx-auto flex w-fit items-center justify-center">
              <div className="animate-zoe-orbit-pulse absolute -inset-3 rounded-[2.2rem] bg-gradient-to-tr from-[#FAD4E4] via-[#FFAED4]/50 to-[#FFF1F5] blur-xl" />
              <div className="animate-zoe-float relative h-28 w-28 overflow-hidden rounded-[2rem] border-4 border-white bg-[#FFA6DA] shadow-[0_16px_40px_rgba(216,92,138,0.25)] sm:h-32 sm:w-32">
                <Image
                  src="/zoe-logo.jpg"
                  alt={`Logo ${settings.store_name || "ZOÉ COSMETICS"}`}
                  width={128}
                  height={128}
                  preload
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            {hasPromo && (
              <div className="mt-8 w-full overflow-hidden rounded-3xl border border-[#FAD4E4] bg-white/90 text-left shadow-[0_14px_40px_rgba(216,92,138,0.14)] backdrop-blur-xs">
                <div className="flex flex-col sm:flex-row">
                  {featuredImage && (
                    <div className="relative aspect-square w-full shrink-0 bg-[#FFF1F5] sm:w-52">
                      <Image
                        src={featuredImage}
                        alt={featuredProduct?.name ?? "Producto destacado"}
                        fill
                        sizes="(max-width: 640px) 100vw, 208px"
                        className="object-cover"
                      />
                    </div>
                  )}

                  <div className="flex flex-1 flex-col justify-center gap-2 p-5">
                    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#D85C8A] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                      <Sparkles className="h-3 w-3" />
                      {promoTitle || "Producto destacado"}
                    </span>

                    {featuredProduct && (
                      <div>
                        {featuredBrandName && (
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#B94470]">
                            {featuredBrandName}
                          </p>
                        )}
                        <h2 className="text-xl font-extrabold leading-snug tracking-tight text-[#2D2226] sm:text-2xl">
                          {featuredProduct.name}
                        </h2>
                      </div>
                    )}

                    {promoText && (
                      <p className="text-sm leading-relaxed text-[#2D2226]/75">
                        {promoText}
                      </p>
                    )}

                    {featuredProduct && (
                      <div className="mt-1 flex flex-wrap items-center gap-3">
                        <span className="text-sm text-[#2D2226]/60">
                          Detal{" "}
                          <strong className="text-[#2D2226]">
                            {formatCOP(featuredProduct.retail_price)}
                          </strong>
                        </span>
                        <span className="text-sm text-[#B94470]">
                          Mayor{" "}
                          <strong>
                            {formatCOP(featuredProduct.wholesale_price)}
                          </strong>
                        </span>
                        <button
                          type="button"
                          onClick={handleViewFeatured}
                          className="cursor-pointer rounded-xl bg-[#D85C8A] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#B94470]"
                        >
                          Ver en el catálogo
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Beneficios / Sellos de confianza */}
      <section
        aria-label="Beneficios de comprar en ZOÉ COSMETICS"
        className="border-b border-[#FAD4E4]/60 bg-[#FFF1F5]/70"
      >
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#FAD4E4]/80 bg-white p-3.5 shadow-[0_4px_16px_rgba(216,92,138,0.08)] sm:p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#E879A5] to-[#D85C8A] text-white shadow-xs">
                <Truck className="h-5 w-5" />
              </div>
              <p className="mt-2.5 text-xs font-extrabold text-[#2D2226] sm:text-sm">
                Envíos a toda Colombia
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-[#2D2226]/65 sm:text-xs">
                Recíbelo en tu casa.
              </p>
            </div>

            <div className="rounded-2xl border border-[#FAD4E4]/80 bg-white p-3.5 shadow-[0_4px_16px_rgba(216,92,138,0.08)] sm:p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#E879A5] to-[#D85C8A] text-white shadow-xs">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <p className="mt-2.5 text-xs font-extrabold text-[#2D2226] sm:text-sm">
                Compra segura
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-[#2D2226]/65 sm:text-xs">
                Productos originales.
              </p>
            </div>

            <div className="rounded-2xl border border-[#FAD4E4]/80 bg-white p-3.5 shadow-[0_4px_16px_rgba(216,92,138,0.08)] sm:p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#E879A5] to-[#D85C8A] text-white shadow-xs">
                <MessageCircle className="h-5 w-5" />
              </div>
              <p className="mt-2.5 text-xs font-extrabold text-[#2D2226] sm:text-sm">
                Asesoría por WhatsApp
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-[#2D2226]/65 sm:text-xs">
                Te ayudamos a elegir.
              </p>
            </div>

            <div className="rounded-2xl border border-[#FAD4E4]/80 bg-white p-3.5 shadow-[0_4px_16px_rgba(216,92,138,0.08)] sm:p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#E879A5] to-[#D85C8A] text-white shadow-xs">
                <Store className="h-5 w-5" />
              </div>
              <p className="mt-2.5 text-xs font-extrabold text-[#2D2226] sm:text-sm">
                Ideal para emprender
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-[#2D2226]/65 sm:text-xs">
                Tu proveedor de belleza de confianza.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Catálogo limpio: buscador + cuadrícula */}
      <main
        id="catalogo"
        className="mx-auto w-full max-w-7xl flex-1 scroll-mt-20 px-4 py-8 sm:px-6 lg:px-8"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-2xl font-extrabold tracking-tight text-[#2D2226]">
              Catálogo
            </h2>
            {activeFilterLabel ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryId("all");
                  setSelectedBrandId("all");
                }}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[#D85C8A] px-3.5 py-1 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#B94470]"
              >
                <span>{activeFilterLabel}</span>
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <span className="rounded-full bg-[#FFF1F5] px-3 py-1 text-xs font-medium text-[#B94470]">
                {filteredProducts.length} productos
              </span>
            )}
          </div>

          {/* Buscador */}
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#D85C8A]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Buscar producto, marca o tono..."
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

        {/* Estado del carrito si tiene ítems */}
        {totalItemsCount > 0 && (
          <div className="mt-5 flex items-center justify-between rounded-2xl border border-[#FAD4E4] bg-[#FFF1F5] px-4 py-3 text-xs sm:text-sm">
            <div>
              {wholesaleActive ? (
                <span className="font-semibold text-[#D85C8A]">
                  ¡Precio al por mayor activado en tu carrito!
                </span>
              ) : (
                <span className="text-[#2D2226]/80">
                  Te faltan solo{" "}
                  <strong className="text-[#D85C8A]">
                    {formatCOP(
                      Math.max(0, wholesaleThreshold - wholesaleSubtotal)
                    )}
                  </strong>{" "}
                  para disfrutar de nuestros precios al por mayor
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

        {/* Cuadrícula de productos */}
        {filteredProducts.length > 0 ? (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
              {paginatedProducts.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  categoryName={
                    product.category_id
                      ? categoryMap.get(product.category_id)
                      : undefined
                  }
                  brandName={
                    product.brand_id ? brandMap.get(product.brand_id) : undefined
                  }
                  wholesaleActive={wholesaleActive}
                  index={index}
                  onSelect={setSelectedProduct}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-[#FAD4E4]/60 pt-6 sm:flex-row">
                <p className="text-xs text-[#2D2226]/65">
                  Mostrando{" "}
                  <strong className="text-[#2D2226]">
                    {pageStartIndex + 1}–
                    {Math.min(
                      pageStartIndex + PRODUCTS_PER_PAGE,
                      filteredProducts.length
                    )}
                  </strong>{" "}
                  de{" "}
                  <strong className="text-[#2D2226]">
                    {filteredProducts.length}
                  </strong>{" "}
                  productos
                </p>

                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => goToPage(safePage - 1)}
                    disabled={safePage <= 1}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-[#FAD4E4] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D2226] transition-colors hover:bg-[#FFF1F5] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Anterior
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => goToPage(page)}
                        aria-current={page === safePage ? "page" : undefined}
                        className={`h-8 min-w-8 cursor-pointer rounded-xl px-2.5 text-xs font-bold transition-colors ${
                          page === safePage
                            ? "bg-[#D85C8A] text-white shadow-xs"
                            : "border border-[#FAD4E4] bg-white text-[#2D2226] hover:bg-[#FFF1F5]"
                        }`}
                      >
                        {page}
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    onClick={() => goToPage(safePage + 1)}
                    disabled={safePage >= totalPages}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-[#FAD4E4] bg-white px-3 py-1.5 text-xs font-semibold text-[#2D2226] transition-colors hover:bg-[#FFF1F5] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Siguiente
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="mt-12 rounded-3xl border border-dashed border-[#FAD4E4] bg-[#FFF1F5]/40 px-6 py-16 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-[#D85C8A]/70" />
            <h3 className="mt-3 text-xl font-extrabold tracking-tight text-[#2D2226]">
              No encontramos productos
            </h3>
            <p className="mt-1 text-sm text-[#2D2226]/65">
              Prueba con otro nombre o selecciona otra opción en el menú
              superior izquierdo.
            </p>
            {(searchQuery ||
              selectedCategoryId !== "all" ||
              selectedBrandId !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategoryId("all");
                  setSelectedBrandId("all");
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
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 text-xs text-[#2D2226]/65 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <Image
              src="/zoe-logo.jpg"
              alt={settings.store_name || "ZOÉ COSMETICS"}
              width={28}
              height={28}
              className="h-7 w-7 rounded-lg border border-[#FAD4E4] object-cover"
            />
            <p>
              © 2026{" "}
              <strong className="font-semibold text-[#2D2226]">
                {settings.store_name || "ZOÉ COSMETICS"}
              </strong>
              . Todos los derechos reservados.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {instagramHref && (
              <a
                href={instagramHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#FAD4E4] bg-white px-3.5 py-2 text-xs font-semibold text-[#B94470] shadow-xs transition-all hover:-translate-y-0.5 hover:bg-[#D85C8A] hover:text-white"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-4 w-4 fill-none stroke-current"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                </svg>
                Instagram
              </a>
            )}

            {tiktokHref && (
              <a
                href={tiktokHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#FAD4E4] bg-white px-3.5 py-2 text-xs font-semibold text-[#2D2226] shadow-xs transition-all hover:-translate-y-0.5 hover:bg-[#2D2226] hover:text-white"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-4 w-4 fill-current"
                >
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.81a8.22 8.22 0 0 0 4.76 1.51V6.87a4.84 4.84 0 0 1-1-.18Z" />
                </svg>
                TikTok
              </a>
            )}

            <Link
              href="/admin"
              className="px-2 py-1 font-medium text-[#B94470]/80 transition-colors hover:text-[#D85C8A]"
            >
              Panel de administración
            </Link>
          </div>
        </div>
      </footer>

      {/* Toast dinámico al agregar un tono al carrito */}
      {toast && !cartOpen && (
        <div className="animate-zoe-pop-in fixed bottom-20 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-[#FAD4E4] bg-white/95 px-4 py-3 shadow-[0_12px_36px_rgba(216,92,138,0.22)] backdrop-blur-md sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0">
          <div className="flex min-w-0 items-center gap-3">
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
                {toast.shadeName && toast.shadeName !== "Único"
                  ? `Tono: ${toast.shadeName} agregado`
                  : "Agregado al carrito"}
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

      {/* Modal de detalle del producto (descripción y tonos) */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          categoryName={
            selectedProduct.category_id
              ? categoryMap.get(selectedProduct.category_id)
              : undefined
          }
          brandName={
            selectedProduct.brand_id
              ? brandMap.get(selectedProduct.brand_id)
              : undefined
          }
          wholesaleActive={wholesaleActive}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* Drawer del carrito (cargado de forma diferida solo al abrir) */}
      {cartOpen && (
        <CartDrawer
          isOpen={cartOpen}
          onClose={() => setCartOpen(false)}
          items={cartItems}
          settings={settings}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onClearCart={handleClearCart}
        />
      )}
    </div>
  );
}
