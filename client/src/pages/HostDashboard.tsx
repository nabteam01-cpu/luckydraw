import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Crown, Plus, History, ArrowRight, Copy, Check, Loader2, Trash2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

const menuItems = [
  { icon: Crown, label: "抽獎房間", path: "/host" },
  { icon: History, label: "歷史紀錄", path: "/host/history" },
];

export default function HostDashboard() {
  return (
    <DashboardLayout>
      <HostDashboardContent />
    </DashboardLayout>
  );
}

function HostDashboardContent() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMax, setNewMax] = useState(100);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: rooms, isLoading } = trpc.rooms.active.useQuery();
  const createMutation = trpc.rooms.create.useMutation({
    onSuccess: (room) => {
      utils.rooms.active.invalidate();
      setCreateOpen(false);
      setNewName("");
      setNewMax(100);
      toast.success("房間已建立", { description: `房間「${room.name}」已成功建立` });
      setLocation(`/host/room/${room.id}`);
    },
    onError: (err) => toast.error("建立失敗", { description: err.message }),
  });

  const closeMutation = trpc.rooms.close.useMutation({
    onSuccess: () => {
      utils.rooms.active.invalidate();
      utils.rooms.closed.invalidate();
      toast.success("房間已關閉");
    },
  });

  const handleCopyLink = (code: string, id: number) => {
    const url = `${window.location.origin}/view/${code}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success("連結已複製", { description: url });
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">抽獎房間</h1>
          <p className="text-muted-foreground mt-1">管理您的抽獎房間，建立新房間或進入現有房間</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="btn-press gap-2">
              <Plus className="h-4 w-4" />
              建立新房間
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">建立抽獎房間</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="room-name">房間名稱</Label>
                <Input
                  id="room-name"
                  placeholder="例如：年終尾牙抽獎"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newName.trim()) {
                      createMutation.mutate({ name: newName.trim(), maxNumber: newMax });
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-number">號碼範圍上限</Label>
                <Input
                  id="max-number"
                  type="number"
                  min={1}
                  max={99999}
                  value={newMax}
                  onChange={(e) => setNewMax(parseInt(e.target.value) || 100)}
                />
                <p className="text-xs text-muted-foreground">抽獎號碼範圍為 1 至此上限</p>
              </div>
              <Button
                className="w-full btn-press"
                disabled={!newName.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate({ name: newName.trim(), maxNumber: newMax })}
              >
                {createMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> 建立中...</>
                ) : (
                  "建立房間"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Room List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !rooms || rooms.length === 0 ? (
        <Card className="elegant-card p-16 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[oklch(0.42_0.18_25/0.06)] flex items-center justify-center">
              <Crown className="h-8 w-8 text-[oklch(0.42_0.18_25/0.4)]" />
            </div>
            <div>
              <h3 className="font-serif text-xl font-semibold mb-1">尚無進行中的房間</h3>
              <p className="text-muted-foreground text-sm">點擊「建立新房間」開始您的第一場抽獎</p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room, i) => (
            <Card
              key={room.id}
              className="elegant-card p-6 fade-in-up cursor-pointer group"
              style={{ animationDelay: `${i * 60}ms` }}
              onClick={() => setLocation(`/host/room/${room.id}`)}
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-serif text-lg font-semibold truncate">{room.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      號碼範圍 1–{room.maxNumber}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 ml-2">
                    進行中
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>邀請碼：</span>
                  <code 
                    className="px-2 py-0.5 rounded bg-muted font-mono text-sm font-medium cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(room.code);
                      toast.success("邀請碼已複製");
                    }}
                    title="點擊複製邀請碼"
                  >
                    {room.code}
                  </code>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-border" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="btn-press gap-1.5 flex-1"
                    onClick={() => setLocation(`/host/room/${room.id}`)}
                  >
                    進入房間
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="btn-press gap-1.5"
                    onClick={() => handleCopyLink(room.code, room.id)}
                  >
                    {copiedId === room.id ? (
                      <><Check className="h-3.5 w-3.5 text-green-600" /> 已複製</>
                    ) : (
                      <><Copy className="h-3.5 w-3.5" /> 複製連結</>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="btn-press text-destructive hover:text-destructive"
                    onClick={() => {
                      closeMutation.mutate({ roomId: room.id });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Link to history */}
      <div className="pt-4">
        <Link href="/host/history">
          <Button variant="outline" className="btn-press gap-2">
            <History className="h-4 w-4" />
            查看歷史紀錄
          </Button>
        </Link>
      </div>
    </div>
  );
}
