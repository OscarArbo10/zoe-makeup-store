import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/supabase/auth";
import type {
  Brand,
  Category,
  OrderWithItems,
  ProductWithVariants,
  StoreSettings,
} from "@/types/database";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

const DEFAULT_SETTINGS: StoreSettings = {
  id: 1,
  store_name: "ZOÉ COSMETICS",
  wholesale_threshold: 100000,
  whatsapp_number: "573007117844",
  featured_product_id: null,
  promo_title: null,
  promo_text: null,
  updated_at: "2026-01-01T00:00:00.000Z",
};

async function AdminContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  if (!isAdminUser(user)) {
    redirect("/admin/login?error=unauthorized");
  }

  const [settingsRes, categoriesRes, brandsRes, productsRes, ordersRes] =
    await Promise.all([
      supabase.from("store_settings").select("*").eq("id", 1).maybeSingle(),
      supabase
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("brands")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("products")
        .select(`*, product_variants (*)`)
        .order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select(`*, order_items (*)`)
        .order("created_at", { ascending: false }),
    ]);

  const settings =
    (settingsRes.data as StoreSettings | null) ?? DEFAULT_SETTINGS;
  const categories = (categoriesRes.data as Category[] | null) ?? [];
  const brands = (brandsRes.data as Brand[] | null) ?? [];
  const products = (
    (productsRes.data as ProductWithVariants[] | null) ?? []
  ).map((p) => ({
    ...p,
    product_variants: (p.product_variants ?? []).sort((a, b) =>
      a.shade_name.localeCompare(b.shade_name, "es")
    ),
  }));
  const orders = (ordersRes.data as OrderWithItems[] | null) ?? [];

  return (
    <AdminDashboard
      userEmail={user.email ?? "admin"}
      initialSettings={settings}
      initialCategories={categories}
      initialBrands={brands}
      initialProducts={products}
      initialOrders={orders}
    />
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#FFF1F5]/35 text-sm text-[#B94470]">
          Cargando panel de administración...
        </div>
      }
    >
      <AdminContent />
    </Suspense>
  );
}
