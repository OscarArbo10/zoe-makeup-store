export type OrderStatus =
  | "pendiente"
  | "confirmado"
  | "pagado"
  | "enviado"
  | "entregado"
  | "cancelado";

export const ORDER_STATUSES: {
  value: OrderStatus;
  label: string;
  badgeClass: string;
}[] = [
  {
    value: "pendiente",
    label: "Pendiente",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    value: "confirmado",
    label: "Confirmado",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
  },
  {
    value: "pagado",
    label: "Pagado",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    value: "enviado",
    label: "Enviado",
    badgeClass: "bg-violet-50 text-violet-700 border-violet-200",
  },
  {
    value: "entregado",
    label: "Entregado",
    badgeClass: "bg-pink-50 text-[#B94470] border-[#FAD4E4]",
  },
  {
    value: "cancelado",
    label: "Cancelado",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
  },
];

export interface StoreSettings {
  id: number;
  store_name: string;
  wholesale_threshold: number;
  whatsapp_number: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  created_at: string;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  shade_name: string;
  shade_hex: string;
  stock: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  category_id: string | null;
  brand_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  retail_price: number;
  wholesale_price: number;
  image_url: string | null;
  image_urls: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductWithVariants extends Product {
  category?: Category | null;
  brand?: Brand | null;
  product_variants: ProductVariant[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  shade_name: string;
  quantity: number;
  unit_price_applied: number;
  line_total: number;
}

export interface Order {
  id: string;
  order_number: number;
  customer_name: string;
  customer_phone: string;
  customer_city: string | null;
  notes: string | null;
  applied_wholesale: boolean;
  retail_subtotal: number;
  total_amount: number;
  status: OrderStatus;
  created_at: string;
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[];
}

export interface CartItem {
  key: string; // `${productId}:${variantId}`
  productId: string;
  variantId: string;
  productName: string;
  shadeName: string;
  shadeHex: string;
  imageUrl: string | null;
  retailPrice: number;
  wholesalePrice: number;
  maxStock: number;
  quantity: number;
}
