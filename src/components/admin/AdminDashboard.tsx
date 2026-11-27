"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  FolderTree,
  LogOut,
  Package,
  RefreshCw,
  Settings,
  ShoppingBag,
  Tag,
} from "lucide-react";
import type {
  Brand,
  Category,
  OrderWithItems,
  ProductWithVariants,
  StoreSettings,
} from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import { ProductsTab } from "./ProductsTab";

const CategoriesTab = dynamic(
  () => import("./CategoriesTab").then((mod) => mod.CategoriesTab),
  { ssr: false }
);

const BrandsTab = dynamic(
  () => import("./BrandsTab").then((mod) => mod.BrandsTab),
  { ssr: false }
);

const OrdersTab = dynamic(
  () => import("./OrdersTab").then((mod) => mod.OrdersTab),
  { ssr: false }
);

const SettingsTab = dynamic(
  () => import("./SettingsTab").then((mod) => mod.SettingsTab),
  { ssr: false }
);

type AdminTab = "products" | "categories" | "brands" | "orders" | "settings";

interface AdminDashboardProps {
  userEmail: string;
  initialSettings: StoreSettings;
  initialCategories: Category[];
  initialBrands: Brand[];
  initialProducts: ProductWithVariants[];
  initialOrders: OrderWithItems[];
}

export function AdminDashboard({
  userEmail,
  initialSettings,
  initialCategories,
  initialBrands,
  initialProducts,
  initialOrders,
}: AdminDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>("products");
  const [settings, setSettings] = useState<StoreSettings>(initialSettings);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [brands, setBrands] = useState<Brand[]>(initialBrands);
  const [products, setProducts] =
    useState<ProductWithVariants[]>(initialProducts);
  const [orders, setOrders] = useState<OrderWithItems[]>(initialOrders);
  const [refreshing, setRefreshing] = useState(false);

  const refreshSettings = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("store_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (data) setSettings(data as StoreSettings);
  }, []);

  const refreshCategories = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (data) setCategories(data as Category[]);
  }, []);

  const refreshBrands = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("brands")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (data) setBrands(data as Brand[]);
  }, []);

  const refreshProducts = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("products")
      .select(`*, product_variants (*)`)
      .order("created_at", { ascending: false });
    if (data) {
      setProducts(
        (data as ProductWithVariants[]).map((p) => ({
          ...p,
          product_variants: (p.product_variants ?? []).sort((a, b) =>
            a.shade_name.localeCompare(b.shade_name, "es")
          ),
        }))
      );
    }
  }, []);

  const refreshOrders = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("orders")
      .select(`*, order_items (*)`)
      .order("created_at", { ascending: false });
    if (data) setOrders(data as OrderWithItems[]);
  }, []);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshSettings(),
        refreshCategories(),
        refreshBrands(),
        refreshProducts(),
        refreshOrders(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [
    refreshSettings,
    refreshCategories,
    refreshBrands,
    refreshProducts,
    refreshOrders,
  ]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  };

  const pendingOrdersCount = orders.filter(
    (o) => o.status === "pendiente"
  ).length;

  const tabs: {
    id: AdminTab;
    label: string;
    icon: typeof Package;
    badge?: number;
  }[] = [
    {
      id: "products",
      label: "Productos y Tonos",
      icon: Package,
      badge: products.length,
    },
    {
      id: "categories",
      label: "Categorías",
      icon: FolderTree,
      badge: categories.length,
    },
    {
      id: "brands",
      label: "Marcas",
      icon: Tag,
      badge: brands.length,
    },
    {
      id: "orders",
      label: "Pedidos",
      icon: ShoppingBag,
      badge: pendingOrdersCount > 0 ? pendingOrdersCount : orders.length,
    },
    {
      id: "settings",
      label: "Configuración",
      icon: Settings,
    },
  ];

  return (
    <div className="min-h-screen bg-[#FFF1F5]/35 text-[#2D2226]">
      {/* Topbar */}
      <header className="sticky top-0 z-30 border-b border-[#FAD4E4] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 overflow-hidden rounded-2xl border border-[#FAD4E4] bg-[#FFA6DA] shadow-xs">
              <Image
                src="/zoe-logo.jpg"
                alt="Logo ZOÉ COSMETICS"
                width={40}
                height={40}
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <h1 className="text-xl font-extrabold leading-none tracking-tight text-[#2D2226]">
                {settings.store_name || "ZOÉ COSMETICS"} Admin
              </h1>
              <p className="mt-0.5 text-[11px] text-[#2D2226]/60">{userEmail}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refreshAll}
              disabled={refreshing}
              title="Actualizar datos"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#FAD4E4] bg-white px-3 py-2 text-xs font-semibold text-[#2D2226] hover:bg-[#FFF1F5]"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-[#D85C8A] ${
                  refreshing ? "animate-spin" : ""
                }`}
              />
              <span className="hidden sm:inline">Actualizar</span>
            </button>

            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#FAD4E4] bg-[#FFF1F5] px-3 py-2 text-xs font-semibold text-[#B94470] hover:bg-[#FAD4E4]/60"
            >
              <span className="hidden sm:inline">Ver tienda</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>

            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#2D2226] px-3 py-2 text-xs font-semibold text-white hover:bg-[#2D2226]/85"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>

        {/* Navegación por pestañas */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <nav
            className="-mb-px flex gap-1 overflow-x-auto"
            aria-label="Secciones de administración"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex shrink-0 cursor-pointer items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors sm:text-sm ${
                    isActive
                      ? "border-[#D85C8A] text-[#D85C8A]"
                      : "border-transparent text-[#2D2226]/65 hover:border-[#FAD4E4] hover:text-[#2D2226]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                  {typeof tab.badge === "number" && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        isActive
                          ? "bg-[#D85C8A] text-white"
                          : "bg-[#FFF1F5] text-[#B94470]"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Contenido de la pestaña */}
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        {activeTab === "products" && (
          <ProductsTab
            products={products}
            categories={categories}
            brands={brands}
            onRefresh={refreshProducts}
            onRefreshCategories={refreshCategories}
            onRefreshBrands={refreshBrands}
          />
        )}
        {activeTab === "categories" && (
          <CategoriesTab
            categories={categories}
            onRefresh={refreshCategories}
          />
        )}
        {activeTab === "brands" && (
          <BrandsTab brands={brands} onRefresh={refreshBrands} />
        )}
        {activeTab === "orders" && (
          <OrdersTab
            orders={orders}
            storeName={settings.store_name || "ZOÉ COSMETICS"}
            onRefresh={async () => {
              await Promise.all([refreshOrders(), refreshProducts()]);
            }}
          />
        )}
        {activeTab === "settings" && (
          <SettingsTab
            userEmail={userEmail}
            settings={settings}
            products={products}
            onRefresh={refreshSettings}
          />
        )}
      </main>
    </div>
  );
}
