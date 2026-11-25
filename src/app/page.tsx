import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type {
  Category,
  ProductWithVariants,
  StoreSettings,
} from "@/types/database";
import { StorefrontClient } from "@/components/store/StorefrontClient";

const DEFAULT_SETTINGS: StoreSettings = {
  id: 1,
  store_name: "ZOÉ COSMETICS",
  wholesale_threshold: 100000,
  whatsapp_number: "573007117844",
  updated_at: "2026-01-01T00:00:00.000Z",
};

async function getCatalogData(): Promise<{
  settings: StoreSettings;
  categories: Category[];
  products: ProductWithVariants[];
}> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");

  const supabase = createPublicClient();

  const [settingsRes, categoriesRes, productsRes] = await Promise.all([
    supabase
      .from("store_settings")
      .select("id, store_name, wholesale_threshold, whatsapp_number, updated_at")
      .eq("id", 1)
      .maybeSingle(),
    supabase
      .from("categories")
      .select("id, name, slug, sort_order, created_at")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("products")
      .select(
        `
        id,
        category_id,
        name,
        slug,
        description,
        retail_price,
        wholesale_price,
        image_url,
        is_active,
        created_at,
        updated_at,
        product_variants (
          id,
          product_id,
          shade_name,
          shade_hex,
          stock,
          image_url,
          is_active,
          created_at
        )
      `
      )
      .eq("is_active", true)
      .eq("product_variants.is_active", true)
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

  return { settings, categories, products };
}

export default async function HomePage() {
  const { settings, categories, products } = await getCatalogData();

  return (
    <StorefrontClient
      settings={settings}
      categories={categories}
      products={products}
    />
  );
}
