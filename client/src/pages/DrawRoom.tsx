import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Crown,
  Plus,
  Trash2,
  Shuffle,
  Check,
  X,
  Loader2,
  ArrowLeft,
  Copy,
  Gift,
  Trophy,
  Undo2,
  AlertCircle,
  Download,
  ClipboardList,
} from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import * as XLSX from "xlsx";

export default function DrawRoom() {
  return (
    <DashboardLayout>
      <DrawRoomContent />
    </DashboardLayout>
  );
}

interface PrizeWithWinners {
  id: number;
  roomId: number;
  name: string;
  quantity: number;
  sortOrder: number;
  createdAt: Date;
  winners: { id: number; roomId: number; prizeId: number; number: number; markedAt: Date }[];
  remaining: number;
}

interface WinnerWithPrize {
  id: number;
  roomId: number;
  prizeId: number;
  number: number;
  markedAt: Date;
  prizeName: string;
}

function DrawRoomContent() {
  const { roomId } = useParams<{ roomId: string }>();
  const roomIdNum = parseInt(roomId || "0");
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const utils = trpc.useUtils();
  const { data: state, isLoading } = trpc.rooms.getState.useQuery({ roomId: roomIdNum });
  const { data: randomNum } = trpc.winners.random.useQuery({ roomId: roomIdNum }, {
    enabled: false,
  });

  // Polling for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      utils.rooms.getState.invalidate({ roomId: roomIdNum });
    }, 2000);
    return () => clearInterval(interval);
  }, [roomIdNum, utils]);

  // Prize mutations
  const addPrizeMutation = trpc.prizes.create.useMutation({
    onSuccess: () => {
      utils.rooms.getState.invalidate({ roomId: roomIdNum });
      toast.success("獎品已新增");
      setNewPrizeName("");
      setNewPrizeQty(1);
    },
    onError: (err) => toast.error("新增失敗", { description: err.message }),
  });

  const updatePrizeMutation = trpc.prizes.update.useMutation({
    onSuccess: () => {
      utils.rooms.getState.invalidate({ roomId: roomIdNum });
    },
    onError: (err) => toast.error("更新失敗", { description: err.message }),
  });

  const deletePrizeMutation = trpc.prizes.delete.useMutation({
    onSuccess: () => {
      utils.rooms.getState.invalidate({ roomId: roomIdNum });
      toast.success("獎品已刪除");
    },
  });

  const reorderPrizeMutation = trpc.prizes.reorder.useMutation({
    onSuccess: () => {
      utils.rooms.getState.invalidate({ roomId: roomIdNum });
      toast.success("獎品順序已更新");
    },
    onError: (err) => toast.error("排序失敗", { description: err.message }),
  });

  // Winner mutations
  const markWinnerMutation = trpc.winners.mark.useMutation({
    onSuccess: () => {
      utils.rooms.getState.invalidate({ roomId: roomIdNum });
      setDrawNumber("");
      toast.success("中獎號碼已標記");
    },
    onError: (err) => toast.error("標記失敗", { description: err.message }),
  });

  const unmarkWinnerMutation = trpc.winners.unmark.useMutation({
    onSuccess: () => {
      utils.rooms.getState.invalidate({ roomId: roomIdNum });
      toast.success("中獎標記已撤銷");
    },
  });

  // Room close
  const closeRoomMutation = trpc.rooms.close.useMutation({
    onSuccess: () => {
      toast.success("房間已關閉");
      setLocation("/host");
    },
  });

  // Local state
  const [newPrizeName, setNewPrizeName] = useState("");
  const [newPrizeQty, setNewPrizeQty] = useState(1);
  const [drawNumber, setDrawNumber] = useState("");
  const [selectedPrizeId, setSelectedPrizeId] = useState<string>("");
  const [copied, setCopied] = useState(false);

  // Inline edit state
  const [editingPrizeId, setEditingPrizeId] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<"name" | "quantity" | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop state
  const [draggedPrize, setDraggedPrize] = useState<PrizeWithWinners | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const importMutation = trpc.prizes.importFromExcel.useMutation({
    onSuccess: (result) => {
      toast.success("匯入完成", { description: `成功新增 ${result.successCount}/${result.totalCount} 個獎品` });
      utils.rooms.getState.invalidate({ roomId: roomIdNum });
      setIsImporting(false);
    },
    onError: (err) => {
      toast.error("匯入失敗", { description: err.message });
      setIsImporting(false);
    },
  });

  const handleDownloadTemplate = () => {
    const templateData = [
      { "獎品名稱": "筆記本", "數量": 1, "備註": "" },
      { "獎品名稱": "水瓶", "數量": 5, "備註": "" },
      { "獎品名稱": "T恆", "數量": 10, "備註": "" },
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "獎品");
    XLSX.writeFile(workbook, "獎品匯入範本.xlsx");
    toast.success("範本已下載");
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(worksheet) as any[];

      const prizes = data.map((row, index) => {
        const name = String(row["獎品名稱"] || row["name"] || "").trim();
        const quantity = parseInt(String(row["數量"] || row["quantity"] || "1"));
        const remark = String(row["備註"] || row["remark"] || "").trim();

        if (!name) throw new Error(`第 ${index + 2} 列：獎品名稱不能為空`);
        if (!quantity || quantity < 1) throw new Error(`第 ${index + 2} 列：數量必須為正整數`);

        return { name, quantity, remark: remark || undefined };
      });

      if (prizes.length === 0) {
        toast.error("匯入失敗", { description: "Excel 檔案中沒有有效的獎品數據" });
        setIsImporting(false);
        return;
      }

      importMutation.mutate({ roomId: roomIdNum, prizes });
    } catch (error) {
      toast.error("解析失敗", { description: (error as Error).message });
      setIsImporting(false);
    } finally {
      const input = document.getElementById('excel-import-input') as HTMLInputElement;
      if (input) input.value = "";
    }
  };

  // Track previously seen winners to detect new ones
  const prevWinnerCountRef = useRef<number>(0);
  // Track previously seen remaining counts to detect depletion
  const prevRemainingRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    if (editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingPrizeId, editingField]);

  // Detect new winner and show toast + depletion alerts
  useEffect(() => {
    if (!state) return;

    // New winner notification
    if (state.totalWinners > prevWinnerCountRef.current && prevWinnerCountRef.current > 0) {
      const newWinners = state.winners.slice(0, state.totalWinners - prevWinnerCountRef.current);
      newWinners.forEach(w => {
        toast.success("恭喜中獎！", {
          description: `號碼 ${w.number} — ${w.prizeName}`,
        });
      });
    }
    prevWinnerCountRef.current = state.totalWinners;

    // Depletion detection: only toast when remaining goes from >0 to 0
    const currentRemaining = new Map<number, number>();
    state.prizes.forEach((p: PrizeWithWinners) => {
      currentRemaining.set(p.id, p.remaining);
      const prevRemaining = prevRemainingRef.current.get(p.id);
      if (p.remaining === 0 && prevRemaining !== undefined && prevRemaining > 0) {
        toast.warning(`獎項「${p.name}」已抽完！`, {
          description: `共 ${p.quantity} 個名額已全部抽出`,
          duration: 5000,
        });
      }
    });
    prevRemainingRef.current = currentRemaining;
  }, [state]);

  const handleStartEdit = (prize: PrizeWithWinners, field: "name" | "quantity") => {
    setEditingPrizeId(prize.id);
    setEditingField(field);
    setEditValue(field === "name" ? prize.name : String(prize.quantity));
  };

  const handleConfirmEdit = () => {
    if (editingPrizeId === null || !editingField) return;
    const data: { id: number; name?: string; quantity?: number } = { id: editingPrizeId };
    if (editingField === "name") {
      if (!editValue.trim()) return;
      data.name = editValue.trim();
    } else {
      const qty = parseInt(editValue);
      if (isNaN(qty) || qty < 1) return;
      data.quantity = qty;
    }
    updatePrizeMutation.mutate(data);
    setEditingPrizeId(null);
    setEditingField(null);
    setEditValue("");
  };

  const handleCancelEdit = () => {
    setEditingPrizeId(null);
    setEditingField(null);
    setEditValue("");
  };

  const handleRandomDraw = async () => {
    const num = await utils.winners.random.fetch({ roomId: roomIdNum });
    if (num === null) {
      toast.error("所有號碼已抽完");
      return;
    }
    setDrawNumber(String(num));
  };

  const handleMarkWinner = () => {
    const num = parseInt(drawNumber);
    if (isNaN(num) || num < 1) {
      toast.error("請輸入有效號碼");
      return;
    }
    if (!selectedPrizeId) {
      toast.error("請選擇獎項");
      return;
    }
    if (state && num > state.room.maxNumber) {
      toast.error(`號碼超出範圍（1-${state.room.maxNumber}）`);
      return;
    }
    markWinnerMutation.mutate({
      roomId: roomIdNum,
      prizeId: parseInt(selectedPrizeId),
      number: num,
    });
  };

  const handleCopyLink = () => {
    if (!state) return;
    const url = `${window.location.origin}/view/${state.room.code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("連結已複製", { description: url });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportWinners = async () => {
    if (!state) return;
    try {
      const result = await utils.export.winners.fetch({ roomId: roomIdNum });
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      const filename = `${state.room.name}_中獎名單_${new Date().toISOString().split('T')[0]}.csv`;
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("名單已匯出", { description: `共 ${result.count} 筆中獎記錄` });
    } catch (err) {
      toast.error("匯出失敗", { description: err instanceof Error ? err.message : "未知錯誤" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">房間不存在或無權存取</p>
        <Link href="/host">
          <Button variant="outline" className="btn-press gap-2">
            <ArrowLeft className="h-4 w-4" /> 返回房間列表
          </Button>
        </Link>
      </div>
    );
  }

  const usedNumbers = new Set(state.winners.map((w: WinnerWithPrize) => w.number));
  const availableCount = state.room.maxNumber - usedNumbers.size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link href="/host">
            <Button variant="ghost" size="icon" className="btn-press">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight">{state.room.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm text-muted-foreground">
                號碼範圍 1–1<span className="font-mono font-bold">{state.room.maxNumber}</span> · 已抽 <span className="font-mono font-bold">{state.totalWinners}</span> / <span className="font-mono font-bold">{state.room.maxNumber}</span>
              </p>
              <Badge variant="secondary" className="text-xs">
                剩餘 <span className="font-mono font-bold">{availableCount}</span> 號
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="btn-press gap-1.5"
            onClick={handleCopyLink}
          >
            {copied ? <><Check className="h-3.5 w-3.5 text-green-600" /> 已複製</> : <><Copy className="h-3.5 w-3.5" /> 分享連結</>}
          </Button>
          <Link href={`/host/room/${roomId}/claims`}>
            <Button
              variant="outline"
              size="sm"
              className="btn-press gap-1.5"
            >
              <ClipboardList className="h-3.5 w-3.5" />
              兌獎清冊
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            className="btn-press gap-1.5"
            onClick={handleExportWinners}
          >
            <Download className="h-3.5 w-3.5" />
            匯出名單
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="btn-press gap-1.5 text-destructive hover:text-destructive"
            onClick={() => closeRoomMutation.mutate({ roomId: roomIdNum })}
          >
            關閉房間
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Prize Management + Draw */}
        <div className="lg:col-span-2 space-y-6">
          {/* Draw Section */}
          <Card className="elegant-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Crown className="h-5 w-5 text-[oklch(0.42_0.18_25)]" />
              <h2 className="font-serif text-xl font-semibold">抽獎操作</h2>
            </div>

            <div className="flex flex-col gap-4">
              {/* Prize selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium">選擇獎項</label>
                <Select value={selectedPrizeId} onValueChange={setSelectedPrizeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="請選擇獎項" />
                  </SelectTrigger>
                  <SelectContent>
                    {state.prizes.map((p: PrizeWithWinners) => (
                      <SelectItem
                        key={p.id}
                        value={String(p.id)}
                        disabled={p.remaining === 0}
                      >
                        {p.name} — 剩餘 <span className="font-mono font-bold">{p.remaining}/{p.quantity}</span>
                        {p.remaining === 0 && " (已抽完)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Number input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">中獎號碼</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="輸入號碼或隨機產生"
                    value={drawNumber}
                    onChange={(e) => setDrawNumber(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleMarkWinner();
                    }}
                    className="flex-1 text-lg font-mono font-bold text-center"
                  />
                  <Button
                    variant="outline"
                    className="btn-press gap-2"
                    onClick={handleRandomDraw}
                  >
                    <Shuffle className="h-4 w-4" />
                    隨機
                  </Button>
                  <Button
                    className="btn-press gap-2"
                    onClick={handleMarkWinner}
                    disabled={markWinnerMutation.isPending || !selectedPrizeId || !drawNumber}
                  >
                    {markWinnerMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <><Trophy className="h-4 w-4" /> 標記中獎</>
                    )}
                  </Button>
                </div>
                {drawNumber && usedNumbers.has(parseInt(drawNumber)) && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> 此號碼已中獎
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Prize Management */}
          <Card className="elegant-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Gift className="h-5 w-5 text-[oklch(0.42_0.18_25)]" />
              <h2 className="font-serif text-xl font-semibold">獎品管理</h2>
              <span className="text-xs text-muted-foreground ml-2">點擊名稱或數量可直接編輯</span>
            </div>

            {/* Prize list */}
            <div className="space-y-2">
              {state.prizes.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  尚未新增獎品，請在下方添加
                </p>
              )}
              {state.prizes.map((prize: PrizeWithWinners, index: number) => (
                <div
                  key={prize.id}
                  draggable
                  onDragStart={() => setDraggedPrize(prize)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverIndex(index);
                  }}
                  onDragLeave={() => setDragOverIndex(null)}
                  onDrop={() => {
                    if (draggedPrize && draggedPrize.id !== prize.id && state) {
                      const newPrizes = [...state.prizes];
                      const draggedIndex = newPrizes.findIndex(p => p.id === draggedPrize.id);
                      [newPrizes[draggedIndex], newPrizes[index]] = [newPrizes[index], newPrizes[draggedIndex]];
                      const updates = newPrizes.map((p, i) => ({
                        id: p.id,
                        sortOrder: i,
                      }));
                      reorderPrizeMutation.mutate({
                        roomId: roomIdNum,
                        prizes: updates,
                      });
                    }
                    setDraggedPrize(null);
                    setDragOverIndex(null);
                  }}
                  onDragEnd={() => {
                    setDraggedPrize(null);
                    setDragOverIndex(null);
                  }}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all group ${
                    draggedPrize?.id === prize.id
                      ? "opacity-50 border-dashed border-muted-foreground"
                      : dragOverIndex === index
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:bg-accent/30"
                  } cursor-move`}
                >
                  {/* Name (inline editable) */}
                  {editingPrizeId === prize.id && editingField === "name" ? (
                    <input
                      ref={editInputRef}
                      className="inline-edit-input flex-1 text-sm font-medium"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleConfirmEdit();
                        if (e.key === "Escape") handleCancelEdit();
                      }}
                      onBlur={handleConfirmEdit}
                    />
                  ) : (
                    <span
                      className="flex-1 text-sm font-medium cursor-text hover:text-[oklch(0.42_0.18_25)] transition-colors"
                      onClick={() => handleStartEdit(prize, "name")}
                    >
                      {prize.name}
                    </span>
                  )}

                  {/* Quantity (inline editable) */}
                  <div className="flex items-center gap-2">
                    {editingPrizeId === prize.id && editingField === "quantity" ? (
                      <input
                        ref={editInputRef}
                        type="number"
                        className="inline-edit-input w-16 text-sm text-center font-mono font-bold"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleConfirmEdit();
                          if (e.key === "Escape") handleCancelEdit();
                        }}
                        onBlur={handleConfirmEdit}
                      />
                    ) : (
                      <span
                        className="text-sm text-muted-foreground cursor-text hover:text-[oklch(0.42_0.18_25)] transition-colors tabular-nums font-mono font-bold"
                        onClick={() => handleStartEdit(prize, "quantity")}
                      >
                        {prize.winners.length}/{prize.quantity}
                      </span>
                    )}
                    {prize.remaining === 0 && prize.quantity > 0 && (
                      <Badge variant="secondary" className="text-xs bg-[oklch(0.75_0.12_80/0.15)] text-[oklch(0.50_0.15_55)]">
                        已抽完
                      </Badge>
                    )}
                  </div>

                  {/* Delete button */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    onClick={() => deletePrizeMutation.mutate({ id: prize.id })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Import Excel button */}
            <div className="mt-4 pt-4 border-t border-border space-y-2">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  disabled={isImporting || importMutation.isPending}
                  onClick={() => document.getElementById('excel-import-input')?.click()}
                >
                  {isImporting || importMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {isImporting || importMutation.isPending ? "匯入中..." : "匯入 Excel"}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={handleDownloadTemplate}
                >
                  <Download className="h-4 w-4" />
                  下載範本
                </Button>
              </div>
              <input
                id="excel-import-input"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImportExcel}
              />
            </div>

            {/* Add new prize */}
            <div className="flex gap-2 mt-4 pt-4 border-t border-border">
              <Input
                placeholder="獎品名稱"
                value={newPrizeName}
                onChange={(e) => setNewPrizeName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newPrizeName.trim()) {
                    addPrizeMutation.mutate({ roomId: roomIdNum, name: newPrizeName.trim(), quantity: newPrizeQty });
                  }
                }}
                className="flex-1"
              />
              <Input
                type="number"
                min={1}
                placeholder="數量"
                value={newPrizeQty}
                onChange={(e) => setNewPrizeQty(parseInt(e.target.value) || 1)}
                className="w-24 text-center"
              />
              <Button
                className="btn-press gap-1.5"
                disabled={!newPrizeName.trim() || addPrizeMutation.isPending}
                onClick={() => addPrizeMutation.mutate({ roomId: roomIdNum, name: newPrizeName.trim(), quantity: newPrizeQty })}
              >
                <Plus className="h-4 w-4" />
                新增
              </Button>
            </div>
          </Card>
        </div>

        {/* Right: Winners list */}
        <div className="space-y-6">
          <Card className="elegant-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="h-5 w-5 text-[oklch(0.75_0.12_80)]" />
              <h2 className="font-serif text-xl font-semibold">中獎紀錄</h2>
              <Badge variant="secondary" className="ml-auto">{state.totalWinners}</Badge>
            </div>

            {state.winners.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                尚無中獎紀錄
              </p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {state.winners.map((w: WinnerWithPrize, i: number) => (
                  <div
                    key={w.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card fade-in-up"
                    style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[oklch(0.75_0.12_80/0.15)] to-[oklch(0.42_0.18_25/0.08)] flex items-center justify-center shrink-0">
                      <span className="winner-number font-mono text-lg font-bold text-[oklch(0.42_0.18_25)]">
                        {w.number}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{w.prizeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(w.markedAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive opacity-60 hover:opacity-100 transition-opacity"
                      onClick={() => {
                        unmarkWinnerMutation.mutate({ winnerId: w.id });
                      }}
                      title="撤銷中獎標記"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Stats summary */}
          <Card className="elegant-card p-6">
            <h3 className="font-serif text-lg font-semibold mb-4">統計概覽</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">總獎品數</span>
                <span className="text-sm font-medium tabular-nums font-mono font-bold">
                  {state.prizes.reduce((sum: number, p: PrizeWithWinners) => sum + p.quantity, 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">已中獎人數</span>
                <span className="text-sm font-medium tabular-nums font-mono font-bold">{state.totalWinners}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">剩餘可抽號碼</span>
                <span className="text-sm font-medium tabular-nums font-mono font-bold">{availableCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">已抽完獎項</span>
                <span className="text-sm font-medium tabular-nums font-mono font-bold">
                  {state.prizes.filter((p: PrizeWithWinners) => p.remaining === 0 && p.quantity > 0).length}
                  /{state.prizes.length}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
