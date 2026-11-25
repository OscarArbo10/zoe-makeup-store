"use client";

import { useState } from "react";
import Image from "next/image";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  MessageCircle,
  Minus,
  Plus,
  ShoppingBag,
  Sparkles,
  Store,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import type { CartItem, DeliveryMethod, StoreSettings } from "@/types/database";
import { formatCOP } from "@/lib/format";
import { submitOrder } from "@/app/actions/checkout";

const INPUT_CLASS =
  "w-full rounded-xl border border-[#FAD4E4] bg-white px-3.5 py-2.5 text-sm text-[#2D2226] placeholder:text-[#2D2226]/35 focus:border-[#D85C8A] focus:outline-none focus:ring-2 focus:ring-[#D85C8A]/20";
const LABEL_CLASS = "mb-1 block text-xs font-medium text-[#2D2226]/80";

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
  const [deliveryMethod, setDeliveryMethod] =
    useState<DeliveryMethod>("domicilio");
  const [customerAddress, setCustomerAddress] = useState("");
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
    items.length > 0 && wholesaleSubtotal >= wholesaleThreshold;
  const totalAmount = appliedWholesale ? wholesaleSubtotal : retailSubtotal;
  const savings = appliedWholesale
    ? Math.max(0, retailSubtotal - wholesaleSubtotal)
    : 0;
  const remaining = Math.max(0, wholesaleThreshold - wholesaleSubtotal);
  const progressPercent =
    wholesaleThreshold > 0
      ? Math.min(100, Math.round((wholesaleSubtotal / wholesaleThreshold) * 100))
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
    const trimmedAddress = customerAddress.trim();

    if (!trimmedName || !trimmedPhone) {
      setErrorMsg("Por favor ingresa tu nombre completo y número de celular.");
      return;
    }

    if (deliveryMethod === "domicilio" && !trimmedAddress) {
      setErrorMsg("Por favor ingresa tu dirección para el envío a domicilio.");
      return;
    }

    setSubmitting(true);

    try {
      const result = await submitOrder({
        customerName: trimmedName,
        customerPhone: trimmedPhone,
        deliveryMethod,
        customerAddress: deliveryMethod === "domicilio" ? trimmedAddress : "",
        items: items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      });

      if (!result.ok) {
        setErrorMsg(result.error);
        return;
      }

      // Abrir WhatsApp en una nueva pestaña
      window.open(result.whatsappUrl, "_blank", "noopener,noreferrer");

      setCompletedOrder({
        orderNumber: result.orderNumber,
        whatsappUrl: result.whatsappUrl,
        totalAmount: result.totalAmount,
        appliedWholesale: result.appliedWholesale,
        savings: result.savings,
      });

      onClearCart();
      setCustomerName("");
      setCustomerPhone("");
      setDeliveryMethod("domicilio");
      setCustomerAddress("");
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
              <h2 className="text-lg font-extrabold tracking-tight text-[#2D2226]">
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
            <h3 className="mt-5 text-2xl font-extrabold tracking-tight text-[#2D2226]">
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
            <h3 className="mt-4 text-xl font-extrabold tracking-tight text-[#2D2226]">
              Tu carrito está vacío
            </h3>
            <p className="mt-1.5 max-w-xs text-sm text-[#2D2226]/65">
              Explora nuestros productos, elige tus tonos favoritos y activa
              precios al por mayor al alcanzar {formatCOP(wholesaleThreshold)}{" "}
              en valor mayorista.
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
                      Te faltan solo{" "}
                      <strong className="font-bold text-[#D85C8A]">
                        {formatCOP(remaining)}
                      </strong>{" "}
                      para disfrutar de nuestros precios al por mayor
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
                    Mínimo mayorista: {formatCOP(wholesaleThreshold)} en valor
                    al por mayor (llevas {formatCOP(wholesaleSubtotal)}).
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
                        <Image
                          src={item.imageUrl}
                          alt={`${item.productName} - ${item.shadeName}`}
                          width={64}
                          height={64}
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
                          {item.shadeName && item.shadeName !== "Único" && (
                            <div className="mt-1 flex items-center gap-1.5 text-xs text-[#2D2226]/70">
                              <span
                                className="inline-block h-3 w-3 rounded-full ring-1 ring-[#2D2226]/20"
                                style={{ backgroundColor: item.shadeHex }}
                              />
                              <span>{item.shadeName}</span>
                            </div>
                          )}
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
                  <label className={LABEL_CLASS}>Nombre completo *</label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    autoComplete="name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ej. María Fernanda López"
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label className={LABEL_CLASS}>Número de celular *</label>
                  <input
                    type="tel"
                    required
                    maxLength={30}
                    autoComplete="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Ej. 300 123 4567"
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label className={LABEL_CLASS}>Tipo de entrega *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDeliveryMethod("domicilio")}
                      className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all ${
                        deliveryMethod === "domicilio"
                          ? "border-[#D85C8A] bg-[#D85C8A] text-white shadow-xs"
                          : "border-[#FAD4E4] bg-white text-[#2D2226] hover:bg-[#FFF1F5]"
                      }`}
                    >
                      <Truck className="h-4 w-4 shrink-0" />
                      Domicilio
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliveryMethod("recogida_en_tienda")}
                      className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all ${
                        deliveryMethod === "recogida_en_tienda"
                          ? "border-[#D85C8A] bg-[#D85C8A] text-white shadow-xs"
                          : "border-[#FAD4E4] bg-white text-[#2D2226] hover:bg-[#FFF1F5]"
                      }`}
                    >
                      <Store className="h-4 w-4 shrink-0" />
                      Recogida en tienda
                    </button>
                  </div>
                </div>

                {deliveryMethod === "domicilio" ? (
                  <div>
                    <label className={LABEL_CLASS}>Dirección *</label>
                    <input
                      type="text"
                      required
                      maxLength={200}
                      autoComplete="street-address"
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      placeholder="Ej. Calle 5 # 38-20, Barrio San Fernando"
                      className={INPUT_CLASS}
                    />
                  </div>
                ) : (
                  <p className="rounded-xl border border-[#FAD4E4] bg-[#FFF1F5]/70 px-3.5 py-2.5 text-xs font-medium text-[#B94470]">
                    Recogerás tu pedido directamente en tienda.
                  </p>
                )}
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
