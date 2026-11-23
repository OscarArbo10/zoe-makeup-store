import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/supabase/auth";
import type {
  Category,
  OrderWithItems,
  ProductWithVariants,
  StoreSettings,
} from "@/types/database";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";

const DEFAULT_SETTINGS: StoreSettings = {
  id: 1,
  store_name: "Zoe",
  wholesale_threshold: 100000,
  whatsapp_number: "573000000000",
  updated_at: new Date().toISOString(),
};

export default async function AdminPage() {
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

  const [settingsRes, categoriesRes, productsRes, ordersRes] =
    await Promise.all([
      supabase.from("store_settings").select("*").eq("id", 1).maybeSingle(),
      supabase
        .from("categories")
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
      initialProducts={products}
      initialOrders={orders}
    />
  );
}
