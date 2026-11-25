"use server";

import { createPublicClient } from "@/lib/supabase/public";
import { buildWhatsAppOrderUrl } from "@/lib/format";
import type { CartItem } from "@/types/database";

export interface CheckoutItemInput {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface SubmitOrderInput {
  customerName: string;
  customerPhone: string;
  customerDocument: string;
  customerCity: string;
  customerAddress: string;
  customerNeighborhood: string;
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

interface RpcOrderResponse {
  order_number: number;
  applied_wholesale: boolean;
  retail_subtotal: number;
  total_amount: number;
  savings: number;
  store_name: string;
  whatsapp_number: string;
  items: CartItem[];
}

export async function submitOrder(
  input: SubmitOrderInput
): Promise<SubmitOrderResult | SubmitOrderError> {
  try {
    const trimmedName = input.customerName?.trim() ?? "";
    const trimmedPhone = input.customerPhone?.trim() ?? "";
    const trimmedCity = input.customerCity?.trim() ?? "";
    const trimmedDocument = input.customerDocument?.trim() ?? "";
    const trimmedAddress = input.customerAddress?.trim() ?? "";
    const trimmedNeighborhood = input.customerNeighborhood?.trim() ?? "";
    const trimmedNotes = input.notes?.trim() ?? "";

    if (
      !trimmedName ||
      !trimmedDocument ||
      !trimmedPhone ||
      !trimmedCity ||
      !trimmedAddress ||
      !trimmedNeighborhood
    ) {
      return {
        ok: false,
        error:
          "Completa nombre, cédula, celular/WhatsApp, ciudad, dirección y barrio.",
      };
    }

    if (
      trimmedName.length > 120 ||
      trimmedDocument.length > 30 ||
      trimmedPhone.length > 30 ||
      trimmedCity.length > 80 ||
      trimmedAddress.length > 200 ||
      trimmedNeighborhood.length > 100 ||
      trimmedNotes.length > 500
    ) {
      return {
        ok: false,
        error: "Uno de los campos supera la longitud máxima permitida.",
      };
    }

    if (!Array.isArray(input.items) || input.items.length === 0) {
      return { ok: false, error: "Tu carrito está vacío." };
    }

    if (input.items.length > 50) {
      return {
        ok: false,
        error: "Superaste el límite máximo de líneas por pedido (50).",
      };
    }

    const normalizedItems: CheckoutItemInput[] = [];
    for (const raw of input.items) {
      const qty = Math.floor(Number(raw.quantity) || 0);
      if (!raw.productId || !raw.variantId || qty <= 0 || qty > 500) {
        return {
          ok: false,
          error:
            "Uno de los productos del carrito tiene una cantidad inválida (1 a 500).",
        };
      }
      normalizedItems.push({
        productId: String(raw.productId),
        variantId: String(raw.variantId),
        quantity: qty,
      });
    }

    const supabase = createPublicClient();
    const { data, error } = await supabase.rpc("create_public_order", {
      p_customer_name: trimmedName,
      p_customer_document: trimmedDocument,
      p_customer_phone: trimmedPhone,
      p_customer_city: trimmedCity,
      p_customer_address: trimmedAddress,
      p_customer_neighborhood: trimmedNeighborhood,
      p_notes: trimmedNotes,
      p_items: normalizedItems,
    });

    if (error || !data) {
      return {
        ok: false,
        error:
          error?.message || "No pudimos registrar tu pedido. Intenta de nuevo.",
      };
    }

    const orderData = data as RpcOrderResponse;

    const whatsappUrl = buildWhatsAppOrderUrl(orderData.whatsapp_number, {
      storeName: orderData.store_name || "ZOÉ COSMETICS",
      orderNumber: orderData.order_number,
      customerName: trimmedName,
      customerPhone: trimmedPhone,
      customerDocument: trimmedDocument,
      customerCity: trimmedCity,
      customerAddress: trimmedAddress,
      customerNeighborhood: trimmedNeighborhood,
      notes: trimmedNotes,
      appliedWholesale: orderData.applied_wholesale,
      retailSubtotal: orderData.retail_subtotal,
      totalAmount: orderData.total_amount,
      savings: orderData.savings,
      items: orderData.items,
    });

    return {
      ok: true,
      orderNumber: orderData.order_number,
      whatsappUrl,
      totalAmount: orderData.total_amount,
      appliedWholesale: orderData.applied_wholesale,
      savings: orderData.savings,
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
