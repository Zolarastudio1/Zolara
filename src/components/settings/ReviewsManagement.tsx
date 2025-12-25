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
    setReviews(data ?? []);
    setLoading(false);
  };

  const toggleVisible = async (id: string, visible: boolean) => {
    // Update individual review
    const { error: reviewError } = await supabase  //@ts-ignore
      .from("reviews")   //@ts-ignore
      .update({ visible })
      .eq("id", id);

    if (reviewError) {
      console.error(reviewError);
      toast.error("Failed to update review");
      return;
    }

    // Update local state
    const updatedReviews = reviews.map((r) =>
      r.id === id ? { ...r, visible } : r
    );
    setReviews(updatedReviews);

    // Sync all visible reviews to settings
    const visibleReviews = updatedReviews.filter((r) => r.visible);
    const { error: settingsError } = await supabase  //@ts-ignore
      .from("settings")  //@ts-ignore
      .update({ reviews: visibleReviews })
      .eq("id", settingsId);

    if (settingsError) {
      console.error(settingsError);
      toast.error("Failed to update settings");
      return;
    }

    toast.success("Review visibility updated");
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
              className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rounded-lg border p-4 bg-background"
            >
              {/* REVIEW CONTENT */}
              <div className="flex-1 space-y-2">
                <p className="font-medium text-base md:text-lg leading-none">
                  {r.name}
                </p>

                {/* STAR RATING */}
                <div className="flex items-center gap-1 text-sm md:text-base">
                  {[...Array(5)].map((_, i) => (
                    <span
                      key={i}
                      className={`${
                        i < r.rating ? "text-yellow-400" : "text-gray-300"
                      } text-lg md:text-xl`}
                    >
                      ★
                    </span>
                  ))}
                  <span className="ml-2 text-sm md:text-base text-muted-foreground">
                    {r.rating}/5
                  </span>
                </div>

                <p className="text-sm md:text-base text-muted-foreground line-clamp-3">
                  {r.comment}
                </p>
              </div>

              {/* VISIBILITY CONTROL */}
              <div className="flex items-center gap-3 mt-2 md:mt-0">
                <span className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">
                  Show on landing page
                </span>
                <Switch
                  checked={r.visible}
                  onCheckedChange={(checked) => toggleVisible(r.id, checked)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
