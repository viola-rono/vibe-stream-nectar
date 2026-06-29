import imageCompression from "browser-image-compression";
import { supabase } from "@/integrations/supabase/client";

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const blob = await imageCompression(file, {
      maxSizeMB: 1.2,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: "image/webp",
      initialQuality: 0.82,
    });
    return new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), {
      type: "image/webp",
    });
  } catch {
    return file;
  }
}

export async function uploadPostMedia(userId: string, files: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (const original of files) {
    const file = await compressImage(original);
    const path = `${userId}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("posts").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
    if (error) throw error;
    const { data } = await supabase.storage.from("posts").createSignedUrl(path, 60 * 60 * 24 * 365);
    if (data?.signedUrl) urls.push(data.signedUrl);
  }
  return urls;
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const compressed = await compressImage(file);
  const path = `${userId}/avatar-${Date.now()}.webp`;
  const { error } = await supabase.storage.from("avatars").upload(path, compressed, {
    cacheControl: "3600",
    upsert: true,
    contentType: compressed.type,
  });
  if (error) throw error;
  const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365);
  return data?.signedUrl ?? "";
}