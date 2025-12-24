import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { uploadGalleryImages } from "@/lib/useGalleryManager";
import { Card } from "../ui/card";
import { supabase } from "@/integrations/supabase/client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function GallerySettingsSection({
  settingsId,
  images,
  onChange,
}: {
  settingsId: string;
  images: string[];
  onChange: (imgs: string[]) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);

  const handleUpload = async () => {
    if (images.length + files.length > 8) {
      toast.error("Maximum of 8 images allowed");
      return;
    }

    setSaving(true);

    const updated = await uploadGalleryImages(files, images);
    if (!updated || updated.length < 4) {
      toast.error("Gallery must have at least 4 images");
      setSaving(false);
      return;
    }

    const { error } = await supabase //@ts-ignore
      .from("settings") //@ts-ignore
      .update({ gallery_images: updated })
      .eq("id", settingsId);

    if (error) {
      toast.error("Failed to save gallery");
      setSaving(false);
      return;
    }

    onChange(updated);
    setFiles([]);
    setSaving(false);
    toast.success("Gallery updated");
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;

    if (images.length <= 4) {
      toast.error("Minimum of 4 images required");
      setRemoveTarget(null);
      return;
    }

    const previousImages = images;
    const updated = images.filter((i) => i !== removeTarget);

    // Optimistic UI update
    onChange(updated);
    setRemoveTarget(null);

    const { error } = await supabase //@ts-ignore
      .from("settings") //@ts-ignore
      .update({ gallery_images: updated })
      .eq("id", settingsId);

    if (error) {
      // Rollback on failure
      onChange(previousImages);
      toast.error("Failed to remove image");
      return;
    }

    toast.success("Image removed");
  };

  return (
    <>
      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Gallery</h2>
          <p className="text-sm text-muted-foreground">
            Add or remove images that display on the landing page
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {images.map((src, i) => (
              <div key={i} className="relative group">
                <img
                  src={src}
                  className="rounded-lg aspect-square object-cover"
                />
                <button
                  onClick={() => setRemoveTarget(src)}
                  className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <input
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
          {files.length > 0 && (
            <Button onClick={handleUpload} disabled={saving}>
              Save Images
            </Button>
          )}
          <p className="text-sm text-muted-foreground">Min 4 · Max 8 images</p>
        </div>
      </Card>

      {/* CONFIRM DELETE MODAL */}
      <AlertDialog
        open={!!removeTarget}
        onOpenChange={() => setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove image?</AlertDialogTitle>
            <AlertDialogDescription>
              This image will be removed from the gallery. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
