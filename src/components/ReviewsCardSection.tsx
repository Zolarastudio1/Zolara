import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";


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
    const { data, error } = await supabase   // @ts-ignore
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
    const { error } = await supabase.from("reviews").insert([
      { name, comment, rating, visible: false },
    ]);

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
    <Card className="p-6 space-y-4">
      <h2 className="text-xl font-semibold mb-4">Customer Reviews</h2>

      <div className="space-y-4">
        {reviews.map((r) => (
          <div key={r.id} className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              {[...Array(r.rating)].map((_, i) => (
                <span key={i} className="text-yellow-400">★</span>
              ))}
              {[...Array(5 - r.rating)].map((_, i) => (
                <span key={i} className="text-gray-300">★</span>
              ))}
              <span className="ml-2 font-medium">{r.name}</span>
            </div>
            <p className="text-sm">{r.comment}</p>
          </div>
        ))}
      </div>

      {!adding && (
        <Button onClick={() => setAdding(true)}>Add Review</Button>
      )}

      {adding && (
        <div className="space-y-2 mt-4">
          <input
            type="text"
            placeholder="Your Name"
            className="w-full p-2 border rounded"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <textarea
            placeholder="Your Comment"
            className="w-full p-2 border rounded"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <label>Rating:</label>
            <select
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
            >
              {[5, 4, 3, 2, 1].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button onClick={submitReview}>Submit</Button>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
