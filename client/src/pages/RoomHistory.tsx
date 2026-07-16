import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  History,
  ArrowLeft,
  RotateCcw,
  Trash2,
  Loader2,
  Trophy,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function RoomHistory() {
  return (
    <DashboardLayout>
      <RoomHistoryContent />
    </DashboardLayout>
  );
}

function RoomHistoryContent() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: closedRooms, isLoading } = trpc.rooms.closed.useQuery();

  const reopenMutation = trpc.rooms.reopen.useMutation({
    onSuccess: () => {
      utils.rooms.closed.invalidate();
      utils.rooms.active.invalidate();
      toast.success("房間已重新開啟");
    },
    onError: (err) => toast.error("操作失敗", { description: err.message }),
  });

  const deleteMutation = trpc.rooms.delete.useMutation({
    onSuccess: () => {
      utils.rooms.closed.invalidate();
      toast.success("房間已刪除");
    },
    onError: (err) => toast.error("刪除失敗", { description: err.message }),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/host">
          <Button variant="ghost" size="icon" className="btn-press">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">歷史紀錄</h1>
          <p className="text-muted-foreground mt-1">查看已關閉的房間，可重新開啟或刪除</p>
        </div>
      </div>

      {/* Room list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !closedRooms || closedRooms.length === 0 ? (
        <Card className="elegant-card p-16 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
              <History className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <div>
              <h3 className="font-serif text-xl font-semibold mb-1">尚無歷史紀錄</h3>
              <p className="text-muted-foreground text-sm">已關閉的房間將顯示於此</p>
            </div>
            <Link href="/host">
              <Button variant="outline" className="btn-press gap-2 mt-2">
                <ArrowLeft className="h-4 w-4" /> 返回房間列表
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {closedRooms.map((room, i) => (
            <Card
              key={room.id}
              className="elegant-card p-5 fade-in-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
                    <Trophy className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-serif text-lg font-semibold truncate">{room.name}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        關閉於 {room.closedAt ? new Date(room.closedAt).toLocaleDateString("zh-TW") : "—"}
                      </span>
                      <span>邀請碼：{room.code}</span>
                      <span>號碼 1–{room.maxNumber}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    已關閉
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="btn-press gap-1.5"
                    onClick={() => reopenMutation.mutate({ roomId: room.id })}
                    disabled={reopenMutation.isPending}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    重新開啟
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="btn-press gap-1.5 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        刪除
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="font-serif text-lg">確認刪除房間？</AlertDialogTitle>
                        <AlertDialogDescription>
                          此操作將永久刪除房間「{room.name}」及其所有獎品與中獎記錄，無法復原。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => deleteMutation.mutate({ roomId: room.id })}
                        >
                          確認刪除
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
