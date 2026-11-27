"use client";

import { useState } from "react";
import { KeyRound, Loader2, Save, ShieldCheck } from "lucide-react";
import type { ProductWithVariants, StoreSettings } from "@/types/database";
import { formatCOP, sanitizePhoneForWhatsApp } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { revalidateCatalog } from "@/app/admin/actions";

interface SettingsTabProps {
  userEmail: string;
  settings: StoreSettings;
  products: ProductWithVariants[];
  onRefresh: () => Promise<void>;
}

export function SettingsTab({
  userEmail,
  settings,
  products,
  onRefresh,
}: SettingsTabProps) {
  const [featuredProductId, setFeaturedProductId] = useState(
    settings.featured_product_id ?? ""
  );
  const [promoTitle, setPromoTitle] = useState(settings.promo_title ?? "");
  const [promoText, setPromoText] = useState(settings.promo_text ?? "");
  const [instagramUrl, setInstagramUrl] = useState(
    settings.instagram_url ?? ""
  );
  const [tiktokUrl, setTiktokUrl] = useState(settings.tiktok_url ?? "");
  const [storeName, setStoreName] = useState(
    settings.store_name || "ZOÉ COSMETICS"
  );
  const [wholesaleThreshold, setWholesaleThreshold] = useState(
    String(settings.wholesale_threshold ?? 100000)
  );
  const [whatsappNumber, setWhatsappNumber] = useState(
    settings.whatsapp_number || ""
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Cambio de contraseña
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const supabase = createClient();
      const thresholdValue = Math.max(
        0,
        Math.round(Number(wholesaleThreshold) || 0)
      );
      const cleanWhatsApp = sanitizePhoneForWhatsApp(whatsappNumber);

      if (!cleanWhatsApp) {
        throw new Error("Ingresa un número de WhatsApp válido con indicativo.");
      }

      const { error } = await supabase
        .from("store_settings")
        .update({
          store_name: storeName.trim() || "ZOÉ COSMETICS",
          wholesale_threshold: thresholdValue,
          whatsapp_number: cleanWhatsApp,
          featured_product_id: featuredProductId || null,
          promo_title: promoTitle.trim() || null,
          promo_text: promoText.trim() || null,
          instagram_url: instagramUrl.trim() || null,
          tiktok_url: tiktokUrl.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);

      if (error) throw new Error(error.message);

      setWhatsappNumber(cleanWhatsApp);
      setFeedback({
        type: "success",
        text: "Configuración guardada y aplicada en la tienda.",
      });
      await Promise.all([onRefresh(), revalidateCatalog()]);
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "No se pudo guardar la configuración.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

    if (!currentPassword) {
      setPasswordFeedback({
        type: "error",
        text: "Ingresa tu contraseña actual para confirmar tu identidad.",
      });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordFeedback({
        type: "error",
        text: "La nueva contraseña debe tener al menos 8 caracteres.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordFeedback({
        type: "error",
        text: "La confirmación no coincide con la nueva contraseña.",
      });
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordFeedback({
        type: "error",
        text: "La nueva contraseña debe ser diferente a la actual.",
      });
      return;
    }

    setSavingPassword(true);
    try {
      const supabase = createClient();

      // Verifica contraseña actual antes de actualizar
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });

      if (verifyError) {
        throw new Error("La contraseña actual es incorrecta.");
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordFeedback({
        type: "success",
        text: "Contraseña actualizada correctamente.",
      });
    } catch (err) {
      setPasswordFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "No se pudo actualizar la contraseña.",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-[#2D2226]">
          Configuración de la tienda
        </h2>
        <p className="text-xs text-[#2D2226]/65 sm:text-sm">
          Define el monto mínimo para activar precios mayoristas, WhatsApp de
          pedidos, producto destacado y redes sociales.
        </p>
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

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-3xl border border-[#FAD4E4] bg-white p-6 shadow-xs"
      >
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[#2D2226]/80">
            Nombre de la tienda
          </label>
          <input
            type="text"
            required
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            className="w-full rounded-xl border border-[#FAD4E4] bg-[#FFF1F5]/30 px-3.5 py-2.5 text-sm focus:border-[#D85C8A] focus:bg-white focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[#2D2226]/80">
            Monto mínimo mayorista (COP)
          </label>
          <input
            type="number"
            min={0}
            step={1000}
            required
            value={wholesaleThreshold}
            onChange={(e) => setWholesaleThreshold(e.target.value)}
            className="w-full rounded-xl border border-[#FAD4E4] bg-[#FFF1F5]/30 px-3.5 py-2.5 text-sm focus:border-[#D85C8A] focus:bg-white focus:outline-none"
          />
          <p className="mt-1.5 text-xs text-[#2D2226]/60">
            Valor actual mostrado en la tienda:{" "}
            <strong className="text-[#D85C8A]">
              {formatCOP(Number(wholesaleThreshold) || 0)}
            </strong>{" "}
            en subtotal al por mayor.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[#2D2226]/80">
            Número de WhatsApp de pedidos (con código de país, sin +)
          </label>
          <input
            type="text"
            required
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            placeholder="573001234567"
            className="w-full rounded-xl border border-[#FAD4E4] bg-[#FFF1F5]/30 px-3.5 py-2.5 text-sm focus:border-[#D85C8A] focus:bg-white focus:outline-none"
          />
          <p className="mt-1.5 text-xs text-[#2D2226]/60">
            Ejemplo Colombia: <code>573001234567</code>. Se usará en{" "}
            <code>
              https://wa.me/{sanitizePhoneForWhatsApp(whatsappNumber) || "..."}
            </code>
            .
          </p>
        </div>

        {/* Redes sociales */}
        <div className="space-y-4 rounded-2xl border border-[#FAD4E4] bg-[#FFF1F5]/40 p-4">
          <div>
            <p className="text-sm font-bold text-[#2D2226]">
              Redes sociales (pie de página)
            </p>
            <p className="text-xs text-[#2D2226]/60">
              Agrega los enlaces o usuarios de Instagram y TikTok para mostrar
              sus botones al final de la tienda. Déjalos vacíos si no deseas
              mostrarlos.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#2D2226]/80">
              Instagram
            </label>
            <input
              type="text"
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              placeholder="https://instagram.com/zoecosmeticscali o @zoecosmeticscali"
              className="w-full rounded-xl border border-[#FAD4E4] bg-white px-3.5 py-2.5 text-sm focus:border-[#D85C8A] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#2D2226]/80">
              TikTok
            </label>
            <input
              type="text"
              value={tiktokUrl}
              onChange={(e) => setTiktokUrl(e.target.value)}
              placeholder="https://tiktok.com/@zoecosmeticscali o @zoecosmeticscali"
              className="w-full rounded-xl border border-[#FAD4E4] bg-white px-3.5 py-2.5 text-sm focus:border-[#D85C8A] focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-[#FAD4E4] bg-[#FFF1F5]/40 p-4">
          <div>
            <p className="text-sm font-bold text-[#2D2226]">
              Producto destacado / promoción del inicio
            </p>
            <p className="text-xs text-[#2D2226]/60">
              Se muestra en el espacio del hero de la tienda, bajo el logo.
              Déjalo vacío para ocultarlo.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#2D2226]/80">
              Producto destacado
            </label>
            <select
              value={featuredProductId}
              onChange={(e) => setFeaturedProductId(e.target.value)}
              className="w-full rounded-xl border border-[#FAD4E4] bg-white px-3.5 py-2.5 text-sm focus:border-[#D85C8A] focus:outline-none"
            >
              <option value="">Ninguno</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.is_active ? "" : " (oculto)"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#2D2226]/80">
              Título de la promoción (opcional)
            </label>
            <input
              type="text"
              value={promoTitle}
              onChange={(e) => setPromoTitle(e.target.value)}
              placeholder="Ej. ¡Oferta de la semana!"
              className="w-full rounded-xl border border-[#FAD4E4] bg-white px-3.5 py-2.5 text-sm focus:border-[#D85C8A] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#2D2226]/80">
              Texto de la promoción (opcional)
            </label>
            <textarea
              rows={2}
              value={promoText}
              onChange={(e) => setPromoText(e.target.value)}
              placeholder="Ej. Lleva 3 y paga 2 en labiales Bloomshell."
              className="w-full resize-none rounded-xl border border-[#FAD4E4] bg-white px-3.5 py-2 text-sm focus:border-[#D85C8A] focus:outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-[#D85C8A] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#B94470] disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Guardar cambios
        </button>
      </form>

      {/* Seguridad: Cambio de contraseña */}
      <form
        onSubmit={handleChangePassword}
        className="space-y-4 rounded-3xl border border-[#FAD4E4] bg-white p-6 shadow-xs"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FFF1F5] text-[#D85C8A]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold tracking-tight text-[#2D2226]">
              Seguridad · Cambiar contraseña
            </h3>
            <p className="text-xs text-[#2D2226]/65">
              Cuenta conectada: <strong>{userEmail}</strong>. Por seguridad te
              pedimos confirmar tu contraseña actual.
            </p>
          </div>
        </div>

        {passwordFeedback && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
              passwordFeedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {passwordFeedback.text}
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[#2D2226]/80">
            Contraseña actual *
          </label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl border border-[#FAD4E4] bg-[#FFF1F5]/30 px-3.5 py-2.5 text-sm focus:border-[#D85C8A] focus:bg-white focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#2D2226]/80">
              Nueva contraseña * (mín. 8 caracteres)
            </label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full rounded-xl border border-[#FAD4E4] bg-[#FFF1F5]/30 px-3.5 py-2.5 text-sm focus:border-[#D85C8A] focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#2D2226]/80">
              Confirmar nueva contraseña *
            </label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la nueva contraseña"
              className="w-full rounded-xl border border-[#FAD4E4] bg-[#FFF1F5]/30 px-3.5 py-2.5 text-sm focus:border-[#D85C8A] focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={savingPassword}
          className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-[#FAD4E4] bg-[#FFF1F5] px-5 py-2.5 text-sm font-semibold text-[#B94470] transition-colors hover:bg-[#FAD4E4]/60 disabled:opacity-60"
        >
          {savingPassword ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <KeyRound className="h-4 w-4" />
          )}
          Actualizar contraseña
        </button>
      </form>
    </div>
  );
}
