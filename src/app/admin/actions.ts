"use server";

import { updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/supabase/auth";
import type { OrderStatus } from "@/types/database";

const VALID_ORDER_STATUSES: ReadonlySet<OrderStatus> = new Set([
  "pendiente",
  "confirmado",
  "pagado",
  "enviado",
  "entregado",
  "cancelado",
]);

const CONFIRMED_STATUSES: ReadonlySet<OrderStatus> = new Set([
  "confirmado",
  "pagado",
  "enviado",
  "entregado",
]);

export type UpdateOrderStatusResult =
  | {
      ok: true;
      message: string;
      stockAction: "deducted" | "restored" | "none";
    }
  | { ok: false; error: string };

interface OrderItemRow {
  variant_id: string | null;
  product_name: string;
  shade_name: string;
  quantity: number;
}

export async function revalidateCatalog(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminUser(user)) {
    throw new Error("No autorizado para revalidar el catálogo.");
  }

  updateTag("catalog");
  return { ok: true };
}

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus
): Promise<UpdateOrderStatusResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!isAdminUser(user)) {
      return { ok: false, error: "No autorizado." };
    }

    if (!VALID_ORDER_STATUSES.has(newStatus)) {
      return { ok: false, error: "Estado de pedido inválido." };
    }

    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select(
        "id, order_number, status, order_items (variant_id, product_name, shade_name, quantity)"
      )
      .eq("id", orderId)
      .maybeSingle();

    if (fetchError || !order) {
      return { ok: false, error: "Pedido no encontrado." };
    }

    const currentStatus = order.status as OrderStatus;
    if (currentStatus === newStatus) {
      return {
        ok: true,
        stockAction: "none",
        message: `El pedido #${order.order_number} ya tiene ese estado.`,
      };
    }

    const wasConfirmed = CONFIRMED_STATUSES.has(currentStatus);
    const willBeConfirmed = CONFIRMED_STATUSES.has(newStatus);
    const rawItems = (order.order_items ?? []) as OrderItemRow[];

    const qtyByVariant = new Map<
      string,
      { quantity: number; label: string }
    >();
    for (const item of rawItems) {
      if (!item.variant_id || item.quantity <= 0) continue;
      const existing = qtyByVariant.get(item.variant_id);
      const label =
        item.shade_name && item.shade_name !== "Único"
          ? `${item.product_name} (${item.shade_name})`
          : item.product_name;
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        qtyByVariant.set(item.variant_id, {
          quantity: item.quantity,
          label,
        });
      }
    }

    const variantIds = Array.from(qtyByVariant.keys());

    // Descontar stock al pasar de pendiente/cancelado a confirmado/pagado/enviado/entregado
    if (!wasConfirmed && willBeConfirmed && variantIds.length > 0) {
      const { data: variants, error: variantsError } = await supabase
        .from("product_variants")
        .select("id, stock")
        .in("id", variantIds);

      if (variantsError || !variants) {
        return {
          ok: false,
          error:
            variantsError?.message ||
            "No se pudo verificar el stock de los productos.",
        };
      }

      const variantMap = new Map<string, number>();
      for (const v of variants) {
        variantMap.set(v.id as string, Number(v.stock ?? 0));
      }

      for (const [variantId, req] of qtyByVariant.entries()) {
        const currentStock = variantMap.get(variantId);
        if (currentStock === undefined) {
          return {
            ok: false,
            error: `El producto "${req.label}" ya no existe en el catálogo.`,
          };
        }
        if (currentStock < req.quantity) {
          return {
            ok: false,
            error: `Stock insuficiente para "${req.label}". Disponible: ${currentStock}, pedido: ${req.quantity}.`,
          };
        }
      }

      const appliedUpdates: { id: string; prevStock: number }[] = [];
      for (const [variantId, req] of qtyByVariant.entries()) {
        const prevStock = variantMap.get(variantId)!;
        const { error: updErr } = await supabase
          .from("product_variants")
          .update({ stock: prevStock - req.quantity })
          .eq("id", variantId);

        if (updErr) {
          for (const prev of appliedUpdates) {
            await supabase
              .from("product_variants")
              .update({ stock: prev.prevStock })
              .eq("id", prev.id);
          }
          return {
            ok: false,
            error: `Error al descontar stock de "${req.label}": ${updErr.message}`,
          };
        }
        appliedUpdates.push({ id: variantId, prevStock });
      }

      const { error: orderErr } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (orderErr) {
        for (const prev of appliedUpdates) {
          await supabase
            .from("product_variants")
            .update({ stock: prev.prevStock })
            .eq("id", prev.id);
        }
        return { ok: false, error: orderErr.message };
      }

      updateTag("catalog");
      return {
        ok: true,
        stockAction: "deducted",
        message: `Pedido #${order.order_number} actualizado y stock descontado.`,
      };
    }

    // Restaurar stock si un pedido confirmado se devuelve a pendiente o cancelado
    if (wasConfirmed && !willBeConfirmed && variantIds.length > 0) {
      const { data: variants, error: variantsError } = await supabase
        .from("product_variants")
        .select("id, stock")
        .in("id", variantIds);

      if (variantsError || !variants) {
        return {
          ok: false,
          error:
            variantsError?.message ||
            "No se pudo consultar el stock para restaurarlo.",
        };
      }

      const variantMap = new Map<string, number>();
      for (const v of variants) {
        variantMap.set(v.id as string, Number(v.stock ?? 0));
      }

      const appliedUpdates: { id: string; prevStock: number }[] = [];
      for (const [variantId, req] of qtyByVariant.entries()) {
        const prevStock = variantMap.get(variantId);
        if (prevStock === undefined) continue;
        const { error: updErr } = await supabase
          .from("product_variants")
          .update({ stock: prevStock + req.quantity })
          .eq("id", variantId);

        if (updErr) {
          for (const prev of appliedUpdates) {
            await supabase
              .from("product_variants")
              .update({ stock: prev.prevStock })
              .eq("id", prev.id);
          }
          return {
            ok: false,
            error: `Error al restaurar stock de "${req.label}": ${updErr.message}`,
          };
        }
        appliedUpdates.push({ id: variantId, prevStock });
      }

      const { error: orderErr } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (orderErr) {
        for (const prev of appliedUpdates) {
          await supabase
            .from("product_variants")
            .update({ stock: prev.prevStock })
            .eq("id", prev.id);
        }
        return { ok: false, error: orderErr.message };
      }

      updateTag("catalog");
      return {
        ok: true,
        stockAction: "restored",
        message: `Pedido #${order.order_number} actualizado y stock restaurado.`,
      };
    }

    const { error: orderErr } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    if (orderErr) {
      return { ok: false, error: orderErr.message };
    }

    return {
      ok: true,
      stockAction: "none",
      message: `Estado del pedido #${order.order_number} actualizado.`,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "No se pudo actualizar el estado del pedido.",
    };
  }
}
