"use client";

import { useState } from "react";
import { Edit3, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import type { Brand } from "@/types/database";
import { slugify } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { revalidateCatalog } from "@/app/admin/actions";

interface BrandsTabProps {
  brands: Brand[];
  onRefresh: () => Promise<void>;
}

export function BrandsTab({ brands, onRefresh }: BrandsTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const notify = (type: "success" | "error", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setSlug("");
    setSortOrder(String(brands.length));
  };

  const startEdit = (brand: Brand) => {
    setEditingId(brand.id);
    setName(brand.name);
    setSlug(brand.slug);
    setSortOrder(String(brand.sort_order));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        name: name.trim(),
        slug: slug.trim() || slugify(name),
        sort_order: Number(sortOrder) || 0,
      };

      if (editingId) {
        const { error } = await supabase
          .from("brands")
          .update(payload)
          .eq("id", editingId);
        if (error) throw new Error(error.message);
        notify("success", "Marca actualizada.");
      } else {
        const { error } = await supabase.from("brands").insert(payload);
        if (error) throw new Error(error.message);
        notify("success", "Marca creada.");
      }

      resetForm();
      await Promise.all([onRefresh(), revalidateCatalog()]);
    } catch (err) {
      notify(
        "error",
        err instanceof Error ? err.message : "Error al guardar la marca."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (brand: Brand) => {
    if (
      !window.confirm(
        `¿Eliminar la marca "${brand.name}"? Los productos asociados quedarán sin marca.`
      )
    ) {
      return;
    }
    setBusyId(brand.id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("brands")
        .delete()
        .eq("id", brand.id);
      if (error) throw new Error(error.message);
      notify("success", "Marca eliminada.");
      if (editingId === brand.id) resetForm();
      await Promise.all([onRefresh(), revalidateCatalog()]);
    } catch (err) {
      notify(
        "error",
        err instanceof Error ? err.message : "Error al eliminar la marca."
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-[family-name:var(--font-playfair)] text-2xl font-bold text-[#2D2226]">
          Marcas
        </h2>
        <p className="text-xs text-[#2D2226]/65 sm:text-sm">
          Administra las marcas del catálogo (Bloomshell, Samy, Prosa, Raquel,
          got2b, etc.).
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

      {/* Formulario crear / editar */}
      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-[#FAD4E4] bg-[#FFF1F5]/50 p-5"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#2D2226]">
            {editingId ? "Editando marca" : "Nueva marca"}
          </h3>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#B94470] hover:underline"
            >
              <X className="h-3.5 w-3.5" />
              Cancelar edición
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => {
              const val = e.target.value;
              setName(val);
              if (!editingId) setSlug(slugify(val));
            }}
            placeholder="Nombre (ej. Bloomshell)"
            className="rounded-xl border border-[#FAD4E4] bg-white px-3.5 py-2.5 text-sm focus:border-[#D85C8A] focus:outline-none"
          />
          <input
            type="text"
            required
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            placeholder="slug-marca"
            className="rounded-xl border border-[#FAD4E4] bg-white px-3.5 py-2.5 text-sm focus:border-[#D85C8A] focus:outline-none"
          />
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            placeholder="Orden (0)"
            className="rounded-xl border border-[#FAD4E4] bg-white px-3.5 py-2.5 text-sm focus:border-[#D85C8A] focus:outline-none"
          />
          <button
            type="submit"
            disabled={saving}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#D85C8A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#B94470] disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : editingId ? (
              <Save className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {editingId ? "Guardar" : "Crear"}
          </button>
        </div>
      </form>

      {/* Tabla / Lista */}
      <div className="overflow-hidden rounded-3xl border border-[#FAD4E4] bg-white">
        {brands.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#2D2226]/60">
            No hay marcas registradas todavía.
          </p>
        ) : (
          <ul className="divide-y divide-[#FAD4E4]/70">
            {brands.map((brand) => (
              <li
                key={brand.id}
                className="flex items-center justify-between gap-4 px-5 py-3.5"
              >
                <div>
                  <p className="font-semibold text-[#2D2226]">{brand.name}</p>
                  <p className="text-xs text-[#2D2226]/55">
                    Slug: <code>{brand.slug}</code> · Orden: {brand.sort_order}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => startEdit(brand)}
                    title="Editar"
                    className="cursor-pointer rounded-xl border border-[#FAD4E4] p-2 text-[#2D2226]/70 hover:bg-[#FFF1F5] hover:text-[#D85C8A]"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(brand)}
                    disabled={busyId === brand.id}
                    title="Eliminar"
                    className="cursor-pointer rounded-xl border border-rose-200 p-2 text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
