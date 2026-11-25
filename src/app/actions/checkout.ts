"use server";

import { createPublicClient } from "@/lib/supabase/public";
import { buildWhatsAppOrderUrl, generateOrderNumber } from "@/lib/format";
import type { CartItem } from "@/types/database";

export interface CheckoutItemInput {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface SubmitOrderInput {
  customerName: string;
  customerPhone: string;
  customerCity?: string;
  notes?: string;
  items: CheckoutItemInput[];
}

export interface SubmitOrderResult {
  ok: true;
  orderNumber: number;
  whatsappUrl: string;
  totalAmount: number;
  appliedWholesale: boolean;
  savings: number;
}

export interface SubmitOrderError {
  ok: false;
  error: string;
}

interface ProductRow {
  id: string;
  name: string;
  retail_price: number;
  wholesale_price: number;
  image_url: string | null;
  is_active: boolean;
}

interface VariantRow {
  id: string;
  product_id: string;
  shade_name: string;
  shade_hex: string;
  stock: number;
  image_url: string | null;
  is_active: boolean;
}

interface SettingsRow {
  store_name: string;
  wholesale_threshold: number;
  whatsapp_number: string;
}

export async function submitOrder(
  input: SubmitOrderInput
): Promise<SubmitOrderResult | SubmitOrderError> {
  try {
    const trimmedName = input.customerName?.trim() ?? "";
    const trimmedPhone = input.customerPhone?.trim() ?? "";
    const trimmedCity = input.customerCity?.trim() ?? "";
    const trimmedNotes = input.notes?.trim() ?? "";

    if (!trimmedName || !trimmedPhone) {
      return {
        ok: false,
        error: "Por favor ingresa tu nombre y tu número de WhatsApp.",
      };
    }

    if (!Array.isArray(input.items) || input.items.length === 0) {
      return { ok: false, error: "Tu carrito está vacío." };
    }

    // Consolidar cantidades por par productId:variantId
    const mergedMap = new Map<string, CheckoutItemInput>();
    for (const raw of input.items) {
      const qty = Math.floor(Number(raw.quantity) || 0);
      if (!raw.productId || !raw.variantId || qty <= 0) {
        return {
          ok: false,
          error: "Uno de los productos del carrito tiene una cantidad inválida.",
        };
      }
      const key = `${raw.productId}:${raw.variantId}`;
      const existing = mergedMap.get(key);
      if (existing) {
        existing.quantity += qty;
      } else {
        mergedMap.set(key, {
          productId: raw.productId,
          variantId: raw.variantId,
          quantity: qty,
        });
      }
    }

    const requestedItems = Array.from(mergedMap.values());
    const productIds = Array.from(
      new Set(requestedItems.map((item) => item.productId))
    );
    const variantIds = Array.from(
      new Set(requestedItems.map((item) => item.variantId))
    );

    const supabase = createPublicClient();

    const [settingsRes, productsRes, variantsRes] = await Promise.all([
      supabase
        .from("store_settings")
        .select("store_name, wholesale_threshold, whatsapp_number")
        .eq("id", 1)
        .maybeSingle(),
      supabase
        .from("products")
        .select(
          "id, name, retail_price, wholesale_price, image_url, is_active"
        )
        .in("id", productIds),
      supabase
        .from("product_variants")
        .select(
          "id, product_id, shade_name, shade_hex, stock, image_url, is_active"
        )
        .in("id", variantIds),
    ]);

    if (productsRes.error) {
      return { ok: false, error: productsRes.error.message };
    }
    if (variantsRes.error) {
      return { ok: false, error: variantsRes.error.message };
    }

    const settings = (settingsRes.data as SettingsRow | null) ?? {
      store_name: "ZOÉ COSMETICS",
      wholesale_threshold: 100000,
      whatsapp_number: "573007117844",
    };

    const productMap = new Map<string, ProductRow>();
    for (const p of (productsRes.data as ProductRow[] | null) ?? []) {
      productMap.set(p.id, p);
    }

    const variantMap = new Map<string, VariantRow>();
    for (const v of (variantsRes.data as VariantRow[] | null) ?? []) {
      variantMap.set(v.id, v);
    }

    // Validar existencia, estado activo y stock real en base de datos
    const verifiedItems: CartItem[] = [];
    for (const req of requestedItems) {
      const product = productMap.get(req.productId);
      const variant = variantMap.get(req.variantId);

      if (!product || !product.is_active) {
        return {
          ok: false,
          error:
            "Uno de los productos de tu carrito ya no está disponible. Actualiza la página.",
        };
      }

      if (!variant || !variant.is_active || variant.product_id !== product.id) {
        return {
          ok: false,
          error: `El tono seleccionado para "${product.name}" ya no está disponible.`,
        };
      }

      if (variant.stock < req.quantity) {
        return {
          ok: false,
          error:
            variant.stock <= 0
              ? `"${product.name} - ${variant.shade_name}" está agotado.`
              : `Solo quedan ${variant.stock} unidad(es) disponibles de "${product.name} - ${variant.shade_name}".`,
        };
      }

      verifiedItems.push({
        key: `${product.id}:${variant.id}`,
        productId: product.id,
        variantId: variant.id,
        productName: product.name,
        shadeName: variant.shade_name,
        shadeHex: variant.shade_hex || "#F48FB1",
        imageUrl: variant.image_url || product.image_url,
        retailPrice: product.retail_price,
        wholesalePrice: product.wholesale_price,
        maxStock: variant.stock,
        quantity: req.quantity,
      });
    }

    const wholesaleThreshold = settings.wholesale_threshold ?? 100000;
    const retailSubtotal = verifiedItems.reduce(
      (sum, item) => sum + item.retailPrice * item.quantity,
      0
    );
    const wholesaleSubtotal = verifiedItems.reduce(
      (sum, item) => sum + item.wholesalePrice * item.quantity,
      0
    );

    const appliedWholesale =
      verifiedItems.length > 0 && wholesaleSubtotal >= wholesaleThreshold;
    const totalAmount = appliedWholesale ? wholesaleSubtotal : retailSubtotal;
    const savings = appliedWholesale
      ? Math.max(0, retailSubtotal - wholesaleSubtotal)
      : 0;

    const orderId = crypto.randomUUID();
    let orderNumber = generateOrderNumber();

    let insertError = (
      await supabase.from("orders").insert({
        id: orderId,
        order_number: orderNumber,
        customer_name: trimmedName,
        customer_phone: trimmedPhone,
        customer_city: trimmedCity || null,
        notes: trimmedNotes || null,
        applied_wholesale: appliedWholesale,
        retail_subtotal: retailSubtotal,
        total_amount: totalAmount,
        status: "pendiente",
      })
    ).error;

    if (insertError?.code === "23505") {
      orderNumber = generateOrderNumber();
      insertError = (
        await supabase.from("orders").insert({
          id: orderId,
          order_number: orderNumber,
          customer_name: trimmedName,
          customer_phone: trimmedPhone,
          customer_city: trimmedCity || null,
          notes: trimmedNotes || null,
          applied_wholesale: appliedWholesale,
          retail_subtotal: retailSubtotal,
          total_amount: totalAmount,
          status: "pendiente",
        })
      ).error;
    }

    if (insertError) {
      return { ok: false, error: insertError.message };
    }

    const orderItemsPayload = verifiedItems.map((item) => {
      const unitPrice = appliedWholesale
        ? item.wholesalePrice
        : item.retailPrice;
      return {
        order_id: orderId,
        product_id: item.productId,
        variant_id: item.variantId,
        product_name: item.productName,
        shade_name: item.shadeName,
        quantity: item.quantity,
        unit_price_applied: unitPrice,
        line_total: unitPrice * item.quantity,
      };
    });

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItemsPayload);

    if (itemsError) {
      return { ok: false, error: itemsError.message };
    }

    const whatsappUrl = buildWhatsAppOrderUrl(settings.whatsapp_number, {
      storeName: settings.store_name || "ZOÉ COSMETICS",
      orderNumber,
      customerName: trimmedName,
      customerPhone: trimmedPhone,
      customerCity: trimmedCity,
      notes: trimmedNotes,
      appliedWholesale,
      retailSubtotal,
      totalAmount,
      savings,
      items: verifiedItems,
    });

    return {
      ok: true,
      orderNumber,
      whatsappUrl,
      totalAmount,
      appliedWholesale,
      savings,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "No pudimos registrar tu pedido. Intenta de nuevo.",
    };
  }
}
