"use client";

import { useState } from "react";
import { Edit3, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import type { Category } from "@/types/database";
import { slugify } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { revalidateCatalog } from "@/app/admin/actions";

interface CategoriesTabProps {
  categories: Category[];
  onRefresh: () => Promise<void>;
}

export function CategoriesTab({ categories, onRefresh }: CategoriesTabProps) {
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
    setSortOrder(String(categories.length));
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setName(cat.name);
    setSlug(cat.slug);
    setSortOrder(String(cat.sort_order));
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
          .from("categories")
          .update(payload)
          .eq("id", editingId);
        if (error) throw new Error(error.message);
        notify("success", "Categoría actualizada.");
      } else {
        const { error } = await supabase.from("categories").insert(payload);
        if (error) throw new Error(error.message);
        notify("success", "Categoría creada.");
      }

      resetForm();
      await Promise.all([onRefresh(), revalidateCatalog()]);
    } catch (err) {
      notify(
        "error",
        err instanceof Error ? err.message : "Error al guardar la categoría."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: Category) => {
    if (
      !window.confirm(
        `¿Eliminar la categoría "${cat.name}"? Los productos asociados quedarán sin categoría.`
      )
    ) {
      return;
    }
    setBusyId(cat.id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", cat.id);
      if (error) throw new Error(error.message);
      notify("success", "Categoría eliminada.");
      if (editingId === cat.id) resetForm();
      await Promise.all([onRefresh(), revalidateCatalog()]);
    } catch (err) {
      notify(
        "error",
        err instanceof Error ? err.message : "Error al eliminar la categoría."
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-[#2D2226]">
          Categorías
        </h2>
        <p className="text-xs text-[#2D2226]/65 sm:text-sm">
          Organiza el catálogo de Zoe (Labios, Rostro, Ojos, Rubores, etc.).
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
            {editingId ? "Editando categoría" : "Nueva categoría"}
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
            placeholder="Nombre (ej. Labios)"
            className="rounded-xl border border-[#FAD4E4] bg-white px-3.5 py-2.5 text-sm focus:border-[#D85C8A] focus:outline-none"
          />
          <input
            type="text"
            required
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            placeholder="slug-url"
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
        {categories.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#2D2226]/60">
            No hay categorías registradas todavía.
          </p>
        ) : (
          <ul className="divide-y divide-[#FAD4E4]/70">
            {categories.map((cat) => (
              <li
                key={cat.id}
                className="flex items-center justify-between gap-4 px-5 py-3.5"
              >
                <div>
                  <p className="font-semibold text-[#2D2226]">{cat.name}</p>
                  <p className="text-xs text-[#2D2226]/55">
                    Slug: <code>{cat.slug}</code> · Orden: {cat.sort_order}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => startEdit(cat)}
                    title="Editar"
                    className="cursor-pointer rounded-xl border border-[#FAD4E4] p-2 text-[#2D2226]/70 hover:bg-[#FFF1F5] hover:text-[#D85C8A]"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(cat)}
                    disabled={busyId === cat.id}
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
