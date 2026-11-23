"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import type { StoreSettings } from "@/types/database";
import { formatCOP, sanitizePhoneForWhatsApp } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

interface SettingsTabProps {
  settings: StoreSettings;
  onRefresh: () => Promise<void>;
}

export function SettingsTab({ settings, onRefresh }: SettingsTabProps) {
  const [storeName, setStoreName] = useState(settings.store_name || "Zoe");
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
          store_name: storeName.trim() || "Zoe",
          wholesale_threshold: thresholdValue,
          whatsapp_number: cleanWhatsApp,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);

      if (error) throw new Error(error.message);

      setWhatsappNumber(cleanWhatsApp);
      setFeedback({
        type: "success",
        text: "Configuración guardada y aplicada en la tienda.",
      });
      await onRefresh();
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

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="font-[family-name:var(--font-playfair)] text-2xl font-bold text-[#2D2226]">
          Configuración de la tienda
        </h2>
        <p className="text-xs text-[#2D2226]/65 sm:text-sm">
          Define el monto mínimo para activar precios mayoristas y el WhatsApp
          donde recibirás los pedidos.
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
            en subtotal al detal.
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
            <code>https://wa.me/{sanitizePhoneForWhatsApp(whatsappNumber) || "..."}</code>.
          </p>
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
    </div>
  );
}
