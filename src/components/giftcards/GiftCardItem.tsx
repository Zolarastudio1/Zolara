import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Copy,
  Pencil,
  Ban,
  Clock,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import type { GiftCard } from "@/lib/useGiftCards";

type Props = {
  userRole: string | null;
  card: GiftCard;
  onEdit: (card: GiftCard) => void;
  onAction: (
    action: "void" | "expire" | "delete",
    id: string,
    code: string
  ) => void;
};

export function GiftCardItem({ userRole, card, onEdit, onAction }: Props) {
  const [expanded, setExpanded] = useState(false);

  const copyCode = () => {
    navigator.clipboard?.writeText(card.final_code);
    toast.success("Code copied");
  };

  const statusColor =
    {
      unused:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      redeemed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      expired:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      void: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    }[card.status || "unused"] || "bg-muted";

  const tierColor =
    {
      SLV: "bg-gray-200 text-gray-800",
      GLD: "bg-yellow-200 text-yellow-900",
      PLT: "bg-purple-200 text-purple-900",
      DMD: "bg-cyan-200 text-cyan-900",
    }[card.tier || ""] || "bg-muted";

  return (
    <div className="border rounded-lg p-4 bg-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-semibold text-lg">
              {card.final_code}
            </span>
            <Badge className={tierColor}>{card.tier || "N/A"}</Badge>
            <Badge className={statusColor}>{card.status}</Badge>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            Value:{" "}
            <span className="font-medium text-foreground">
              GH₵{Number(card.card_value || 0).toFixed(2)}
            </span>
            {card.expire_at && (
              <span className="ml-3">
                Expires: {new Date(card.expire_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            size="icon"
            variant="ghost"
            onClick={copyCode}
            title="Copy code"
          >
            <Copy className="h-4 w-4" />
          </Button>
          {card.status !== "redeemed" && userRole === "owner" && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onEdit(card)}
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {userRole === "owner" && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setExpanded(!expanded)}
              title={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Year</p>
              <p className="font-medium">{card.year || "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Batch</p>
              <p className="font-medium">{card.batch || "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium">
                {card.date_generated
                  ? new Date(card.date_generated).toLocaleDateString()
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Redeemed</p>
              <p className="font-medium">
                {card.redeemed_at
                  ? new Date(card.redeemed_at).toLocaleDateString()
                  : "-"}
              </p>
            </div>
          </div>

          {card.allowed_service_ids?.length ||
          card.allowed_service_categories?.length ? (
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                Service Restrictions:
              </p>
              <div className="flex flex-wrap gap-1">
                {card.allowed_service_categories?.map((cat) => (
                  <Badge key={cat} variant="outline">
                    {cat}
                  </Badge>
                ))}
                {card.allowed_service_ids?.map((id) => (
                  <Badge key={id} variant="secondary" className="text-xs">
                    {id.slice(0, 8)}...
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No service restrictions (valid for all services)
            </p>
          )}

          {card.status !== "redeemed" && (
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onAction("expire", card.id, card.final_code)}
              >
                <Clock className="h-3 w-3 mr-1" /> Expire
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onAction("void", card.id, card.final_code)}
              >
                <Ban className="h-3 w-3 mr-1" /> Void
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onAction("delete", card.id, card.final_code)}
              >
                <Trash2 className="h-3 w-3 mr-1" /> Delete
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
