import { createClient } from "./client";

const BUCKET_NAME = "product-images";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export async function uploadProductImage(
  file: File,
  folder: "products" | "shades" = "products"
): Promise<string> {
  const safeExt = ALLOWED_MIME_TO_EXT[file.type];
  if (!safeExt) {
    throw new Error(
      "Formato de imagen no permitido. Usa JPG, PNG, WebP o AVIF."
    );
  }

  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    throw new Error("La imagen no puede superar los 5 MB.");
  }

  const supabase = createClient();
  const fileName = `${folder}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}.${safeExt}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, file, {
      cacheControl: "31536000",
      contentType: file.type,
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
