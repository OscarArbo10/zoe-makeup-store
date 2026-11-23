"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Heart, Loader2, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isAdminUser } from "@/lib/supabase/auth";

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const unauthorizedParam = searchParams.get("error") === "unauthorized";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(
    unauthorizedParam
      ? "Tu cuenta no tiene permisos de administrador para acceder al panel."
      : null
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMsg("Credenciales inválidas. Verifica tu correo y contraseña.");
        return;
      }

      if (!isAdminUser(data.user)) {
        await supabase.auth.signOut();
        setErrorMsg(
          "Acceso denegado: este usuario no cuenta con el rol de administrador."
        );
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setErrorMsg("Ocurrió un error al iniciar sesión. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#FFF1F5] via-white to-[#FFF1F5]/50 px-4 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-[#B94470] hover:text-[#D85C8A]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a la tienda
        </Link>

        <div className="rounded-3xl border border-[#FAD4E4] bg-white p-7 shadow-[0_14px_40px_rgb(216,92,138,0.10)] sm:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF1F5] text-[#D85C8A] ring-1 ring-[#FAD4E4]">
              <Heart className="h-6 w-6 fill-[#D85C8A]/20" />
            </div>
            <h1 className="mt-4 font-[family-name:var(--font-playfair)] text-2xl font-bold text-[#2D2226]">
              Panel Administrativo Zoe
            </h1>
            <p className="mt-1 text-xs text-[#2D2226]/65">
              Inicia sesión con tu cuenta de administradora
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#2D2226]/80">
                Correo electrónico
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@zoe.com"
                className="w-full rounded-xl border border-[#FAD4E4] bg-[#FFF1F5]/30 px-3.5 py-2.5 text-sm text-[#2D2226] placeholder:text-[#2D2226]/35 focus:border-[#D85C8A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D85C8A]/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#2D2226]/80">
                Contraseña
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-[#FAD4E4] bg-[#FFF1F5]/30 px-3.5 py-2.5 text-sm text-[#2D2226] placeholder:text-[#2D2226]/35 focus:border-[#D85C8A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D85C8A]/20"
              />
            </div>

            {errorMsg && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#D85C8A] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#B94470] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Ingresar al panel
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
