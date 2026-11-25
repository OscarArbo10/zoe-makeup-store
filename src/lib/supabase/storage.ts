import { createClient } from "./client";

const BUCKET_NAME = "product-images";

export async function uploadProductImage(
  file: File,
  folder: "products" | "shades" = "products"
): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ext.replace(/[^a-z0-9]/g, "") || "jpg";
  const fileName = `${folder}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}.${safeExt}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, file, {
      cacheControl: "31536000",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);

  return publicUrl;
}
