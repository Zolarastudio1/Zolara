import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { fetchGiftCards, importGiftCards, checkExistingGiftCards, voidGiftCard, expireGiftCard, deleteGiftCard } from "@/lib/useGiftCards";
import type { GiftCard } from "@/lib/useGiftCards";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { GiftCardItem } from "@/components/giftcards/GiftCardItem";
import { EditGiftCardDialog } from "@/components/giftcards/EditGiftCardDialog";
import { Search, Download, Upload, Plus, RefreshCw } from "lucide-react";

const CODE_REGEX = /^ZLR-(\d{4})-(SLV|GLD|PLT|DMD)-B(\d{2})-([A-Z0-9]{6})$/;

type PreviewRow = {
  final_code: string;
  tier?: string | null;
  year?: number | null;
  batch?: string | null;
  card_value?: number | null;
  expires_at?: string | null;
  allowed_service_ids?: string[] | null;
  allowed_service_categories?: string[] | null;
  note?: string | null;
  _valid?: boolean;
  _message?: string | null;
};

const GiftCards = () => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [importing, setImporting] = useState(false);

  const [list, setList] = useState<GiftCard[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Edit dialog
  const [editCard, setEditCard] = useState<GiftCard | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const fetchList = async () => {
    setLoadingList(true);
    try {
      const res = await fetchGiftCards({ limit: 1000, orderBy: { column: 'date_generated', ascending: false } });
      if (res.error) throw res.error;
      setList(res.data || []);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load gift cards");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setFileName(file.name);

    if (file.name.toLowerCase().endsWith(".csv")) {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length === 0) {
        toast.error("Empty CSV file");
        return;
      }
      const header = lines[0].split(",").map((h) => h.trim());
      const raw = lines.slice(1).map((line) => {
        const cols = line.split(",");
        const obj: any = {};
        header.forEach((h, i) => {
          obj[h] = cols[i] ? cols[i].trim() : "";
        });
        return obj;
      });
      mapRawToPreview(raw);
      return;
    }

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.SheetNames[0];
      const sheetData = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[sheet], { defval: null });
      mapRawToPreview(sheetData as any[]);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to parse file");
    }
  };

  // Generator state
  const [genCount, setGenCount] = useState<number>(10);
  const [genTier, setGenTier] = useState<string>("SLV");
  const [genYear, setGenYear] = useState<number>(new Date().getFullYear());
  const [genBatch, setGenBatch] = useState<string>("01");
  const [genValue, setGenValue] = useState<number>(50);
  const [showGenerator, setShowGenerator] = useState(false);

  const randomSuffix = (len = 6) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let out = "";
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  };

  const makeCode = (year: number, tier: string, batch: string) => {
    const yy = String(year).padStart(4, "0");
    const b = String(batch).replace(/^B?/i, "").padStart(2, "0");
    return `ZLR-${yy}-${tier}-B${b}-${randomSuffix(6)}`;
  };

  const generateCodes = async (count?: number) => {
    const n = count ?? genCount ?? 10;
    const generated: PreviewRow[] = [];
    const seen = new Set<string>();
    while (generated.length < n) {
      const code = makeCode(genYear, genTier, genBatch).toUpperCase();
      if (seen.has(code)) continue;
      seen.add(code);
      generated.push({
        final_code: code,
        tier: genTier,
        year: genYear,
        batch: genBatch,
        card_value: genValue,
        expires_at: null,
        allowed_service_ids: null,
        allowed_service_categories: null,
        note: "(generated)",
        _valid: CODE_REGEX.test(code),
        _message: CODE_REGEX.test(code) ? "generated" : "invalid",
      });
    }

    try {
      const codes = generated.map((r) => r.final_code);
      const { data: existing, error: existingErr } = await checkExistingGiftCards(codes);
      if (existingErr) throw existingErr;
      const existingSet = new Set((existing || []));
      const marked: PreviewRow[] = generated.map((r) => ({ 
        ...r, 
        _valid: !existingSet.has(r.final_code), 
        _message: existingSet.has(r.final_code) ? "collision" : r._message 
      }));
      setPreviewRows([...marked, ...previewRows]);
      toast.success(`Generated ${generated.length} codes`);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to check collisions");
      setPreviewRows(generated.concat(previewRows));
    }
  };

  const commitGenerated = async () => {
    const rowsToImport = previewRows.filter((r) => r._message === "generated" || (r._valid && r.note === "(generated)"));
    if (rowsToImport.length === 0) {
      toast.error("No generated rows to commit");
      return;
    }
    setImporting(true);
    try {
      const toImport = rowsToImport.map((r) => ({
        final_code: r.final_code,
        tier: r.tier,
        year: r.year,
        batch: r.batch,
        card_value: r.card_value,
        expires_at: r.expires_at,
        allowed_service_ids: r.allowed_service_ids,
        allowed_service_categories: r.allowed_service_categories,
        note: r.note,
      }));
      const res = await importGiftCards(toImport);
      if (res.error) throw res.error;
      toast.success(`Committed ${toImport.length} generated codes`);
      setPreviewRows((prev) => prev.filter((r) => !toImport.find((t) => t.final_code === r.final_code)));
      await fetchList();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to commit generated codes");
    } finally {
      setImporting(false);
    }
  };

  const mapRawToPreview = (raw: Record<string, any>[]) => {
    const rows: PreviewRow[] = raw.map((r) => {
      const final_code = (r.final_code || r.code || r["Final Code"] || r["Code"] || "").toString().trim().toUpperCase();
      const card_value = r.card_value ?? r.value ?? r["Card Value"] ?? 0;
      const tier = r.tier ?? r.Tier ?? null;
      const year = r.year ? Number(r.year) : new Date().getFullYear();
      const batch = r.batch ?? r.Batch ?? null;
      const expires_at = r.expires_at ?? r.Expires ?? null;
      const allowed_service_ids = Array.isArray(r.allowed_service_ids) ? r.allowed_service_ids : null;
      const allowed_service_categories = Array.isArray(r.allowed_service_categories) ? r.allowed_service_categories : null;
      const note = r.note ?? r.Note ?? null;

      const valid = CODE_REGEX.test(final_code) && !isNaN(Number(card_value));
      const message = valid ? "ok" : (!CODE_REGEX.test(final_code) ? "invalid_code" : "invalid_value");

      return {
        final_code,
        tier,
        year,
        batch,
        card_value: Number(card_value || 0),
        expires_at: expires_at || null,
        allowed_service_ids,
        allowed_service_categories,
        note,
        _valid: valid,
        _message: message,
      } as PreviewRow;
    });

    setPreviewRows(rows);
  };

  const handleImport = async () => {
    const toImport = previewRows.filter((r) => r._valid).map((r) => ({
      final_code: r.final_code,
      tier: r.tier,
      year: r.year,
      batch: r.batch,
      card_value: r.card_value,
      expires_at: r.expires_at,
      allowed_service_ids: r.allowed_service_ids,
      allowed_service_categories: r.allowed_service_categories,
      note: r.note,
    }));

    if (toImport.length === 0) {
      toast.error("No valid rows to import");
      return;
    }

    setImporting(true);
    try {
      const res = await importGiftCards(toImport);
      if (res.error) throw res.error;
      setPreviewRows([]);
      toast.success("Import finished");
      await fetchList();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  // Confirmation dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"void" | "expire" | "delete" | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; code?: string } | null>(null);

  const openConfirm = (action: "void" | "expire" | "delete", id: string, code?: string) => {
    setConfirmAction(action);
    setConfirmTarget({ id, code });
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!confirmAction || !confirmTarget) return;
    setConfirmOpen(false);
    const { id, code } = confirmTarget;
    try {
      if (confirmAction === "void") {
        const res = await voidGiftCard(id);
        if (res.error) throw res.error;
        toast.success(`Voided ${code ?? id}`);
      }
      if (confirmAction === "expire") {
        const res = await expireGiftCard(id);
        if (res.error) throw res.error;
        toast.success(`Expired ${code ?? id}`);
      }
      if (confirmAction === "delete") {
        const res = await deleteGiftCard(id);
        if (res.error) throw res.error;
        toast.success(`Deleted ${code ?? id}`);
      }
      await fetchList();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Action failed');
    } finally {
      setConfirmAction(null);
      setConfirmTarget(null);
    }
  };

  const exportList = () => {
    const data = filteredList;
    const ws = XLSX.utils.json_to_sheet(data || []);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "gift_cards");
    XLSX.writeFile(wb, `gift_cards_export_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const openEdit = (card: GiftCard) => {
    setEditCard(card);
    setEditOpen(true);
  };

  // Filtered list
  const filteredList = list
    .filter((r) => (statusFilter === 'all' ? true : r.status === statusFilter))
    .filter((r) => (tierFilter ? r.tier === tierFilter : true))
    .filter((r) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return r.final_code.toLowerCase().includes(q);
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gift Cards</h1>
          <p className="text-muted-foreground">Manage and import gift cards</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchList} disabled={loadingList}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loadingList ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportList}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Import Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import / Generate
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowGenerator(!showGenerator)}
            >
              {showGenerator ? "Hide Generator" : "Show Generator"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Upload file (CSV / XLSX)</Label>
              <Input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => handleFile(e.target.files?.[0])} />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleImport} disabled={importing || previewRows.filter(r => r._valid).length === 0}>
                {importing ? "Importing..." : `Import ${previewRows.filter(r => r._valid).length} valid rows`}
              </Button>
              <Button variant="ghost" onClick={() => { setPreviewRows([]); setFileName(null); }}>
                Clear
              </Button>
            </div>
          </div>

          {showGenerator && (
            <div className="border rounded-lg p-4 bg-muted/50 space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Generate Codes
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <Label className="text-xs">Count</Label>
                  <Input type="number" value={genCount} min={1} onChange={(e) => setGenCount(Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">Tier</Label>
                  <select value={genTier} onChange={(e) => setGenTier(e.target.value)} className="w-full rounded border px-2 py-2 bg-background">
                    <option value="SLV">SLV</option>
                    <option value="GLD">GLD</option>
                    <option value="PLT">PLT</option>
                    <option value="DMD">DMD</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Year</Label>
                  <Input type="number" value={genYear} onChange={(e) => setGenYear(Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">Batch</Label>
                  <Input value={genBatch} onChange={(e) => setGenBatch(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Value</Label>
                  <Input type="number" value={genValue} onChange={(e) => setGenValue(Number(e.target.value))} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void generateCodes()}>Generate</Button>
                <Button size="sm" variant="secondary" onClick={() => void commitGenerated()} disabled={importing}>
                  Commit to DB
                </Button>
              </div>
            </div>
          )}

          {previewRows.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted px-3 py-2 text-sm font-medium">
                Preview: {fileName || `${previewRows.length} rows`}
              </div>
              <div className="overflow-auto max-h-48">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-2 text-left">Code</th>
                      <th className="p-2 text-left">Value</th>
                      <th className="p-2 text-left">Tier</th>
                      <th className="p-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.slice(0, 20).map((r, idx) => (
                      <tr key={idx} className={`border-t ${r._valid ? '' : 'bg-destructive/10'}`}>
                        <td className="p-2 font-mono text-xs">{r.final_code}</td>
                        <td className="p-2">GH₵{Number(r.card_value || 0).toFixed(0)}</td>
                        <td className="p-2">{r.tier}</td>
                        <td className="p-2 text-xs text-muted-foreground">{r._message}</td>
                      </tr>
                    ))}
                    {previewRows.length > 20 && (
                      <tr className="border-t">
                        <td colSpan={4} className="p-2 text-center text-muted-foreground">
                          ... and {previewRows.length - 20} more rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manage Cards */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Gift Cards ({filteredList.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded border px-3 py-2 bg-background"
            >
              <option value="all">All Status</option>
              <option value="unused">Unused</option>
              <option value="redeemed">Redeemed</option>
              <option value="expired">Expired</option>
              <option value="void">Void</option>
            </select>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="rounded border px-3 py-2 bg-background"
            >
              <option value="">All Tiers</option>
              <option value="SLV">SLV</option>
              <option value="GLD">GLD</option>
              <option value="PLT">PLT</option>
              <option value="DMD">DMD</option>
            </select>
            <Button variant="ghost" onClick={() => { setStatusFilter('all'); setTierFilter(''); setSearchQuery(''); }}>
              Reset
            </Button>
          </div>

          {/* List */}
          <div className="space-y-3">
            {loadingList && (
              <div className="text-center py-8 text-muted-foreground">Loading gift cards...</div>
            )}
            {!loadingList && filteredList.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">No gift cards found</div>
            )}
            {filteredList.map((card) => (
              <GiftCardItem
                key={card.id}
                card={card}
                onEdit={openEdit}
                onAction={openConfirm}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <EditGiftCardDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        giftCard={editCard}
        onUpdated={fetchList}
      />

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmAction === 'void' && 'Confirm Void'}
              {confirmAction === 'expire' && 'Confirm Expire'}
              {confirmAction === 'delete' && 'Confirm Delete'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === 'void' && `Are you sure you want to void ${confirmTarget?.code}? This cannot be undone.`}
              {confirmAction === 'expire' && `Mark ${confirmTarget?.code} as expired?`}
              {confirmAction === 'delete' && `Permanently delete ${confirmTarget?.code}? This action is irreversible.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant={confirmAction === 'delete' || confirmAction === 'void' ? 'destructive' : 'default'} onClick={() => void handleConfirm()}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GiftCards;
