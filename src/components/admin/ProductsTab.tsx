"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  ChevronDown,
  ChevronUp,
  Edit3,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Minus,
  Palette,
  Plus,
  Save,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type {
  Brand,
  Category,
  ProductVariant,
  ProductWithVariants,
} from "@/types/database";
import { formatCOP, slugify } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { uploadProductImage } from "@/lib/supabase/storage";
import { revalidateCatalog } from "@/app/admin/actions";

interface ProductsTabProps {
  products: ProductWithVariants[];
  categories: Category[];
  brands: Brand[];
  onRefresh: () => Promise<void>;
  onRefreshCategories: () => Promise<void>;
  onRefreshBrands: () => Promise<void>;
}

interface ProductFormState {
  id: string | null;
  name: string;
  slug: string;
  category_id: string;
  brand_id: string;
  description: string;
  retail_price: string;
  wholesale_price: string;
  image_urls: string[];
  has_shades: boolean;
  default_stock: string;
  is_active: boolean;
}

interface VariantFormState {
  id: string | null;
  product_id: string;
  shade_name: string;
  shade_hex: string;
  stock: string;
  image_url: string;
  is_active: boolean;
}

const EMPTY_PRODUCT_FORM: ProductFormState = {
  id: null,
  name: "",
  slug: "",
  category_id: "",
  brand_id: "",
  description: "",
  retail_price: "",
  wholesale_price: "",
  image_urls: [],
  has_shades: true,
  default_stock: "10",
  is_active: true,
};

