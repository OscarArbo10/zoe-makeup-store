# Zoe — Tienda de Maquillaje (Next.js + Supabase)

Web app completa en **Next.js (App Router, TypeScript y Tailwind CSS)** para la tienda de maquillaje **Zoe**, con catálogo público con selector visual de tonos, regla dinámica de precios al por mayor, checkout por WhatsApp y panel de administración (`/admin`).

## Funcionalidades

- **Catálogo público (`/`)**:
  - Filtro por categorías y buscador en tiempo real por producto o tono.
  - Selector visual de tonos (`product_variants`) con vista previa de color (`shade_hex`), cambio automático de foto por tono y bloqueo de tonos sin stock.
  - Carrito dinámico con regla de precio mayorista (`wholesale_threshold` desde `store_settings`, por defecto `$100.000` COP): barra de progreso cuando está por debajo y cambio automático a tarifa mayorista con cálculo de ahorro cuando se alcanza o supera.
  - Checkout por WhatsApp que registra el pedido en `orders` y `order_items` en Supabase y abre `https://wa.me/...` con el resumen formateado.
- **Panel de administración (`/admin` y `/admin/login`)**:
  - Protegido con Supabase Auth (`@supabase/ssr`), validando `user.app_metadata?.role === 'admin'`.
  - Gestión de **Productos y Tonos** (con carga de imágenes al bucket público `product-images`), **Categorías**, **Pedidos** (con cambio de estado y enlace rápido a WhatsApp) y **Configuración** (`wholesale_threshold` y `whatsapp_number`).

## Variables de entorno

Copia `.env.example` a `.env.local` y configura tus credenciales de Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

## Desarrollo local

```bash
npm install
npm run dev
```

## Despliegue en Vercel

1. Sube este repositorio a GitHub.
2. Importa el repositorio en Vercel.
3. Configura `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en **Project Settings → Environment Variables**.
4. Despliega.
