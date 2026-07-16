import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Check,
  X,
  Loader2,
  ArrowLeft,
  Download,
  Trash2,
  Edit2,
  Plus,
  Search,
  Filter,
} from "lucide-react";
import { Link, useParams } from "wouter";
import { useState, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import SignatureCanvas from "react-signature-canvas";
import html2pdf from "html2pdf.js";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";

export default function ClaimRecords() {
  return (
    <DashboardLayout>
      <ClaimRecordsContent />
    </DashboardLayout>
  );
}

interface ClaimRecord {
  id: number;
  roomId: number;
  winnerId: number;
  winnerName: string;
  status: "pending" | "claimed";
  claimedAt: Date | null;
  signature: string | null;
  createdAt: Date;
}

type SortField = "prizeName" | "winnerName" | "status" | "claimedAt";
type SortOrder = "asc" | "desc";

interface Winner {
  id: number;
  number: number;
  prizeId: number;
  prizeName?: string;
  drawnAt: Date;
}

function ClaimRecordsContent() {
  const { roomId } = useParams<{ roomId: string }>();
  const roomIdNum = parseInt(roomId || "0", 10);

  const utils = trpc.useUtils();
  const { data: state, isLoading } = trpc.rooms.getState.useQuery(
    { roomId: roomIdNum },
    { refetchInterval: 2000 }
  );

  const { data: records = [], refetch: refetchRecords } = trpc.claims.list.useQuery(
    { roomId: roomIdNum },
    { refetchInterval: 1000 }
  );

  const createClaimMutation = trpc.claims.create.useMutation({
    onSuccess: () => {
      utils.claims.list.invalidate({ roomId: roomIdNum });
      toast.success("兌獎記錄已建立");
    },
    onError: (err) => toast.error("建立失敗", { description: err.message }),
  });

  const updateClaimMutation = trpc.claims.update.useMutation({
    onSuccess: () => {
      utils.claims.list.invalidate({ roomId: roomIdNum });
      toast.success("兌獎記錄已更新");
    },
    onError: (err) => toast.error("更新失敗", { description: err.message }),
  });

  const deleteClaimMutation = trpc.claims.delete.useMutation({
    onSuccess: () => {
      utils.claims.list.invalidate({ roomId: roomIdNum });
      toast.success("兌獎記錄已刪除");
    },
    onError: (err) => toast.error("刪除失敗", { description: err.message }),
  });

  const exportClaimsMutation = trpc.export.claims.useQuery(
    { roomId: roomIdNum },
    { enabled: false }
  );

  // Local state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPrize, setFilterPrize] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "claimed">("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sortField, setSortField] = useState<SortField>("claimedAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [signingRecordId, setSigningRecordId] = useState<number | null>(null);
  const [previewSignature, setPreviewSignature] = useState<string | null>(null);

  // Get unique prizes for filter dropdown
  const uniquePrizes = useMemo(() => {
    if (!state?.prizes) return [];
    return state.prizes.map(p => ({ id: p.id, name: p.name }));
  }, [state?.prizes]);

  // Filter, sort and paginate records
  const { filteredRecords, totalCount, pageCount } = useMemo(() => {
    // Filter
    let filtered = records.filter(record => {
      if (searchQuery && !record.winnerName.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (filterStatus !== "all" && record.status !== filterStatus) {
        return false;
      }
      if (filterPrize) {
        const winner = state?.winners?.find(w => w.id === record.winnerId);
        if (winner?.prizeId !== parseInt(filterPrize, 10)) {
          return false;
        }
      }
      return true;
    });

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let aVal: any = "";
      let bVal: any = "";

      if (sortField === "prizeName") {
        const aPrize = state?.winners?.find(w => w.id === a.winnerId);
        const bPrize = state?.winners?.find(w => w.id === b.winnerId);
        aVal = state?.prizes?.find(p => p.id === aPrize?.prizeId)?.name || "";
        bVal = state?.prizes?.find(p => p.id === bPrize?.prizeId)?.name || "";
      } else if (sortField === "winnerName") {
        aVal = a.winnerName;
        bVal = b.winnerName;
      } else if (sortField === "status") {
        aVal = a.status === "claimed" ? 1 : 0;
        bVal = b.status === "claimed" ? 1 : 0;
      } else if (sortField === "claimedAt") {
        aVal = a.claimedAt ? new Date(a.claimedAt).getTime() : 0;
        bVal = b.claimedAt ? new Date(b.claimedAt).getTime() : 0;
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    // Paginate
    const totalCount = sorted.length;
    const pageCount = Math.ceil(totalCount / pageSize);
    const startIdx = (currentPage - 1) * pageSize;
    const paginatedRecords = sorted.slice(startIdx, startIdx + pageSize);

    return { filteredRecords: paginatedRecords, totalCount, pageCount };
  }, [records, searchQuery, filterStatus, filterPrize, state?.winners, state?.prizes, sortField, sortOrder, currentPage, pageSize]);

  // Clear selection and reset page when filters change
  useEffect(() => {
    setSelectedIds(new Set());
    setCurrentPage(1);
  }, [searchQuery, filterStatus, filterPrize]);

  // Handle sort column click
  const handleSortClick = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  // Handle signature save
  const handleSaveSignature = (recordId: number, signatureData: string) => {
    updateClaimMutation.mutate({
      id: recordId,
      signature: signatureData,
    });
    setSigningRecordId(null);
  };

  // Handle open signature pad
  const handleOpenSignaturePad = (recordId: number) => {
    setSigningRecordId(recordId);
  };

  // Handle export
  const handleExportClaims = async (format: "csv" | "html" | "pdf" = "html") => {
    try {
      const result = await exportClaimsMutation.refetch();
      if (format === "html" && result.data?.html) {
        const blob = new Blob([result.data.html], { type: "text/html;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `${result.data.roomName}_兌獎清冊_${new Date().toLocaleDateString("zh-TW")}.html`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("兌獎清冊已匯出為 HTML");
      } else if (format === "csv" && result.data?.csv) {
        const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `${result.data.roomName}_兌獎清冊_${new Date().toLocaleDateString("zh-TW")}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("兌獎清冊已匯出為 CSV");
      } else if (format === "pdf" && result.data?.pdf) {
        // 解碼 Base64 HTML 內容
        const htmlContent = atob(result.data.pdf);
        // 使用 html2pdf 轉換為 PDF
        const element = document.createElement("div");
        element.innerHTML = htmlContent;
        const opt = {
          margin: 10,
          filename: `${result.data.roomName}_兌獎清冊_${new Date().toLocaleDateString("zh-TW")}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { orientation: "portrait", unit: "mm", format: "a4" },
        };
        (html2pdf() as any).set(opt).from(element).save();
        toast.success("兌獎清冊已匯出為 PDF");
      }
    } catch (err) {
      toast.error("匯出失敗");
    }
  };

  // Handle toggle claim status
  const handleToggleClaim = (record: ClaimRecord) => {
    const newStatus = record.status === "pending" ? "claimed" : "pending";
    updateClaimMutation.mutate({
      id: record.id,
      status: newStatus,
    });
  };

  // Handle edit name
  const handleEditName = (record: ClaimRecord) => {
    setEditingId(record.id);
    setEditingName(record.winnerName);
  };

  const handleSaveName = (recordId: number) => {
    if (!editingName.trim()) {
      toast.error("姓名不能為空");
      return;
    }
    updateClaimMutation.mutate({
      id: recordId,
      winnerName: editingName,
    });
    setEditingId(null);
  };

  // Handle delete
  const handleDelete = (recordId: number) => {
    if (confirm("確認刪除此兌獎記錄？")) {
      deleteClaimMutation.mutate({ id: recordId });
    }
  };

  // Handle bulk operations
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredRecords.map(r => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRecord = (recordId: number, checked: boolean) => {
    if (!filteredRecords.find(r => r.id === recordId)) {
      return;
    }
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(recordId);
    } else {
      newSelected.delete(recordId);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkMarkClaimed = () => {
    if (selectedIds.size === 0) {
      toast.error("請先選擇要標記的記錄");
      return;
    }
    const count = selectedIds.size;
    if (confirm(`確認標記 ${count} 筆記錄為已領取？`)) {
      let completed = 0;
      let failed = 0;

      selectedIds.forEach(id => {
        updateClaimMutation.mutate(
          {
            id,
            status: "claimed",
          },
          {
            onSuccess: () => {
              completed++;
              if (completed + failed === count) {
                setSelectedIds(new Set());
                if (failed === 0) {
                  toast.success(`已標記 ${count} 筆記錄為已領取`);
                } else {
                  toast.warning(`已標記 ${completed} 筆，${failed} 筆失敗`);
                }
              }
            },
            onError: () => {
              failed++;
              if (completed + failed === count) {
                setSelectedIds(new Set());
                if (failed === 0) {
                  toast.success(`已標記 ${count} 筆記錄為已領取`);
                } else {
                  toast.warning(`已標記 ${completed} 筆，${failed} 筆失敗`);
                }
              }
            },
          }
        );
      });
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) {
      toast.error("請先選擇要刪除的記錄");
      return;
    }
    const count = selectedIds.size;
    if (confirm(`確認刪除 ${count} 筆記錄？此操作無法復原。`)) {
      let completed = 0;
      let failed = 0;

      selectedIds.forEach(id => {
        deleteClaimMutation.mutate(
          { id },
          {
            onSuccess: () => {
              completed++;
              if (completed + failed === count) {
                setSelectedIds(new Set());
                if (failed === 0) {
                  toast.success(`已刪除 ${count} 筆記錄`);
                } else {
                  toast.warning(`已刪除 ${completed} 筆，${failed} 筆失敗`);
                }
              }
            },
            onError: () => {
              failed++;
              if (completed + failed === count) {
                setSelectedIds(new Set());
                if (failed === 0) {
                  toast.success(`已刪除 ${count} 筆記錄`);
                } else {
                  toast.warning(`已刪除 ${completed} 筆，${failed} 筆失敗`);
                }
              }
            },
          }
        );
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!state) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">房間不存在或無法載入</p>
      </div>
    );
  }

  const pendingCount = records.filter(r => r.status === "pending").length;
  const claimedCount = records.filter(r => r.status === "claimed").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={`/host/room/${roomIdNum}`}>
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              返回
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{state.room.name}</h1>
            <p className="text-sm text-muted-foreground">兌獎清冊</p>
          </div>
        </div>

        <Button
          onClick={() => handleExportClaims("html")}
          disabled={exportClaimsMutation.isLoading}
          className="gap-1.5"
        >
          {exportClaimsMutation.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          匯出清冊 (HTML)
        </Button>
        <Button
          onClick={() => handleExportClaims("csv")}
          disabled={exportClaimsMutation.isLoading}
          variant="outline"
          className="gap-1.5"
        >
          {exportClaimsMutation.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          匯出清冊 (CSV)
        </Button>
        <Button
          onClick={() => handleExportClaims("pdf")}
          disabled={exportClaimsMutation.isLoading}
          variant="outline"
          className="gap-1.5"
        >
          {exportClaimsMutation.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          匯出清冊 (PDF)
        </Button>
      </div>

      {/* Import from Winners */}
      {state.winners && state.winners.length > 0 && records.length < state.winners.length && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-blue-900">從中獎名單匯入</h3>
              <p className="text-sm text-blue-700">還有 {state.winners.length - records.length} 位中獎者未建立兌獎記錄</p>
            </div>
            <Button
              onClick={() => {
                state.winners.forEach((w) => {
                  const exists = records.some(r => r.winnerId === w.id);
                  if (!exists) {
                    createClaimMutation.mutate({
                      roomId: roomIdNum,
                      winnerId: w.id,
                      winnerName: `號碼 ${w.number}`,
                    });
                  }
                });
              }}
              disabled={createClaimMutation.isPending}
              className="gap-1.5"
            >
              {createClaimMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              匯入全部
            </Button>
          </div>
        </Card>
      )}

      {/* Statistics by Prize */}
      {state?.prizes && state.prizes.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-4">按獎品分類統計</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2">獎品名稱</th>
                  <th className="text-center py-2">領取數</th>
                  <th className="text-center py-2">未領取</th>
                  <th className="text-center py-2">總數</th>
                  <th className="text-center py-2">領取率</th>
                </tr>
              </thead>
              <tbody>
                {state.prizes.map(prize => {
                  const prizeWinners = state.winners?.filter(w => w.prizeId === prize.id) || [];
                  const claimed = records.filter(r => {
                    const winner = state.winners?.find(w => w.id === r.winnerId);
                    return winner?.prizeId === prize.id && r.status === "claimed";
                  }).length;
                  const total = prizeWinners.length;
                  const pending = total - claimed;
                  const rate = total === 0 ? 0 : ((claimed / total) * 100).toFixed(1);
                  return (
                    <tr key={prize.id} className="border-b hover:bg-accent/50">
                      <td className="py-2">{prize.name}</td>
                      <td className="text-center text-green-600 font-semibold">{claimed}</td>
                      <td className="text-center text-amber-600 font-semibold">{pending}</td>
                      <td className="text-center font-semibold">{total}</td>
                      <td className="text-center">{rate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">總記錄數</div>
          <div className="text-2xl font-bold font-mono">{totalCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">未領取</div>
          <div className="text-2xl font-bold font-mono text-amber-600">{pendingCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">已領取</div>
          <div className="text-2xl font-bold font-mono text-green-600">{claimedCount}</div>
        </Card>
      </div>

      {/* Search and Filter Bar */}
      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜尋中獎者姓名..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filter by Prize */}
          <select
            value={filterPrize || ""}
            onChange={(e) => setFilterPrize(e.target.value || null)}
            className="px-3 py-2 border border-input rounded-md bg-background text-foreground"
          >
            <option value="">所有獎品</option>
            {uniquePrizes.map(prize => (
              <option key={prize.id} value={prize.id}>
                {prize.name}
              </option>
            ))}
          </select>

          {/* Filter by Status */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as "all" | "pending" | "claimed")}
            className="px-3 py-2 border border-input rounded-md bg-background text-foreground"
          >
            <option value="all">所有狀態</option>
            <option value="pending">未領取</option>
            <option value="claimed">已領取</option>
          </select>

          {/* Clear Filters */}
          {(searchQuery || filterPrize || filterStatus !== "all") && (
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery("");
                setFilterPrize(null);
                setFilterStatus("all");
              }}
              className="gap-1.5"
            >
              <X className="h-4 w-4" />
              清除篩選
            </Button>
          )}
        </div>
      </Card>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-blue-900">已選擇 {selectedIds.size} 筆記錄</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleBulkMarkClaimed}
                className="gap-1.5"
                size="sm"
              >
                <Check className="h-4 w-4" />
                批量標記已領取
              </Button>
              <Button
                onClick={handleBulkDelete}
                variant="destructive"
                className="gap-1.5"
                size="sm"
              >
                <Trash2 className="h-4 w-4" />
                批量刪除
              </Button>
              <Button
                onClick={() => setSelectedIds(new Set())}
                variant="outline"
                size="sm"
              >
                取消選擇
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        {filteredRecords.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-muted-foreground">暫無兌獎記錄</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedIds.size === filteredRecords.length && filteredRecords.length > 0}
                      onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                    />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-accent select-none"
                    onClick={() => handleSortClick("prizeName")}
                  >
                    獎品名稱 {sortField === "prizeName" && (sortOrder === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-accent select-none"
                    onClick={() => handleSortClick("winnerName")}
                  >
                    中獎者姓名 {sortField === "winnerName" && (sortOrder === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-accent select-none"
                    onClick={() => handleSortClick("status")}
                  >
                    領取狀態 {sortField === "status" && (sortOrder === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-accent select-none"
                    onClick={() => handleSortClick("claimedAt")}
                  >
                    領取時間 {sortField === "claimedAt" && (sortOrder === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead>簽名</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <ClaimRecordRow
                    key={record.id}
                    record={record}
                    state={state}
                    isEditing={editingId === record.id}
                    editingName={editingName}
                    isSelected={selectedIds.has(record.id)}
                    onSelect={(checked) => handleSelectRecord(record.id, checked as boolean)}
                    onEditName={() => handleEditName(record)}
                    onSaveName={() => handleSaveName(record.id)}
                    onToggleClaim={() => handleToggleClaim(record)}
                    onDelete={() => handleDelete(record.id)}
                    onEditingNameChange={setEditingName}
                    onOpenSignaturePad={() => handleOpenSignaturePad(record.id)}
                    onSaveSignature={(sig) => handleSaveSignature(record.id, sig)}
                    onPreviewSignature={(sig) => setPreviewSignature(sig)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {pageCount > 1 && (
        <Card className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">每頁</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value, 10));
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-input rounded-md text-sm"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <span className="text-sm text-muted-foreground">
              筆 | 第 {currentPage} / {pageCount} 頁 | 共 {totalCount} 筆
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              上一頁
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(pageCount, currentPage + 1))}
              disabled={currentPage === pageCount}
            >
              下一頁
            </Button>
          </div>
        </Card>
      )}

      {/* Signature Pad Modal */}
      {signingRecordId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md p-6">
            <h3 className="font-semibold mb-4">簽名</h3>
            <SignaturePadModal
              recordId={signingRecordId}
              onSave={handleSaveSignature}
              onClose={() => setSigningRecordId(null)}
            />
          </Card>
        </div>
      )}

      {/* 簽名預覽模態 */}
      {previewSignature && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setPreviewSignature(null)}>
          <Card className="p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">簽名預覽</h2>
              <button
                onClick={() => setPreviewSignature(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <div className="bg-white border rounded p-4 flex justify-center">
              <img src={previewSignature} alt="簽名預覽" className="max-h-96 max-w-full" />
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setPreviewSignature(null)}>
                關閉
              </Button>
              <Button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = previewSignature;
                  link.download = `signature-${Date.now()}.png`;
                  link.click();
                }}
              >
                下載簽名
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

interface SignaturePadModalProps {
  recordId: number;
  onSave: (recordId: number, signature: string) => void;
  onClose: () => void;
}

function SignaturePadModal({ recordId, onSave, onClose }: SignaturePadModalProps) {
  const signatureCanvasRef = useRef<any>(null);

  const handleClear = () => {
    if (signatureCanvasRef.current) {
      signatureCanvasRef.current.clear();
    }
  };

  const handleSave = () => {
    if (signatureCanvasRef.current) {
      // 檢查簽名是否為空
      const canvas = signatureCanvasRef.current.getCanvas();
      const imageData = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      let isEmpty = true;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] !== 0) {
          isEmpty = false;
          break;
        }
      }
      
      if (isEmpty) {
        toast.error("簽名不能為空", { description: "請在簽名板上簽名" });
        return;
      }
      
      const signatureData = signatureCanvasRef.current.toDataURL("image/png");
      onSave(recordId, signatureData);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-gray-300 rounded-lg bg-white">
        <SignatureCanvas
          ref={signatureCanvasRef}
          canvasProps={{
            width: 400,
            height: 200,
            className: "w-full",
          }}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={handleClear}>
          清除
        </Button>
        <Button variant="outline" onClick={onClose}>
          取消
        </Button>
        <Button onClick={handleSave}>
          保存簽名
        </Button>
      </div>
    </div>
  );
}

interface ClaimRecordRowProps {
  record: ClaimRecord;
  state: any;
  isEditing: boolean;
  editingName: string;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onEditName: () => void;
  onSaveName: () => void;
  onToggleClaim: () => void;
  onDelete: () => void;
  onEditingNameChange: (name: string) => void;
  onOpenSignaturePad: () => void;
  onSaveSignature: (signature: string) => void;
  onPreviewSignature: (signature: string | null) => void;
}

function ClaimRecordRow({
  record,
  state,
  isEditing,
  editingName,
  isSelected,
  onSelect,
  onEditName,
  onSaveName,
  onToggleClaim,
  onDelete,
  onEditingNameChange,
  onOpenSignaturePad,
  onSaveSignature,
  onPreviewSignature,
}: ClaimRecordRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Find corresponding winner and prize
  const winner = state?.winners?.find((w: any) => w.id === record.winnerId);
  const prize = state?.prizes?.find((p: any) => p.id === winner?.prizeId);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  return (
    <TableRow className="hover:bg-accent/50 transition-colors">
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          disabled={isEditing}
        />
      </TableCell>
      <TableCell className="font-medium">{prize?.name || "未知獎品"}</TableCell>
      <TableCell>
        {isEditing ? (
          <Input
            ref={inputRef}
            value={editingName}
            onChange={(e) => onEditingNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveName();
              if (e.key === "Escape") {
                onEditingNameChange("");
                onEditName();
              }
            }}
            className="font-mono text-sm"
            placeholder="輸入中獎者姓名"
          />
        ) : (
          <div
            onClick={onEditName}
            className="font-mono text-sm cursor-pointer hover:text-primary transition-colors"
            title="點擊編輯姓名"
          >
            {record.winnerName}
          </div>
        )}
      </TableCell>
      <TableCell>
        <Badge
          variant={record.status === "claimed" ? "default" : "secondary"}
        >
          {record.status === "claimed" ? "已領取" : "未領取"}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {record.claimedAt
          ? new Date(record.claimedAt).toLocaleString("zh-TW")
          : "-"}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {record.signature ? (
            <img
              src={record.signature}
              alt="簽名"
              className="h-8 w-16 border rounded cursor-pointer hover:opacity-80"
              title="點擊查看簽名"
              onClick={() => onPreviewSignature(record.signature)}
            />
          ) : (
            <span className="text-xs text-muted-foreground">未簽名</span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenSignaturePad}
            disabled={isEditing}
          >
            簽名
          </Button>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          {isEditing ? (
            <>
              <Button
                size="sm"
                variant="default"
                onClick={onSaveName}
                className="gap-1"
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onEditingNameChange("");
                  onEditName();
                }}
                className="gap-1"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant={record.status === "claimed" ? "outline" : "default"}
                onClick={onToggleClaim}
                className="gap-1"
                title={record.status === "claimed" ? "標記未領取" : "標記已領取"}
              >
                {record.status === "claimed" ? (
                  <X className="h-3.5 w-3.5" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onDelete}
                className="text-destructive hover:text-destructive gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
