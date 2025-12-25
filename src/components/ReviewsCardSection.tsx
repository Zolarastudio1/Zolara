import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import StarRating from "./StarRating";

interface Review {
  id: string;
  name: string;
  rating: number;
  comment: string;
  visible: boolean;
  created_at?: string;
}

export function ReviewsCardSection() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(5);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    // @ts-ignore
    const { data, error } = await supabase // @ts-ignore
      .from("reviews")
      .select("*")
      .eq("visible", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      toast.error("Failed to load reviews");
      return;
    }

    // @ts-ignore
    setReviews(data);
  };

  const submitReview = async () => {
    if (!name.trim() || !comment.trim()) {
      toast.error("Name and comment are required");
      return;
    }

    // @ts-ignore
    const { error } = await supabase
      .from("reviews")
      .insert([{ name, comment, rating, visible: false }]);

    if (error) {
      console.error(error);
      toast.error("Failed to submit review");
      return;
    }

    toast.success("Review submitted for approval");
    setName("");
    setComment("");
    setRating(5);
    setAdding(false);
  };

  return (
    <Card className="p-6 space-y-6 bg-white/5 border-white/10 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Customer Reviews</h2>
        {!adding && (
          <Button
            onClick={() => setAdding(true)}
            className="bg-champagne text-black hover:bg-champagne/90"
          >
            Add Review
          </Button>
        )}
      </div>

      {/* REVIEWS */}
      <div className="grid md:grid-cols-2 gap-4">
        {reviews.map((r) => (
          <div
            key={r.id}
            className="rounded-xl p-4 bg-black/30 border border-white/10 space-y-2"
          >
            <div className="flex items-center justify-between">
              <StarRating value={r.rating} />
              <span className="text-sm font-medium text-champagne">
                {r.name}
              </span>
            </div>

            <p className="text-sm text-white/80 leading-relaxed italic">
              “{r.comment}”
            </p>
          </div>
        ))}
      </div>

      {/* ADD REVIEW */}
      {adding && (
        <div className="rounded-xl p-5 bg-black/40 border border-white/10 space-y-4">
          <h3 className="font-semibold text-white">Leave a Review</h3>

          <input
            type="text"
            placeholder="Your name"
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-white/40"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <textarea
            placeholder="Share your experience..."
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-white/40 min-h-[100px]"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />

          <div className="flex items-center gap-3">
            <span className="text-sm text-white/70">Your rating</span>
            <StarRating value={rating} onChange={setRating} size={24} />
            <span className="text-sm text-white/50">{rating}/5</span>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={submitReview}
              className="bg-champagne text-black hover:bg-champagne/90"
            >
              Submit Review
            </Button>

            <Button
              variant="ghost"
              className="text-white/70"
              onClick={() => setAdding(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
