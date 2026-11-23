import type { CartItem } from "@/types/database";

/**
 * Formatea un monto en pesos colombianos (COP) sin decimales, ej. "$28.000".
 */
export function formatCOP(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `$${new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(safe)}`;
}

/**
 * Genera un slug URL-friendly a partir de un texto.
 */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Limpia un número telefónico dejando únicamente dígitos para enlaces wa.me.
 */
export function sanitizePhoneForWhatsApp(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Genera un número de pedido entero de 6 dígitos usando Web Crypto.
 */
export function generateOrderNumber(): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return 100000 + (arr[0] % 900000);
}

export interface WhatsAppOrderMessageParams {
  storeName: string;
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  customerCity?: string;
  notes?: string;
  appliedWholesale: boolean;
  retailSubtotal: number;
  totalAmount: number;
  savings: number;
  items: CartItem[];
}

/**
 * Construye la URL de WhatsApp con el resumen completo del pedido.
 */
export function buildWhatsAppOrderUrl(
  whatsappNumber: string,
  params: WhatsAppOrderMessageParams
): string {
  const cleanPhone = sanitizePhoneForWhatsApp(whatsappNumber);
  const lines: string[] = [
    `Hola *${params.storeName}*! Quiero realizar el siguiente pedido:`,
    ``,
    `*Pedido #${params.orderNumber}*`,
    `*Cliente:* ${params.customerName}`,
    `*Teléfono:* ${params.customerPhone}`,
  ];

  if (params.customerCity?.trim()) {
    lines.push(`*Ciudad:* ${params.customerCity.trim()}`);
  }

  lines.push(
    `*Tarifa aplicada:* ${
      params.appliedWholesale ? "Precio al por mayor" : "Precio al detal"
    }`
  );
  lines.push(``, `*Productos:*`);

  for (const item of params.items) {
    const unitPrice = params.appliedWholesale
      ? item.wholesalePrice
      : item.retailPrice;
    const lineTotal = unitPrice * item.quantity;
    lines.push(
      `• ${item.productName} — Tono: ${item.shadeName} (x${item.quantity}) = ${formatCOP(
        lineTotal
      )}`
    );
  }

  lines.push(``);
  if (params.appliedWholesale && params.savings > 0) {
    lines.push(`*Subtotal al detal:* ${formatCOP(params.retailSubtotal)}`);
    lines.push(`*Ahorro mayorista:* -${formatCOP(params.savings)}`);
  }
  lines.push(`*Total a pagar:* ${formatCOP(params.totalAmount)}`);

  if (params.notes?.trim()) {
    lines.push(``, `*Notas:* ${params.notes.trim()}`);
  }

  lines.push(``, `Quedo atenta para confirmar el pago y envío. Gracias!`);

  const encoded = encodeURIComponent(lines.join("\n"));
  return `https://wa.me/${cleanPhone}?text=${encoded}`;
}
