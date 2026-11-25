import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/supabase/auth";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

async function AdminLoginGate() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isAdminUser(user)) {
    redirect("/admin");
  }

  return <AdminLoginForm />;
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginGate />
    </Suspense>
  );
}
