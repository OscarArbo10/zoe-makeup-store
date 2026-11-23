import { createClient } from "@/lib/supabase/server";
import type {
  Category,
  ProductWithVariants,
  StoreSettings,
} from "@/types/database";
import { StorefrontClient } from "@/components/store/StorefrontClient";

export const dynamic = "force-dynamic";

const DEFAULT_SETTINGS: StoreSettings = {
  id: 1,
  store_name: "ZOÉ COSMETICS",
  wholesale_threshold: 100000,
  whatsapp_number: "573000000000",
  updated_at: new Date().toISOString(),
};

export default async function HomePage() {
  const supabase = await createClient();

  const [settingsRes, categoriesRes, productsRes] = await Promise.all([
    supabase.from("store_settings").select("*").eq("id", 1).maybeSingle(),
    supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("products")
      .select(
        `
        *,
        product_variants (*)
      `
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
  ]);

  const settings: StoreSettings =
    (settingsRes.data as StoreSettings | null) ?? DEFAULT_SETTINGS;
  const categories: Category[] = (categoriesRes.data as Category[] | null) ?? [];
  const products: ProductWithVariants[] = (
    (productsRes.data as ProductWithVariants[] | null) ?? []
  ).map((p) => ({
    ...p,
    product_variants: (p.product_variants ?? []).sort((a, b) =>
      a.shade_name.localeCompare(b.shade_name, "es")
    ),
  }));

  return (
    <StorefrontClient
      settings={settings}
      categories={categories}
      products={products}
    />
  );
}
