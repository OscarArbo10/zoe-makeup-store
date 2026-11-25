"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Sparkles,
} from "lucide-react";
import {
  ORDER_STATUSES,
  type OrderStatus,
  type OrderWithItems,
} from "@/types/database";
import { formatCOP, sanitizePhoneForWhatsApp } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

interface OrdersTabProps {
  orders: OrderWithItems[];
  storeName: string;
  onRefresh: () => Promise<void>;
}

export function OrdersTab({ orders, storeName, onRefresh }: OrdersTabProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const order of orders) {
      counts[order.status] = (counts[order.status] ?? 0) + 1;
    }
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === "all") return orders;
    return orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  const handleStatusChange = async (
    orderId: string,
    newStatus: OrderStatus
  ) => {
    setUpdatingId(orderId);
    setErrorMsg(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);
      if (error) throw new Error(error.message);
      await onRefresh();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "No se pudo actualizar el estado del pedido."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusMeta = (status: OrderStatus) =>
    ORDER_STATUSES.find((s) => s.value === status) ?? ORDER_STATUSES[0];

  const buildCustomerWhatsAppLink = (order: OrderWithItems) => {
    let phone = sanitizePhoneForWhatsApp(order.customer_phone);
    // Si tiene 10 dígitos (celular Colombia sin indicativo), anteponer 57
    if (phone.length === 10) {
      phone = `57${phone}`;
    }
    const text = encodeURIComponent(
      `Hola ${order.customer_name}! Te escribimos de ${storeName} respecto a tu pedido #${order.order_number} por ${formatCOP(
        order.total_amount
      )}.`
    );
    return `https://wa.me/${phone}?text=${text}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-[family-name:var(--font-playfair)] text-2xl font-bold text-[#2D2226]">
          Pedidos recibidos
        </h2>
        <p className="text-xs text-[#2D2226]/65 sm:text-sm">
          Consulta el detalle de productos y tonos, escribe al cliente por
          WhatsApp y actualiza el estado.
        </p>
      </div>

      {/* Filtro por estado */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            statusFilter === "all"
              ? "bg-[#D85C8A] text-white"
              : "bg-[#FFF1F5] text-[#2D2226] hover:bg-[#FAD4E4]/70"
          }`}
        >
          Todos ({orders.length})
        </button>
        {ORDER_STATUSES.map((st) => {
          const count = statusCounts[st.value] ?? 0;
          return (
            <button
              key={st.value}
              type="button"
              onClick={() => setStatusFilter(st.value)}
              className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === st.value
                  ? "bg-[#D85C8A] text-white"
                  : "bg-[#FFF1F5] text-[#2D2226] hover:bg-[#FAD4E4]/70"
              }`}
            >
              {st.label} ({count})
            </button>
          );
        })}
      </div>

      {errorMsg && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMsg}
        </div>
      )}

      {/* Lista de pedidos */}
      {filteredOrders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#FAD4E4] bg-[#FFF1F5]/40 p-12 text-center text-sm text-[#2D2226]/65">
          No hay pedidos en esta categoría todavía.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const statusMeta = getStatusMeta(order.status);
            const savings = order.applied_wholesale
              ? Math.max(0, order.retail_subtotal - order.total_amount)
              : 0;

            return (
              <div
                key={order.id}
                className="overflow-hidden rounded-3xl border border-[#FAD4E4] bg-white shadow-xs"
              >
                {/* Cabecera del pedido */}
                <div className="flex flex-col gap-4 border-b border-[#FAD4E4]/60 bg-[#FFF1F5]/50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-bold text-[#2D2226]">
                        Pedido #{order.order_number}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusMeta.badgeClass}`}
                      >
                        {statusMeta.label}
                      </span>
                      {order.applied_wholesale && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#D85C8A] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                          <Sparkles className="h-3 w-3" />
                          Mayorista
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#2D2226]/70">
                      <span className="font-semibold text-[#2D2226]">
                        {order.customer_name}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3 text-[#D85C8A]" />
                        {order.customer_phone}
                      </span>
                      {order.customer_city && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-[#D85C8A]" />
                          {[
                            order.customer_document
                              ? `CC ${order.customer_document}`
                              : null,
                            order.customer_city,
                            order.customer_neighborhood,
                            order.customer_address,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-[#D85C8A]" />
                        {new Date(order.created_at).toLocaleString("es-CO", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Controles: WhatsApp + Estado */}
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={buildCustomerWhatsAppLink(order)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      WhatsApp cliente
                    </a>

                    <select
                      value={order.status}
                      disabled={updatingId === order.id}
                      onChange={(e) =>
                        handleStatusChange(
                          order.id,
                          e.target.value as OrderStatus
                        )
                      }
                      aria-label={`Estado del pedido #${order.order_number}`}
                      className="cursor-pointer rounded-xl border border-[#FAD4E4] bg-white px-3 py-2 text-xs font-semibold text-[#2D2226] focus:border-[#D85C8A] focus:outline-none disabled:opacity-50"
                    >
                      {ORDER_STATUSES.map((st) => (
                        <option key={st.value} value={st.value}>
                          {st.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Detalle de productos */}
                <div className="p-4 sm:p-5">
                  <div className="space-y-2">
                    {order.order_items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-2xl bg-[#FFF1F5]/35 px-3.5 py-2.5 text-sm"
                      >
                        <div className="flex items-center gap-2.5">
                          <Package className="h-4 w-4 shrink-0 text-[#D85C8A]" />
                          <div>
                            <span className="font-semibold text-[#2D2226]">
                              {item.product_name}
                            </span>{" "}
                            <span className="rounded-full bg-[#FAD4E4]/60 px-2 py-0.5 text-xs font-medium text-[#B94470]">
                              Tono: {item.shade_name}
                            </span>
                            <span className="ml-2 text-xs text-[#2D2226]/60">
                              x{item.quantity} ({formatCOP(item.unit_price_applied)} c/u)
                            </span>
                          </div>
                        </div>
                        <span className="font-bold text-[#2D2226]">
                          {formatCOP(item.line_total)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {order.notes && (
                    <p className="mt-3 rounded-xl border border-[#FAD4E4]/70 bg-[#FFF1F5]/30 px-3.5 py-2 text-xs text-[#2D2226]/75">
                      <strong>Notas:</strong> {order.notes}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center justify-end gap-4 border-t border-[#FAD4E4]/60 pt-3 text-sm">
                    <span className="text-[#2D2226]/65">
                      Subtotal detal:{" "}
                      <strong>{formatCOP(order.retail_subtotal)}</strong>
                    </span>
                    {savings > 0 && (
                      <span className="font-medium text-emerald-700">
                        Ahorro mayorista: -{formatCOP(savings)}
                      </span>
                    )}
                    <span className="text-base font-bold text-[#D85C8A]">
                      Total: {formatCOP(order.total_amount)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
