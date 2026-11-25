"use server";

import { updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/supabase/auth";

export async function revalidateCatalog(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminUser(user)) {
    throw new Error("No autorizado para revalidar el catálogo.");
  }

  updateTag("catalog");
  return { ok: true };
}
