"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  MessageCircle,
  Minus,
  Plus,
  ShoppingBag,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { CartItem, StoreSettings } from "@/types/database";
import {
  buildWhatsAppOrderUrl,
  formatCOP,
  generateOrderNumber,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  settings: StoreSettings;
  onUpdateQuantity: (key: string, delta: number) => void;
  onRemoveItem: (key: string) => void;
  onClearCart: () => void;
}

interface CompletedOrderInfo {
  orderNumber: number;
  whatsappUrl: string;
  totalAmount: number;
  appliedWholesale: boolean;
  savings: number;
}

export function CartDrawer({
  isOpen,
  onClose,
  items,
  settings,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
}: CartDrawerProps) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] =
    useState<CompletedOrderInfo | null>(null);

  if (!isOpen) return null;

  const wholesaleThreshold = settings.wholesale_threshold ?? 100000;
  const retailSubtotal = items.reduce(
    (acc, item) => acc + item.retailPrice * item.quantity,
    0
  );
  const wholesaleSubtotal = items.reduce(
    (acc, item) => acc + item.wholesalePrice * item.quantity,
    0
  );

  const appliedWholesale =
    items.length > 0 && retailSubtotal >= wholesaleThreshold;
  const totalAmount = appliedWholesale ? wholesaleSubtotal : retailSubtotal;
  const savings = appliedWholesale
    ? Math.max(0, retailSubtotal - wholesaleSubtotal)
    : 0;
  const remaining = Math.max(0, wholesaleThreshold - retailSubtotal);
  const progressPercent =
    wholesaleThreshold > 0
      ? Math.min(100, Math.round((retailSubtotal / wholesaleThreshold) * 100))
      : 100;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (items.length === 0) {
      setErrorMsg("Tu carrito está vacío.");
      return;
    }

    const trimmedName = customerName.trim();
    const trimmedPhone = customerPhone.trim();

    if (!trimmedName || !trimmedPhone) {
      setErrorMsg("Por favor ingresa tu nombre y tu número de WhatsApp.");
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createClient();
      const orderId = crypto.randomUUID();
      let orderNumber = generateOrderNumber();

      // Insertamos sin .select() para cumplir con RLS (anon tiene INSERT, no SELECT en orders)
      let insertError = (
        await supabase.from("orders").insert({
          id: orderId,
          order_number: orderNumber,
          customer_name: trimmedName,
          customer_phone: trimmedPhone,
          customer_city: customerCity.trim() || null,
          notes: notes.trim() || null,
          applied_wholesale: appliedWholesale,
          retail_subtotal: retailSubtotal,
          total_amount: totalAmount,
          status: "pendiente",
        })
      ).error;

      // Reintento único si existiera colisión de número de pedido (23505)
      if (insertError?.code === "23505") {
        orderNumber = generateOrderNumber();
        insertError = (
          await supabase.from("orders").insert({
            id: orderId,
            order_number: orderNumber,
            customer_name: trimmedName,
            customer_phone: trimmedPhone,
            customer_city: customerCity.trim() || null,
            notes: notes.trim() || null,
            applied_wholesale: appliedWholesale,
            retail_subtotal: retailSubtotal,
            total_amount: totalAmount,
            status: "pendiente",
          })
        ).error;
      }

      if (insertError) {
        throw new Error(insertError.message);
      }

      const orderItemsPayload = items.map((item) => {
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
        throw new Error(itemsError.message);
      }

      const whatsappUrl = buildWhatsAppOrderUrl(settings.whatsapp_number, {
        storeName: settings.store_name || "Zoe",
        orderNumber,
        customerName: trimmedName,
        customerPhone: trimmedPhone,
        customerCity: customerCity.trim(),
        notes: notes.trim(),
        appliedWholesale,
        retailSubtotal,
        totalAmount,
        savings,
        items,
      });

      // Abrir WhatsApp en una nueva pestaña
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");

      setCompletedOrder({
        orderNumber,
        whatsappUrl,
        totalAmount,
        appliedWholesale,
        savings,
      });

      onClearCart();
      setCustomerName("");
      setCustomerPhone("");
      setCustomerCity("");
      setNotes("");
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "No pudimos registrar tu pedido. Intenta de nuevo.";
      setErrorMsg(`Error al procesar el pedido: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseDrawer = () => {
    setCompletedOrder(null);
    setErrorMsg(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#2D2226]/40 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Carrito de compras"
    >
      {/* Overlay clickeable */}
      <div
        className="flex-1"
        onClick={handleCloseDrawer}
        aria-hidden="true"
      />

      {/* Panel derecho */}
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        {/* Header del carrito */}
        <div className="flex items-center justify-between border-b border-[#FAD4E4] bg-[#FFF1F5] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#D85C8A] text-white">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-[family-name:var(--font-playfair)] text-lg font-semibold text-[#2D2226]">
                Tu Carrito
              </h2>
              <p className="text-xs text-[#2D2226]/60">
                {items.reduce((sum, i) => sum + i.quantity, 0)} producto(s)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCloseDrawer}
            aria-label="Cerrar carrito"
            className="cursor-pointer rounded-full p-2 text-[#2D2226]/70 transition-colors hover:bg-[#FAD4E4]/60 hover:text-[#2D2226]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Estado de confirmación de pedido */}
        {completedOrder ? (
          <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF1F5] text-[#D85C8A] ring-8 ring-[#FFF1F5]/70">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <h3 className="mt-5 font-[family-name:var(--font-playfair)] text-2xl font-semibold text-[#2D2226]">
              ¡Pedido #{completedOrder.orderNumber} creado!
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#2D2226]/70">
              Registramos tu pedido y abrimos WhatsApp para que nos envíes el
              resumen y coordinemos tu entrega.
            </p>

            <div className="mt-5 w-full rounded-2xl border border-[#FAD4E4] bg-[#FFF1F5] p-4 text-left text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[#2D2226]/70">Número de pedido</span>
                <span className="font-bold text-[#2D2226]">
                  #{completedOrder.orderNumber}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[#2D2226]/70">Tarifa aplicada</span>
                <span className="font-semibold text-[#D85C8A]">
                  {completedOrder.appliedWholesale
                    ? "Al por mayor"
                    : "Al detal"}
                </span>
              </div>
              {completedOrder.savings > 0 && (
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[#2D2226]/70">Ahorraste</span>
                  <span className="font-semibold text-emerald-700">
                    {formatCOP(completedOrder.savings)}
                  </span>
                </div>
              )}
              <div className="mt-2.5 flex items-center justify-between border-t border-[#FAD4E4] pt-2.5 text-base font-bold text-[#2D2226]">
                <span>Total</span>
                <span>{formatCOP(completedOrder.totalAmount)}</span>
              </div>
            </div>

            <a
              href={completedOrder.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#D85C8A] px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#B94470]"
            >
              <MessageCircle className="h-4 w-4" />
              Abrir WhatsApp nuevamente
              <ExternalLink className="h-3.5 w-3.5" />
            </a>

            <button
              type="button"
              onClick={handleCloseDrawer}
              className="mt-3 w-full cursor-pointer rounded-2xl border border-[#FAD4E4] px-5 py-3 text-sm font-semibold text-[#2D2226] transition-colors hover:bg-[#FFF1F5]"
            >
              Seguir comprando
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF1F5] text-[#D85C8A]">
              <ShoppingBag className="h-7 w-7" />
            </div>
            <h3 className="mt-4 font-[family-name:var(--font-playfair)] text-xl font-semibold text-[#2D2226]">
              Tu carrito está vacío
            </h3>
            <p className="mt-1.5 max-w-xs text-sm text-[#2D2226]/65">
              Explora nuestros productos, elige tus tonos favoritos y activa
              precios al por mayor desde {formatCOP(wholesaleThreshold)}.
            </p>
            <button
              type="button"
              onClick={handleCloseDrawer}
              className="mt-6 cursor-pointer rounded-2xl bg-[#D85C8A] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#B94470]"
            >
              Ver catálogo
            </button>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-y-auto">
            {/* Barra de progreso o badge mayorista */}
            <div className="border-b border-[#FAD4E4]/70 bg-[#FFF1F5]/75 px-5 py-4">
              {appliedWholesale ? (
                <div className="rounded-2xl border border-[#D85C8A]/30 bg-white p-3.5 shadow-xs">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#D85C8A]">
                    <Sparkles className="h-4 w-4 shrink-0" />
                    <span>¡Precio al por mayor activado!</span>
                  </div>
                  <p className="mt-1 text-xs text-[#2D2226]/75">
                    Todo tu carrito bajó a tarifa mayorista. Estás ahorrando{" "}
                    <strong className="font-bold text-emerald-700">
                      {formatCOP(savings)}
                    </strong>
                    .
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between text-xs font-medium text-[#2D2226]">
                    <span>
                      Te faltan{" "}
                      <strong className="font-bold text-[#D85C8A]">
                        {formatCOP(remaining)}
                      </strong>{" "}
                      para activar precios al por mayor
                    </span>
                    <span className="font-semibold text-[#B94470]">
                      {progressPercent}%
                    </span>
                  </div>
                  <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-[#FAD4E4]/65">
                    <div
                      className="animate-zoe-shimmer h-full rounded-full bg-gradient-to-r from-[#D85C8A] via-[#F48FB1] to-[#D85C8A] transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-[#2D2226]/60">
                    Compra mínima mayorista: {formatCOP(wholesaleThreshold)} en
                    valor al detal.
                  </p>
                </div>
              )}
            </div>

            {/* Lista de ítems */}
            <ul className="divide-y divide-[#FAD4E4]/60 px-5">
              {items.map((item) => {
                const unitPrice = appliedWholesale
                  ? item.wholesalePrice
                  : item.retailPrice;
                const lineTotal = unitPrice * item.quantity;

                return (
                  <li key={item.key} className="flex gap-3.5 py-4">
                    {/* Miniatura */}
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-[#FAD4E4]/70 bg-[#FFF1F5]">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={`${item.productName} - ${item.shadeName}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <span
                            className="h-8 w-8 rounded-full border-2 border-white shadow-xs"
                            style={{ backgroundColor: item.shadeHex }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Detalles */}
                    <div className="flex flex-1 flex-col justify-between">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-semibold leading-tight text-[#2D2226]">
                            {item.productName}
                          </h4>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-[#2D2226]/70">
                            <span
                              className="inline-block h-3 w-3 rounded-full ring-1 ring-[#2D2226]/20"
                              style={{ backgroundColor: item.shadeHex }}
                            />
                            <span>{item.shadeName}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.key)}
                          aria-label={`Eliminar ${item.productName}`}
                          className="cursor-pointer rounded-lg p-1 text-[#2D2226]/45 transition-colors hover:bg-[#FFF1F5] hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between">
                        {/* Controles de cantidad */}
                        <div className="flex items-center rounded-xl border border-[#FAD4E4] bg-[#FFF1F5]/50">
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(item.key, -1)}
                            aria-label="Disminuir cantidad"
                            className="cursor-pointer px-2 py-1 text-[#2D2226] hover:text-[#D85C8A]"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-7 text-center text-xs font-bold text-[#2D2226]">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(item.key, 1)}
                            disabled={item.quantity >= item.maxStock}
                            aria-label="Aumentar cantidad"
                            className="cursor-pointer px-2 py-1 text-[#2D2226] hover:text-[#D85C8A] disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Precio */}
                        <div className="text-right">
                          {appliedWholesale && (
                            <span className="mr-1.5 text-[11px] text-[#2D2226]/45 line-through">
                              {formatCOP(item.retailPrice * item.quantity)}
                            </span>
                          )}
                          <span className="text-sm font-bold text-[#2D2226]">
                            {formatCOP(lineTotal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Resumen + Formulario WhatsApp */}
            <form
              onSubmit={handleCheckout}
              className="mt-auto border-t border-[#FAD4E4] bg-[#FFF1F5]/45 px-5 py-5"
            >
              {/* Totales */}
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between text-[#2D2226]/70">
                  <span>Subtotal al detal</span>
                  <span>{formatCOP(retailSubtotal)}</span>
                </div>
                {appliedWholesale && savings > 0 && (
                  <div className="flex items-center justify-between font-medium text-emerald-700">
                    <span>Ahorro al por mayor</span>
                    <span>-{formatCOP(savings)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-[#FAD4E4] pt-2 text-base font-bold text-[#2D2226]">
                  <span>Total a pagar</span>
                  <span className="text-[#D85C8A]">
                    {formatCOP(totalAmount)}
                  </span>
                </div>
              </div>

              {/* Datos del cliente */}
              <div className="mt-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#B94470]">
                  Tus datos para el pedido
                </p>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#2D2226]/80">
                    Nombre completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ej. María Fernanda López"
                    className="w-full rounded-xl border border-[#FAD4E4] bg-white px-3.5 py-2.5 text-sm text-[#2D2226] placeholder:text-[#2D2226]/35 focus:border-[#D85C8A] focus:outline-none focus:ring-2 focus:ring-[#D85C8A]/20"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#2D2226]/80">
                      Teléfono / WhatsApp *
                    </label>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="Ej. 300 123 4567"
                      className="w-full rounded-xl border border-[#FAD4E4] bg-white px-3.5 py-2.5 text-sm text-[#2D2226] placeholder:text-[#2D2226]/35 focus:border-[#D85C8A] focus:outline-none focus:ring-2 focus:ring-[#D85C8A]/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#2D2226]/80">
                      Ciudad (opcional)
                    </label>
                    <input
                      type="text"
                      value={customerCity}
                      onChange={(e) => setCustomerCity(e.target.value)}
                      placeholder="Ej. Medellín"
                      className="w-full rounded-xl border border-[#FAD4E4] bg-white px-3.5 py-2.5 text-sm text-[#2D2226] placeholder:text-[#2D2226]/35 focus:border-[#D85C8A] focus:outline-none focus:ring-2 focus:ring-[#D85C8A]/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#2D2226]/80">
                    Notas (opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Dirección, indicaciones de envío o comentarios..."
                    className="w-full resize-none rounded-xl border border-[#FAD4E4] bg-white px-3.5 py-2 text-sm text-[#2D2226] placeholder:text-[#2D2226]/35 focus:border-[#D85C8A] focus:outline-none focus:ring-2 focus:ring-[#D85C8A]/20"
                  />
                </div>
              </div>

              {errorMsg && (
                <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 border border-rose-200">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#D85C8A] px-5 py-3.5 text-sm font-semibold text-white shadow-md shadow-[#D85C8A]/25 transition-all hover:bg-[#B94470] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Registrando pedido...
                  </>
                ) : (
                  <>
                    <MessageCircle className="h-4 w-4" />
                    Pedir por WhatsApp ({formatCOP(totalAmount)})
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