export function ProductsTab({
  products,
  categories,
  brands,
  onRefresh,
  onRefreshCategories,
  onRefreshBrands,
}: ProductsTabProps) {
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productForm, setProductForm] =
    useState<ProductFormState>(EMPTY_PRODUCT_FORM);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingBrand, setCreatingBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [photoUrlInput, setPhotoUrlInput] = useState("");
  const [savingProduct, setSavingProduct] = useState(false);
  const [uploadingProductImg, setUploadingProductImg] = useState(false);

  const [expandedProductId, setExpandedProductId] = useState<string | null>(
    products[0]?.id ?? null
  );

  const [variantForm, setVariantForm] = useState<VariantFormState | null>(null);
  const [savingVariant, setSavingVariant] = useState(false);
  const [uploadingVariantImg, setUploadingVariantImg] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const notify = (type: "success" | "error", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const openCreateProduct = () => {
    setCreatingCategory(categories.length === 0);
    setNewCategoryName("");
    setCreatingBrand(brands.length === 0);
    setNewBrandName("");
    setPhotoUrlInput("");
    setProductForm({
      ...EMPTY_PRODUCT_FORM,
      category_id: categories[0]?.id ?? "",
      brand_id: brands[0]?.id ?? "",
    });
    setProductModalOpen(true);
  };

  const openEditProduct = (product: ProductWithVariants) => {
    const existingImages =
      product.image_urls && product.image_urls.length > 0
        ? product.image_urls
        : product.image_url
        ? [product.image_url]
        : [];

    setCreatingCategory(false);
    setNewCategoryName("");
    setCreatingBrand(false);
    setNewBrandName("");
    setPhotoUrlInput("");
    setProductForm({
      id: product.id,
      name: product.name,
      slug: product.slug,
      category_id: product.category_id ?? "",
      brand_id: product.brand_id ?? "",
      description: product.description ?? "",
      retail_price: String(product.retail_price),
      wholesale_price: String(product.wholesale_price),
      image_urls: existingImages,
      has_shades: product.has_shades ?? true,
      default_stock: String(product.product_variants[0]?.stock ?? 10),
      is_active: product.is_active,
    });
    setProductModalOpen(true);
  };

  const handleUploadProductPhotos = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setUploadingProductImg(true);
    try {
      const uploadedUrls = await Promise.all(
        files.map((file) => uploadProductImage(file, "products"))
      );
      setProductForm((prev) => ({
        ...prev,
        image_urls: [...prev.image_urls, ...uploadedUrls],
      }));
      notify(
        "success",
        uploadedUrls.length === 1
          ? "Foto subida correctamente."
          : `${uploadedUrls.length} fotos subidas correctamente.`
      );
    } catch (err) {
      notify(
        "error",
        err instanceof Error ? err.message : "Error al subir las imágenes."
      );
    } finally {
      setUploadingProductImg(false);
      e.target.value = "";
    }
  };

  const handleAddPhotoUrl = () => {
    const trimmed = photoUrlInput.trim();
    if (!trimmed) return;
    setProductForm((prev) =>
      prev.image_urls.includes(trimmed)
        ? prev
        : { ...prev, image_urls: [...prev.image_urls, trimmed] }
    );
    setPhotoUrlInput("");
  };

  const handleSetCoverPhoto = (idx: number) => {
    setProductForm((prev) => {
      if (idx <= 0 || idx >= prev.image_urls.length) return prev;
      const chosen = prev.image_urls[idx];
      const rest = prev.image_urls.filter((_, i) => i !== idx);
      return { ...prev, image_urls: [chosen, ...rest] };
    });
  };

  const handleRemovePhoto = (idx: number) => {
    setProductForm((prev) => ({
      ...prev,
      image_urls: prev.image_urls.filter((_, i) => i !== idx),
    }));
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProduct(true);
    try {
      const supabase = createClient();
      const refreshTasks: Promise<unknown>[] = [];

      // 1. Resolver categoría (existente o crear nueva en línea)
      let resolvedCategoryId: string | null = productForm.category_id || null;
      if (creatingCategory) {
        const trimmedCat = newCategoryName.trim();
        if (trimmedCat) {
          const catSlug = slugify(trimmedCat) || `cat-${Date.now()}`;
          const { data: catData, error: catErr } = await supabase
            .from("categories")
            .upsert(
              {
                name: trimmedCat,
                slug: catSlug,
                sort_order: categories.length,
              },
              { onConflict: "slug" }
            )
            .select("id")
            .single();
          if (catErr) throw new Error(`Categoría: ${catErr.message}`);
          resolvedCategoryId = catData?.id ?? null;
          refreshTasks.push(onRefreshCategories());
        } else {
          resolvedCategoryId = null;
        }
      }

      // 2. Resolver marca (existente o crear nueva en línea)
      let resolvedBrandId: string | null = productForm.brand_id || null;
      if (creatingBrand) {
        const trimmedBrand = newBrandName.trim();
        if (trimmedBrand) {
          const brandSlug = slugify(trimmedBrand) || `marca-${Date.now()}`;
          const { data: brandData, error: brandErr } = await supabase
            .from("brands")
            .upsert(
              {
                name: trimmedBrand,
                slug: brandSlug,
                sort_order: brands.length,
              },
              { onConflict: "slug" }
            )
            .select("id")
            .single();
          if (brandErr) throw new Error(`Marca: ${brandErr.message}`);
          resolvedBrandId = brandData?.id ?? null;
          refreshTasks.push(onRefreshBrands());
        } else {
          resolvedBrandId = null;
        }
      }

      // Si dejó una URL escrita en el campo auxiliar sin pulsar "Añadir", incluirla también
      const pendingUrl = photoUrlInput.trim();
      const finalImages =
        pendingUrl && !productForm.image_urls.includes(pendingUrl)
          ? [...productForm.image_urls, pendingUrl]
          : productForm.image_urls;

      const retailPrice = Math.max(
        0,
        Math.round(Number(productForm.retail_price) || 0)
      );
      const wholesalePrice = Math.max(
        0,
        Math.round(Number(productForm.wholesale_price) || 0)
      );
      const finalSlug =
        productForm.slug.trim() ||
        slugify(productForm.name) ||
        `prod-${Date.now()}`;

      const payload = {
        name: productForm.name.trim(),
        slug: finalSlug,
        category_id: resolvedCategoryId,
        brand_id: resolvedBrandId,
        description: productForm.description.trim() || null,
        retail_price: retailPrice,
        wholesale_price: wholesalePrice,
        image_url: finalImages[0] ?? null,
        image_urls: finalImages,
        has_shades: productForm.has_shades,
        is_active: productForm.is_active,
        updated_at: new Date().toISOString(),
      };

      let savedProductId = productForm.id;

      if (productForm.id) {
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", productForm.id);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase
          .from("products")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        savedProductId = data?.id ?? null;
        if (savedProductId && productForm.has_shades) {
          setExpandedProductId(savedProductId);
        }
      }

      // Si el producto no funciona con tonos, asegurar una variante única automática con el stock indicado
      if (!productForm.has_shades && savedProductId) {
        const stockVal = Math.max(
          0,
          Math.round(Number(productForm.default_stock) || 0)
        );
        const existingProd = products.find((p) => p.id === savedProductId);
        const firstVariant = existingProd?.product_variants[0];

        if (firstVariant) {
          const { error: varErr } = await supabase
            .from("product_variants")
            .update({
              shade_name: "Único",
              shade_hex: "#D85C8A",
              stock: stockVal,
              is_active: true,
            })
            .eq("id", firstVariant.id);
          if (varErr) throw new Error(`Stock: ${varErr.message}`);
        } else {
          const { error: varErr } = await supabase
            .from("product_variants")
            .insert({
              product_id: savedProductId,
              shade_name: "Único",
              shade_hex: "#D85C8A",
              stock: stockVal,
              is_active: true,
            });
          if (varErr) throw new Error(`Stock: ${varErr.message}`);
        }
      }

      notify(
        "success",
        productForm.id
          ? "Producto actualizado."
          : productForm.has_shades
          ? "Producto creado. Ahora puedes agregarle tonos."
          : "Producto creado correctamente."
      );

      setProductModalOpen(false);
      await Promise.all([onRefresh(), revalidateCatalog(), ...refreshTasks]);
    } catch (err) {
      notify(
        "error",
        err instanceof Error ? err.message : "No se pudo guardar el producto."
      );
    } finally {
      setSavingProduct(false);
    }
  };

  const handleToggleProductActive = async (product: ProductWithVariants) => {
    setBusyId(product.id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("products")
        .update({
          is_active: !product.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id);
      if (error) throw new Error(error.message);
      await Promise.all([onRefresh(), revalidateCatalog()]);
    } catch (err) {
      notify(
        "error",
        err instanceof Error ? err.message : "No se pudo cambiar el estado."
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteProduct = async (product: ProductWithVariants) => {
    if (
      !window.confirm(
        `¿Eliminar el producto "${product.name}" y todos sus tonos? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    setBusyId(product.id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", product.id);
      if (error) throw new Error(error.message);
      notify("success", "Producto eliminado.");
      await Promise.all([onRefresh(), revalidateCatalog()]);
    } catch (err) {
      notify(
        "error",
        err instanceof Error ? err.message : "No se pudo eliminar el producto."
      );
    } finally {
      setBusyId(null);
    }
  };

  // --- Gestión de tonos (product_variants) ---
  const openCreateVariant = (productId: string) => {
    setExpandedProductId(productId);
    setVariantForm({
      id: null,
      product_id: productId,
      shade_name: "",
      shade_hex: "#E68AA8",
      stock: "10",
      image_url: "",
      is_active: true,
    });
  };

  const openEditVariant = (variant: ProductVariant) => {
    setVariantForm({
      id: variant.id,
      product_id: variant.product_id,
      shade_name: variant.shade_name,
      shade_hex: variant.shade_hex || "#E68AA8",
      stock: String(variant.stock),
      image_url: variant.image_url ?? "",
      is_active: variant.is_active,
    });
  };

  const handleUploadVariantPhoto = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !variantForm) return;
    setUploadingVariantImg(true);
    try {
      const publicUrl = await uploadProductImage(file, "shades");
      setVariantForm((prev) =>
        prev ? { ...prev, image_url: publicUrl } : prev
      );
      notify("success", "Foto del tono subida correctamente.");
    } catch (err) {
      notify(
        "error",
        err instanceof Error ? err.message : "Error al subir la foto del tono."
      );
    } finally {
      setUploadingVariantImg(false);
      e.target.value = "";
    }
  };

  const handleSaveVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!variantForm) return;
    setSavingVariant(true);

    try {
      const supabase = createClient();
      const payload = {
        product_id: variantForm.product_id,
        shade_name: variantForm.shade_name.trim(),
        shade_hex: variantForm.shade_hex.trim() || "#F48FB1",
        stock: Math.max(0, Math.round(Number(variantForm.stock) || 0)),
        image_url: variantForm.image_url.trim() || null,
        is_active: variantForm.is_active,
      };

      if (variantForm.id) {
        const { error } = await supabase
          .from("product_variants")
          .update(payload)
          .eq("id", variantForm.id);
        if (error) throw new Error(error.message);
        notify("success", "Tono actualizado.");
      } else {
        const { error } = await supabase
          .from("product_variants")
          .insert(payload);
        if (error) throw new Error(error.message);
        notify("success", "Tono agregado al producto.");
      }

      setVariantForm(null);
      await Promise.all([onRefresh(), revalidateCatalog()]);
    } catch (err) {
      notify(
        "error",
        err instanceof Error ? err.message : "No se pudo guardar el tono."
      );
    } finally {
      setSavingVariant(false);
    }
  };

  const handleDeleteVariant = async (variant: ProductVariant) => {
    if (!window.confirm(`¿Eliminar el tono "${variant.shade_name}"?`)) return;
    setBusyId(variant.id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("product_variants")
        .delete()
        .eq("id", variant.id);
      if (error) throw new Error(error.message);
      notify("success", "Tono eliminado.");
      await Promise.all([onRefresh(), revalidateCatalog()]);
    } catch (err) {
      notify(
        "error",
        err instanceof Error ? err.message : "No se pudo eliminar el tono."
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleQuickAdjustStock = async (
    variant: ProductVariant,
    delta: number
  ) => {
    const nextStock = Math.max(0, variant.stock + delta);
    if (nextStock === variant.stock) return;
    setBusyId(variant.id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("product_variants")
        .update({ stock: nextStock })
        .eq("id", variant.id);
      if (error) throw new Error(error.message);
      await Promise.all([onRefresh(), revalidateCatalog()]);
    } catch (err) {
      notify(
        "error",
        err instanceof Error
          ? err.message
          : "No se pudo actualizar el stock."
      );
    } finally {
      setBusyId(null);
    }
  };

  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      map.set(c.id, c.name);
    }
    return map;
  }, [categories]);

  const brandNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of brands) {
      map.set(b.id, b.name);
    }
    return map;
  }, [brands]);

  const categoryNameById = (id: string | null) =>
    (id ? categoryNameMap.get(id) : undefined) ?? "Sin categoría";

  const brandNameById = (id: string | null) =>
    id ? brandNameMap.get(id) ?? null : null;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#2D2226]">
            Productos y Tonos
          </h2>
          <p className="text-xs text-[#2D2226]/65 sm:text-sm">
            Administra tu catálogo, galería de fotos, precios detal/mayor y
            tonos disponibles.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateProduct}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#D85C8A] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#B94470]"
        >
          <Plus className="h-4 w-4" />
          Nuevo producto
        </button>
      </div>

      {feedback && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Lista de productos */}
      <div className="space-y-4">
        {products.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#FAD4E4] bg-[#FFF1F5]/40 p-10 text-center text-sm text-[#2D2226]/65">
            Aún no hay productos registrados. Crea el primero con el botón
            &ldquo;Nuevo producto&rdquo;.
          </div>
        ) : (
          products.map((product) => {
            const isExpanded = expandedProductId === product.id;
            const photoCount =
              product.image_urls && product.image_urls.length > 0
                ? product.image_urls.length
                : product.image_url
                ? 1
                : 0;
            const coverUrl = product.image_urls?.[0] || product.image_url;
            const totalStock = product.product_variants.reduce(
              (sum, v) => sum + Math.max(0, v.stock),
              0
            );
            const singleVariant = product.product_variants[0] ?? null;

            return (
              <div
                key={product.id}
                className="overflow-hidden rounded-3xl border border-[#FAD4E4] bg-white shadow-xs"
              >
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="flex items-center gap-4">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-[#FAD4E4] bg-[#FFF1F5]">
                      {coverUrl ? (
                        <Image
                          src={coverUrl}
                          alt={product.name}
                          width={64}
                          height={64}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[#D85C8A]/60">
                          <ImagePlus className="h-6 w-6" />
                        </div>
                      )}
                      {photoCount > 1 && (
                        <span className="absolute bottom-1 right-1 rounded-md bg-[#2D2226]/75 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {photoCount}
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-[#2D2226]">
                          {product.name}
                        </h3>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            product.is_active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {product.is_active ? "Activo" : "Oculto"}
                        </span>
                        <span className="rounded-full bg-[#FFF1F5] px-2.5 py-0.5 text-[11px] font-medium text-[#B94470]">
                          {categoryNameById(product.category_id)}
                        </span>
                        {brandNameById(product.brand_id) && (
                          <span className="rounded-full border border-[#FAD4E4] bg-white px-2.5 py-0.5 text-[11px] font-semibold text-[#2D2226]/75">
                            {brandNameById(product.brand_id)}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#2D2226]/70">
                        <span>
                          Detal:{" "}
                          <strong className="text-[#2D2226]">
                            {formatCOP(product.retail_price)}
                          </strong>
                        </span>
                        <span>
                          Mayor:{" "}
                          <strong className="text-[#D85C8A]">
                            {formatCOP(product.wholesale_price)}
                          </strong>
                        </span>
                        <span>
                          Fotos:{" "}
                          <strong className="text-[#2D2226]">
                            {photoCount}
                          </strong>
                        </span>
                        {product.has_shades === false ? (
                          <span>
                            Stock:{" "}
                            <strong
                              className={
                                totalStock > 0
                                  ? "text-emerald-700"
                                  : "text-rose-600"
                              }
                            >
                              {totalStock}
                            </strong>
                          </span>
                        ) : (
                          <>
                            <span>
                              Tonos:{" "}
                              <strong className="text-[#2D2226]">
                                {product.product_variants.length}
                              </strong>
                            </span>
                            <span>
                              Stock total:{" "}
                              <strong
                                className={
                                  totalStock > 0
                                    ? "text-emerald-700"
                                    : "text-rose-600"
                                }
                              >
                                {totalStock}
                              </strong>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Acciones del producto */}
                  <div className="flex flex-wrap items-center gap-2">
                    {product.has_shades === false ? (
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-xl border border-[#FAD4E4] bg-[#FFF1F5]/70 px-3 py-2 text-xs font-semibold text-[#B94470]">
                          Sin tonos
                        </span>
                        {singleVariant && (
                          <div className="flex items-center rounded-xl border border-[#FAD4E4] bg-white">
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickAdjustStock(singleVariant, -1)
                              }
                              disabled={
                                busyId === singleVariant.id ||
                                singleVariant.stock <= 0
                              }
                              title="Restar 1 al stock"
                              aria-label={`Restar stock de ${product.name}`}
                              className="cursor-pointer rounded-l-xl p-2 text-[#2D2226]/70 hover:bg-[#FFF1F5] hover:text-[#D85C8A] disabled:cursor-not-allowed disabled:opacity-35"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="min-w-7 text-center text-xs font-bold text-[#2D2226]">
                              {singleVariant.stock}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickAdjustStock(singleVariant, 1)
                              }
                              disabled={busyId === singleVariant.id}
                              title="Sumar 1 al stock"
                              aria-label={`Sumar stock de ${product.name}`}
                              className="cursor-pointer rounded-r-xl p-2 text-[#2D2226]/70 hover:bg-[#FFF1F5] hover:text-[#D85C8A] disabled:opacity-35"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedProductId(isExpanded ? null : product.id)
                        }
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#FAD4E4] bg-[#FFF1F5] px-3 py-2 text-xs font-semibold text-[#B94470] hover:bg-[#FAD4E4]/60"
                      >
                        <Palette className="h-3.5 w-3.5" />
                        Tonos ({product.product_variants.length})
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleToggleProductActive(product)}
                      disabled={busyId === product.id}
                      title={
                        product.is_active
                          ? "Ocultar de la tienda"
                          : "Activar en la tienda"
                      }
                      className="cursor-pointer rounded-xl border border-[#FAD4E4] p-2 text-[#2D2226]/70 hover:bg-[#FFF1F5] hover:text-[#D85C8A]"
                    >
                      {product.is_active ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditProduct(product)}
                      title="Editar producto"
                      className="cursor-pointer rounded-xl border border-[#FAD4E4] p-2 text-[#2D2226]/70 hover:bg-[#FFF1F5] hover:text-[#D85C8A]"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(product)}
                      disabled={busyId === product.id}
                      title="Eliminar producto"
                      className="cursor-pointer rounded-xl border border-rose-200 p-2 text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Sección expandible de tonos */}
                {isExpanded && product.has_shades !== false && (
                  <div className="border-t border-[#FAD4E4]/70 bg-[#FFF1F5]/40 p-4 sm:p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#B94470]">
                        Tonos de {product.name}
                      </h4>
                      <button
                        type="button"
                        onClick={() => openCreateVariant(product.id)}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#D85C8A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#B94470]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Agregar tono
                      </button>
                    </div>

                    {product.product_variants.length === 0 ? (
                      <p className="text-xs text-[#2D2226]/60">
                        Este producto todavía no tiene tonos. Agrega al menos un
                        tono con stock para que pueda comprarse en la tienda.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                        {product.product_variants.map((variant) => (
                          <div
                            key={variant.id}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-[#FAD4E4] bg-white p-3"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span
                                className="h-8 w-8 shrink-0 rounded-full ring-2 ring-[#FAD4E4]"
                                style={{
                                  backgroundColor:
                                    variant.shade_hex || "#F48FB1",
                                }}
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-[#2D2226]">
                                  {variant.shade_name}
                                </p>
                                <div className="flex items-center gap-2 text-[11px] text-[#2D2226]/65">
                                  <span
                                    className={
                                      variant.stock > 0
                                        ? "font-semibold text-emerald-700"
                                        : "font-semibold text-rose-600"
                                    }
                                  >
                                    Stock: {variant.stock}
                                  </span>
                                  <span>· {variant.shade_hex}</span>
                                  {!variant.is_active && (
                                    <span className="text-amber-600">
                                      (Oculto)
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-1">
                              <div className="mr-1 flex items-center rounded-lg border border-[#FAD4E4] bg-[#FFF1F5]/50">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleQuickAdjustStock(variant, -1)
                                  }
                                  disabled={
                                    busyId === variant.id || variant.stock <= 0
                                  }
                                  title="Restar 1 al stock"
                                  aria-label={`Restar stock de ${variant.shade_name}`}
                                  className="cursor-pointer p-1 text-[#2D2226]/65 hover:text-[#D85C8A] disabled:cursor-not-allowed disabled:opacity-35"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleQuickAdjustStock(variant, 1)
                                  }
                                  disabled={busyId === variant.id}
                                  title="Sumar 1 al stock"
                                  aria-label={`Sumar stock de ${variant.shade_name}`}
                                  className="cursor-pointer p-1 text-[#2D2226]/65 hover:text-[#D85C8A] disabled:opacity-35"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => openEditVariant(variant)}
                                title="Editar tono"
                                className="cursor-pointer rounded-lg p-1.5 text-[#2D2226]/60 hover:bg-[#FFF1F5] hover:text-[#D85C8A]"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteVariant(variant)}
                                disabled={busyId === variant.id}
                                title="Eliminar tono"
                                className="cursor-pointer rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal Crear/Editar Producto */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2226]/45 p-4 backdrop-blur-[2px]">
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-[#FAD4E4] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#FAD4E4]/70 pb-3">
              <h3 className="text-xl font-extrabold tracking-tight text-[#2D2226]">
                {productForm.id ? "Editar producto" : "Nuevo producto"}
              </h3>
              <button
                type="button"
                onClick={() => setProductModalOpen(false)}
                className="cursor-pointer rounded-full p-1.5 text-[#2D2226]/60 hover:bg-[#FFF1F5]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#2D2226]/80">
                  Nombre del producto *
                </label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setProductForm((prev) => ({
                      ...prev,
                      name,
                      slug: prev.id ? prev.slug : slugify(name),
                    }));
                  }}
                  placeholder="Ej. Gloss Ultra Shine Bloomshell"
                  className="w-full rounded-xl border border-[#FAD4E4] px-3.5 py-2.5 text-sm focus:border-[#D85C8A] focus:outline-none"
                />
              </div>

              {/* Categoría y Marca: elegir existente o crear nueva */}
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                {/* Categoría */}
                <div className="rounded-2xl border border-[#FAD4E4]/80 bg-[#FFF1F5]/35 p-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label className="text-xs font-semibold text-[#2D2226]/85">
                      Categoría
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setCreatingCategory((prev) => !prev);
                        setNewCategoryName("");
                      }}
                      className="cursor-pointer text-[11px] font-bold text-[#D85C8A] hover:underline"
                    >
                      {creatingCategory ? "Elegir existente" : "+ Crear nueva"}
                    </button>
                  </div>

                  {creatingCategory ? (
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Nombre de nueva categoría..."
                      className="w-full rounded-xl border border-[#D85C8A]/60 bg-white px-3 py-2 text-sm focus:border-[#D85C8A] focus:outline-none"
                    />
                  ) : (
                    <select
                      value={productForm.category_id}
                      onChange={(e) => {
                        if (e.target.value === "__new__") {
                          setCreatingCategory(true);
                          setNewCategoryName("");
                        } else {
                          setProductForm((prev) => ({
                            ...prev,
                            category_id: e.target.value,
                          }));
                        }
                      }}
                      className="w-full rounded-xl border border-[#FAD4E4] bg-white px-3 py-2 text-sm focus:border-[#D85C8A] focus:outline-none"
                    >
                      <option value="">Sin categoría</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                      <option value="__new__">+ Crear nueva categoría...</option>
                    </select>
                  )}
                </div>

                {/* Marca */}
                <div className="rounded-2xl border border-[#FAD4E4]/80 bg-[#FFF1F5]/35 p-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label className="text-xs font-semibold text-[#2D2226]/85">
                      Marca
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setCreatingBrand((prev) => !prev);
                        setNewBrandName("");
                      }}
                      className="cursor-pointer text-[11px] font-bold text-[#D85C8A] hover:underline"
                    >
                      {creatingBrand ? "Elegir existente" : "+ Crear nueva"}
                    </button>
                  </div>

                  {creatingBrand ? (
                    <input
                      type="text"
                      value={newBrandName}
                      onChange={(e) => setNewBrandName(e.target.value)}
                      placeholder="Nombre de nueva marca..."
                      className="w-full rounded-xl border border-[#D85C8A]/60 bg-white px-3 py-2 text-sm focus:border-[#D85C8A] focus:outline-none"
                    />
                  ) : (
                    <select
                      value={productForm.brand_id}
                      onChange={(e) => {
                        if (e.target.value === "__new__") {
                          setCreatingBrand(true);
                          setNewBrandName("");
                        } else {
                          setProductForm((prev) => ({
                            ...prev,
                            brand_id: e.target.value,
                          }));
                        }
                      }}
                      className="w-full rounded-xl border border-[#FAD4E4] bg-white px-3 py-2 text-sm focus:border-[#D85C8A] focus:outline-none"
                    >
                      <option value="">Sin marca</option>
                      {brands.map((brand) => (
                        <option key={brand.id} value={brand.id}>
                          {brand.name}
                        </option>
                      ))}
                      <option value="__new__">+ Crear nueva marca...</option>
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#2D2226]/80">
                  Slug (URL) *
                </label>
                <input
                  type="text"
                  required
                  value={productForm.slug}
                  onChange={(e) =>
                    setProductForm((prev) => ({
                      ...prev,
                      slug: slugify(e.target.value),
                    }))
                  }
                  placeholder="gloss-ultra-shine-bloomshell"
                  className="w-full rounded-xl border border-[#FAD4E4] px-3.5 py-2.5 text-sm focus:border-[#D85C8A] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#2D2226]/80">
                    Precio detal (COP) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={productForm.retail_price}
                    onChange={(e) =>
                      setProductForm((prev) => ({
                        ...prev,
                        retail_price: e.target.value,
                      }))
                    }
                    placeholder="28000"
                    className="w-full rounded-xl border border-[#FAD4E4] px-3.5 py-2.5 text-sm focus:border-[#D85C8A] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#2D2226]/80">
                    Precio mayorista (COP) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={productForm.wholesale_price}
                    onChange={(e) =>
                      setProductForm((prev) => ({
                        ...prev,
                        wholesale_price: e.target.value,
                      }))
                    }
                    placeholder="21000"
                    className="w-full rounded-xl border border-[#FAD4E4] px-3.5 py-2.5 text-sm focus:border-[#D85C8A] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#2D2226]/80">
                  Descripción
                </label>
                <textarea
                  rows={2}
                  value={productForm.description}
                  onChange={(e) =>
                    setProductForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Acabado luminoso, textura ligera..."
                  className="w-full resize-none rounded-xl border border-[#FAD4E4] px-3.5 py-2 text-sm focus:border-[#D85C8A] focus:outline-none"
                />
              </div>

              {/* Galería de fotos del producto */}
              <div className="rounded-2xl border border-[#FAD4E4] bg-[#FFF1F5]/30 p-3.5">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#2D2226]/85">
                    Fotos del producto ({productForm.image_urls.length})
                  </label>
                  <span className="text-[11px] text-[#2D2226]/55">
                    La primera foto será la portada
                  </span>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#FAD4E4] bg-white px-3.5 py-2 text-xs font-semibold text-[#B94470] shadow-2xs hover:bg-[#FAD4E4]/40">
                    {uploadingProductImg ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {uploadingProductImg ? "Subiendo..." : "Subir fotos"}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleUploadProductPhotos}
                      disabled={uploadingProductImg}
                      className="hidden"
                    />
                  </label>

                  <div className="flex flex-1 gap-1.5">
                    <input
                      type="url"
                      value={photoUrlInput}
                      onChange={(e) => setPhotoUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddPhotoUrl();
                        }
                      }}
                      placeholder="O pega una URL de imagen..."
                      className="min-w-0 flex-1 rounded-xl border border-[#FAD4E4] bg-white px-3 py-2 text-xs focus:border-[#D85C8A] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddPhotoUrl}
                      className="shrink-0 cursor-pointer rounded-xl bg-[#FAD4E4]/70 px-3 py-2 text-xs font-semibold text-[#B94470] hover:bg-[#FAD4E4]"
                    >
                      Añadir
                    </button>
                  </div>
                </div>

                {productForm.image_urls.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                    {productForm.image_urls.map((url, idx) => (
                      <div
                        key={`${url}-${idx}`}
                        className={`group relative overflow-hidden rounded-2xl border bg-white p-1 ${
                          idx === 0
                            ? "border-[#D85C8A] ring-2 ring-[#D85C8A]/25"
                            : "border-[#FAD4E4]"
                        }`}
                      >
                        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#FFF1F5]">
                          <Image
                            src={url}
                            alt={`Foto ${idx + 1}`}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          title="Quitar foto"
                          className="absolute right-2 top-2 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-[#2D2226]/75 text-white hover:bg-rose-600"
                        >
                          <X className="h-3 w-3" />
                        </button>

                        {idx === 0 ? (
                          <span className="mt-1 flex items-center justify-center gap-1 rounded-lg bg-[#D85C8A] py-0.5 text-[10px] font-bold text-white">
                            <Star className="h-2.5 w-2.5 fill-current" />
                            Portada
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSetCoverPhoto(idx)}
                            className="mt-1 w-full cursor-pointer rounded-lg bg-[#FFF1F5] py-0.5 text-[10px] font-semibold text-[#B94470] hover:bg-[#FAD4E4]"
                          >
                            Usar portada
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Configuración de tonos */}
              <div className="space-y-3 rounded-2xl border border-[#FAD4E4] bg-[#FFF1F5]/35 p-3.5">
                <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-[#2D2226]">
                  <input
                    type="checkbox"
                    checked={productForm.has_shades}
                    onChange={(e) =>
                      setProductForm((prev) => ({
                        ...prev,
                        has_shades: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-[#D85C8A]"
                  />
                  Este producto funciona con tonos
                </label>

                {!productForm.has_shades && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#2D2226]/80">
                      Stock disponible *
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={productForm.default_stock}
                      onChange={(e) =>
                        setProductForm((prev) => ({
                          ...prev,
                          default_stock: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-[#FAD4E4] bg-white px-3.5 py-2 text-sm focus:border-[#D85C8A] focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-[#2D2226]">
                <input
                  type="checkbox"
                  checked={productForm.is_active}
                  onChange={(e) =>
                    setProductForm((prev) => ({
                      ...prev,
                      is_active: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-[#D85C8A]"
                />
                Producto visible en la tienda pública
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="cursor-pointer rounded-xl border border-[#FAD4E4] px-4 py-2.5 text-sm font-semibold text-[#2D2226] hover:bg-[#FFF1F5]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingProduct || uploadingProductImg}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#D85C8A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#B94470] disabled:opacity-60"
                >
                  {savingProduct ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Guardar producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Crear/Editar Tono */}
      {variantForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2226]/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-3xl border border-[#FAD4E4] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#FAD4E4]/70 pb-3">
              <h3 className="text-xl font-extrabold tracking-tight text-[#2D2226]">
                {variantForm.id ? "Editar tono" : "Nuevo tono"}
              </h3>
              <button
                type="button"
                onClick={() => setVariantForm(null)}
                className="cursor-pointer rounded-full p-1.5 text-[#2D2226]/60 hover:bg-[#FFF1F5]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVariant} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#2D2226]/80">
                  Nombre del tono *
                </label>
                <input
                  type="text"
                  required
                  value={variantForm.shade_name}
                  onChange={(e) =>
                    setVariantForm((prev) =>
                      prev ? { ...prev, shade_name: e.target.value } : prev
                    )
                  }
                  placeholder="Ej. 01 Rose Nude"
                  className="w-full rounded-xl border border-[#FAD4E4] px-3.5 py-2.5 text-sm focus:border-[#D85C8A] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#2D2226]/80">
                    Color (#hex) *
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={variantForm.shade_hex}
                      onChange={(e) =>
                        setVariantForm((prev) =>
                          prev ? { ...prev, shade_hex: e.target.value } : prev
                        )
                      }
                      className="h-10 w-12 cursor-pointer rounded-lg border border-[#FAD4E4] bg-white p-1"
                    />
                    <input
                      type="text"
                      required
                      value={variantForm.shade_hex}
                      onChange={(e) =>
                        setVariantForm((prev) =>
                          prev ? { ...prev, shade_hex: e.target.value } : prev
                        )
                      }
                      placeholder="#E68AA8"
                      className="w-full rounded-xl border border-[#FAD4E4] px-3 py-2 text-sm uppercase focus:border-[#D85C8A] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#2D2226]/80">
                    Stock *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={variantForm.stock}
                    onChange={(e) =>
                      setVariantForm((prev) =>
                        prev ? { ...prev, stock: e.target.value } : prev
                      )
                    }
                    className="w-full rounded-xl border border-[#FAD4E4] px-3.5 py-2.5 text-sm focus:border-[#D85C8A] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#2D2226]/80">
                  Foto específica del tono (opcional)
                </label>
                <div className="flex items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#FAD4E4] bg-[#FFF1F5] px-3 py-2 text-xs font-semibold text-[#B94470] hover:bg-[#FAD4E4]/60">
                    {uploadingVariantImg ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    Subir foto
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadVariantPhoto}
                      disabled={uploadingVariantImg}
                      className="hidden"
                    />
                  </label>
                  <input
                    type="url"
                    value={variantForm.image_url}
                    onChange={(e) =>
                      setVariantForm((prev) =>
                        prev ? { ...prev, image_url: e.target.value } : prev
                      )
                    }
                    placeholder="URL opcional..."
                    className="flex-1 rounded-xl border border-[#FAD4E4] px-3 py-2 text-xs focus:border-[#D85C8A] focus:outline-none"
                  />
                </div>
                {variantForm.image_url && (
                  <div className="mt-2 flex items-center gap-2">
                    <Image
                      src={variantForm.image_url}
                      alt="Foto tono"
                      width={48}
                      height={48}
                      unoptimized
                      className="h-12 w-12 rounded-xl border border-[#FAD4E4] object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setVariantForm((prev) =>
                          prev ? { ...prev, image_url: "" } : prev
                        )
                      }
                      className="cursor-pointer text-xs text-rose-600 hover:underline"
                    >
                      Quitar
                    </button>
                  </div>
                )}
              </div>

              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-[#2D2226]">
                <input
                  type="checkbox"
                  checked={variantForm.is_active}
                  onChange={(e) =>
                    setVariantForm((prev) =>
                      prev ? { ...prev, is_active: e.target.checked } : prev
                    )
                  }
                  className="h-4 w-4 accent-[#D85C8A]"
                />
                Tono activo en la tienda
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVariantForm(null)}
                  className="cursor-pointer rounded-xl border border-[#FAD4E4] px-4 py-2.5 text-sm font-semibold text-[#2D2226] hover:bg-[#FFF1F5]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingVariant || uploadingVariantImg}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#D85C8A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#B94470] disabled:opacity-60"
                >
                  {savingVariant ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Guardar tono
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
