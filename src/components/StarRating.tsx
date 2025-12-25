import { Star } from "lucide-react";

export default function StarRating({
  value,
  onChange,
  size = 20,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(star)}
          className="transition-transform hover:scale-110"
        >
          <Star
            style={{ width: size, height: size }}
            className={
              star <= value
                ? "fill-champagne text-champagne"
                : "text-white/30"
            }
          />
        </button>
      ))}
    </div>
  );
}
