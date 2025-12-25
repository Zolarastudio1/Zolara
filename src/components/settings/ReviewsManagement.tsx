import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Review {
  id: string;
  name: string;
  rating: number; // 1-5
  comment: string;
  visible: boolean;
  created_at?: string;
}

export function ReviewsSettingsSection({ settingsId }: { settingsId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    setLoading(true);
    const { data, error } = await supabase //@ts-ignore
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      toast.error("Failed to fetch reviews");
      setLoading(false);
      return;
    }

    //@ts-ignore
    setReviews(data);
    setLoading(false);
  };

  const toggleVisible = async (id: string, visible: boolean) => {
    const { error } = await supabase //@ts-ignore
      .from("reviews") //@ts-ignore
      .update({ visible })
      .eq("id", id);

    if (error) {
      console.error(error);
      toast.error("Failed to update review");
      return;
    }

    const updated = reviews.map((r) => (r.id === id ? { ...r, visible } : r));
    setReviews(updated);

    // Update settings.reviews with all visible reviews
    const visibleReviews = updated.filter((r) => r.visible);
    await supabase //@ts-ignore
      .from("settings") //@ts-ignore
      .update({ reviews: visibleReviews })
      .eq("id", settingsId);

    toast.success("Review updated");
  };

  return (
    <Card className="p-6 space-y-4">
      <h2 className="text-xl font-semibold mb-4">Manage Reviews</h2>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="space-y-2">
          {reviews.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between border rounded p-2"
            >
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="text-sm text-muted-foreground">{r.comment}</p>
              </div>
              <Switch
                checked={r.visible}
                onCheckedChange={(checked) => toggleVisible(r.id, checked)}
              />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
