import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { fetchGiftCards, importGiftCards, checkExistingGiftCards, voidGiftCard, expireGiftCard, deleteGiftCard } from "@/lib/useGiftCards";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

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

  const [list, setList] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("");

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

    // CSV
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

    // Excel
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

    // Check DB collisions for these codes
    try {
      const codes = generated.map((r) => r.final_code);
      const { data: existing, error: existingErr } = await checkExistingGiftCards(codes);
      if (existingErr) throw existingErr;
      const existingSet = new Set((existing || []));
      const marked: PreviewRow[] = generated.map((r) => ({ ...r, _valid: !existingSet.has(r.final_code), _message: existingSet.has(r.final_code) ? "collision" : r._message }));
      setPreviewRows([...marked, ...previewRows]);
      toast.success(`Generated ${generated.length} codes (collisions marked).`);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to check collisions");
      setPreviewRows(generated.concat(previewRows));
    }
  };

  const commitGenerated = async () => {
    const rowsToImport = previewRows.filter((r) => r._message === "generated" || (r._valid && r.note === "(generated)"));
    if (rowsToImport.length === 0) {
      toast.error("No generated rows to commit (remove any collisions first)");
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
      toast.success("Import finished. Check results below.");
      console.debug("import result", res.data);
      await fetchList();
    } catch (err: any) {
      console.error("Import error", err);
      toast.error(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const voidCard = async (id: string) => {
    const res = await voidGiftCard(id);
    if (res.error) {
      console.error(res.error);
      toast.error("Failed to void card");
      return;
    }
    toast.success("Card voided");
    await fetchList();
  };

  const expireCard = async (id: string) => {
    const res = await expireGiftCard(id);
    if (res.error) {
      console.error(res.error);
      toast.error("Failed to expire card");
      return;
    }
    toast.success("Card expired");
    await fetchList();
  };

  const deleteCard = async (id: string) => {
    const res = await deleteGiftCard(id);
    if (res.error) {
      console.error(res.error);
      toast.error("Failed to delete card");
      return;
    }
    toast.success("Card deleted");
    await fetchList();
  };

  // Confirmation dialog state
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
    const data = list
      .filter((r) => (statusFilter === "all" ? true : r.status === statusFilter))
      .filter((r) => (tierFilter ? r.tier === tierFilter : true));
    const ws = XLSX.utils.json_to_sheet(data || []);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "gift_cards");
    XLSX.writeFile(wb, `gift_cards_export_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Gift Cards</h1>
        <p className="text-muted-foreground">Import and manage gift cards (Phase 1 import)</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import codes (CSV / XLSX)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Upload file</Label>
              <Input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => handleFile(e.target.files?.[0])} />
              <div className="mt-2 text-sm text-muted-foreground">Or paste CSV into the textarea below.</div>
            </div>
            <div>
              <Label>Preview / CSV fallback</Label>
              <Textarea
                placeholder={`final_code,tier,year,batch,card_value,expires_at\nZLR-2025-SLV-B01-ABC123,SLV,2025,B01,50,2026-01-01`}
                value={""}
                onChange={() => {}}
                disabled
              />
            </div>
          </div>

              <div className="mt-4">
            <div className="mb-4 border rounded p-3 bg-muted">
              <h4 className="font-semibold mb-2">Generate codes</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label>Count</Label>
                  <Input type="number" value={genCount} min={1} onChange={(e) => setGenCount(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Tier</Label>
                  <select value={genTier} onChange={(e) => setGenTier(e.target.value)} className="w-full rounded border px-2 py-1">
                    <option value="SLV">SLV</option>
                    <option value="GLD">GLD</option>
                    <option value="PLT">PLT</option>
                    <option value="DMD">DMD</option>
                  </select>
                </div>
                <div>
                  <Label>Year</Label>
                  <Input type="number" value={genYear} onChange={(e) => setGenYear(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Batch</Label>
                  <Input value={genBatch} onChange={(e) => setGenBatch(e.target.value)} />
                </div>
                <div>
                  <Label>Value</Label>
                  <Input type="number" value={genValue} onChange={(e) => setGenValue(Number(e.target.value))} />
                </div>
                <div className="flex items-end">
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => void generateCodes()}>Generate</Button>
                    <Button variant="secondary" onClick={() => void commitGenerated()} disabled={importing}>Commit Generated</Button>
                    <Button variant="ghost" onClick={() => { setPreviewRows([]); toast.success('Cleared preview'); }}>Clear Preview</Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleImport} disabled={importing || previewRows.filter(r => r._valid).length === 0}>
                {importing ? "Importing..." : `Import ${previewRows.filter(r => r._valid).length} valid rows`}
              </Button>
              <Button variant="ghost" onClick={() => { setPreviewRows([]); setFileName(null); }}>Clear Preview</Button>
              <Button variant="outline" onClick={exportList} className="ml-auto w-full sm:w-auto">Export List</Button>
            </div>

            <div className="mt-4">
              <h4 className="font-medium">Preview ({fileName || previewRows.length + ' rows'})</h4>
              {previewRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No file parsed yet.</p>
              ) : (
                <div className="overflow-auto max-h-64 mt-2">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead>
                      <tr className="text-left">
                        <th className="p-2">Code</th>
                        <th className="p-2">Value</th>
                        <th className="p-2">Tier</th>
                        <th className="p-2">Batch</th>
                        <th className="p-2">Year</th>
                        <th className="p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((r, idx) => (
                        <tr key={idx} className={`border-t ${r._valid ? '' : 'bg-red-50'}`}>
                          <td className="p-2 monospace">{r.final_code}</td>
                          <td className="p-2">GH₵ {Number(r.card_value || 0).toFixed(2)}</td>
                          <td className="p-2">{r.tier}</td>
                          <td className="p-2">{r.batch}</td>
                          <td className="p-2">{r.year}</td>
                          <td className="p-2 text-sm text-muted-foreground">{r._message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manage Cards</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 items-center mb-4">
            <Label className="text-sm">Status</Label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded border px-2 py-1">
              <option value="all">All</option>
              <option value="unused">Unused</option>
              <option value="redeemed">Redeemed</option>
              <option value="expired">Expired</option>
              <option value="void">Void</option>
            </select>
            <Label className="text-sm">Tier</Label>
            <input placeholder="Tier" value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} className="rounded border px-2 py-1" />
            <Button variant="ghost" onClick={() => { setStatusFilter('all'); setTierFilter(''); }}>Reset</Button>
          </div>

          <div className="space-y-2">
            {loadingList && <div className="text-sm text-muted-foreground">Loading...</div>}
            {list.filter((r) => (statusFilter==='all'?true:r.status===statusFilter)).filter((r)=> (tierFilter? r.tier===tierFilter : true)).map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-muted rounded">
                <div>
                  <div className="font-medium">{c.final_code} <span className="text-xs text-muted-foreground">{c.tier}</span></div>
                  <div className="text-sm">Value: GH₵{Number(c.card_value).toFixed(2)} • Status: {c.status}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(c.final_code)}>Copy</Button>
                  <Button size="sm" variant="secondary" onClick={() => openConfirm('expire', c.id, c.final_code)}>Expire</Button>
                  <Button size="sm" variant="destructive" onClick={() => openConfirm('void', c.id, c.final_code)}>Void</Button>
                  <Button size="sm" variant="ghost" onClick={() => openConfirm('delete', c.id, c.final_code)}>Delete</Button>
                </div>
              </div>
            ))}
            {list.length === 0 && <div className="text-sm text-muted-foreground">No gift cards yet.</div>}
          </div>
        </CardContent>
      </Card>
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
              {confirmAction === 'void' && `Are you sure you want to void ${confirmTarget?.code ?? confirmTarget?.id}? This cannot be undone.`}
              {confirmAction === 'expire' && `Mark ${confirmTarget?.code ?? confirmTarget?.id} as expired?`}
              {confirmAction === 'delete' && `Permanently delete ${confirmTarget?.code ?? confirmTarget?.id}? This action is irreversible.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleConfirm()}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GiftCards;
