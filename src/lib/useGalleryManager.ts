import { supabase } from "@/integrations/supabase/client";

export async function uploadGalleryImages(
  files: File[],
  existing: string[]
): Promise<string[] | null> {
  const uploaded: string[] = [];

  try {
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `gallery-${Date.now()}-${Math.random()}.${ext}`;

      const { error } = await supabase.storage
        .from("gallery")
        .upload(path, file);

      if (error) throw error;

      const { data } = supabase.storage
        .from("gallery")
        .getPublicUrl(path);

      uploaded.push(data.publicUrl);
    }

    return [...existing, ...uploaded];
  } catch (e) {
    console.error(e);
    return null;
  }
}
