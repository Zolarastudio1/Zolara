import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { GiftCard } from "@/lib/useGiftCards";

type Service = {
  id: string;
  name: string;
  category: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  giftCard: GiftCard | null;
  onUpdated: () => void;
};

export function EditGiftCardDialog({
  open,
  onOpenChange,
  giftCard,
  onUpdated,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  // Form state
  const [cardValue, setCardValue] = useState<number>(0);
  const [tier, setTier] = useState<string>("");
  const [expireAt, setExpireAt] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Load services
  useEffect(() => {
    const loadServices = async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, category");
      if (!error && data) {
        setServices(data);
        const cats = [...new Set(data.map((s) => s.category))];
        setCategories(cats);
      }
    };
    loadServices();
  }, []);

  // Populate form when giftCard changes
  useEffect(() => {
    if (giftCard) {
      setCardValue(giftCard.card_value || 0);
      setTier(giftCard.tier || "");
      setExpireAt(giftCard.expire_at ? giftCard.expire_at.slice(0, 10) : "");
      setNote("");
      setSelectedServiceIds(giftCard.allowed_service_ids || []);
      setSelectedCategories(giftCard.allowed_service_categories || []);
    }
  }, [giftCard]);

  const handleSubmit = async () => {
    if (!giftCard?.id) return;

    setLoading(true);

    try {
      const { data, error } = await (supabase as any).rpc(
        "rpc_update_gift_card",
        {
          p_id: giftCard.id,
          p_card_value: cardValue ?? null,
          p_tier: tier?.trim() || null,
          p_allowed_service_ids: selectedServiceIds?.length
            ? selectedServiceIds
            : null,
          p_allowed_service_categories: selectedCategories?.length
            ? selectedCategories
            : null,
          p_expire_at: expireAt ? new Date(expireAt).toISOString() : null,
          p_note: note?.trim() || null,
        }
      );

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;

      if (!result) {
        throw new Error("No response from update RPC");
      }

      if (result.success) {
        toast.success("Gift card updated successfully");
        onUpdated?.();
        onOpenChange?.(false);
      } else {
        toast.error(result.message || "Update failed");
      }
    } catch (err: any) {
      console.error("Update gift card failed:", err);
      toast.error(err?.message || "Failed to update gift card");
    } finally {
      setLoading(false);
    }
  };

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  if (!giftCard) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Gift Card</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted rounded">
            <p className="font-mono font-medium">{giftCard.final_code}</p>
            <p className="text-sm text-muted-foreground">
              Status: {giftCard.status}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Card Value (GH₵)</Label>
              <Input
                type="number"
                value={cardValue}
                onChange={(e) => setCardValue(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Tier</Label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                className="w-full rounded border px-3 py-2 bg-background"
              >
                <option value="">None</option>
                <option value="SLV">SLV (Silver)</option>
                <option value="GLD">GLD (Gold)</option>
                <option value="PLT">PLT (Platinum)</option>
                <option value="DMD">DMD (Diamond)</option>
              </select>
            </div>
          </div>

          <div>
            <Label>Expires At</Label>
            <Input
              type="date"
              value={expireAt}
              onChange={(e) => setExpireAt(e.target.value)}
            />
          </div>

          <div>
            <Label className="mb-2 block">
              Allowed Services (leave empty for all)
            </Label>
            <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-1">
              {services.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted p-1 rounded"
                >
                  <Checkbox
                    checked={selectedServiceIds.includes(s.id)}
                    onCheckedChange={() => toggleService(s.id)}
                  />
                  <span>{s.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({s.category})
                  </span>
                </label>
              ))}
              {services.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No services found
                </p>
              )}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">
              Allowed Categories (leave empty for all)
            </Label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <label
                  key={cat}
                  className="flex items-center gap-2 text-sm cursor-pointer border rounded px-2 py-1 hover:bg-muted"
                >
                  <Checkbox
                    checked={selectedCategories.includes(cat)}
                    onCheckedChange={() => toggleCategory(cat)}
                  />
                  <span>{cat}</span>
                </label>
              ))}
              {categories.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No categories found
                </p>
              )}
            </div>
          </div>

          <div>
            <Label>Note (optional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note about this update..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
