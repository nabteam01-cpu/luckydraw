import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Trophy,
  Gift,
  Eye,
  Loader2,
  Sparkles,
  TrendingDown,
  CheckCircle2,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "wouter";

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

export default function ViewerPage() {
  const { code } = useParams<{ code: string }>();
  const [inputCode, setInputCode] = useState("");
  const [activeCode, setActiveCode] = useState(code || "");
  const [showJoin, setShowJoin] = useState(!code);

  const utils = trpc.useUtils();
  const { data: state, isLoading, error } = trpc.viewer.getState.useQuery(
    { code: activeCode },
    { enabled: !!activeCode }
  );

  // Polling for real-time updates
  useEffect(() => {
    if (!activeCode) return;
    const interval = setInterval(() => {
      utils.viewer.getState.invalidate({ code: activeCode });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeCode, utils]);

  // Track new winners for animation
  const prevWinnersRef = useRef<number[]>([]);
  const [newWinnerIds, setNewWinnerIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!state) return;
    const currentIds = state.winners.map((w: WinnerWithPrize) => w.id);
    const newIds = currentIds.filter((id: number) => !prevWinnersRef.current.includes(id));
    if (newIds.length > 0) {
      setNewWinnerIds(new Set(newIds));
      setTimeout(() => setNewWinnerIds(new Set()), 2000);
    }
    prevWinnersRef.current = currentIds;
  }, [state?.winners]);

  const handleJoin = () => {
    if (inputCode.trim()) {
      setActiveCode(inputCode.trim().toUpperCase());
      setShowJoin(false);
    }
  };

  // Join screen
  if (showJoin || !activeCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="absolute inset-0 bg-gradient-to-br from-[oklch(0.42_0.18_25/0.04)] via-transparent to-[oklch(0.75_0.12_80/0.04)]" />
        <Card className="elegant-card p-10 max-w-md w-full relative">
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[oklch(0.75_0.12_80/0.15)] to-[oklch(0.42_0.18_25/0.08)] flex items-center justify-center">
              <Eye className="h-8 w-8 text-[oklch(0.42_0.18_25)]" />
            </div>
            <div className="text-center">
              <h1 className="font-serif text-3xl font-semibold mb-2">加入抽獎房間</h1>
              <p className="text-muted-foreground text-sm">請輸入主辦人提供的邀請碼</p>
            </div>
            <div className="w-full space-y-3">
              <Input
                placeholder="輸入邀請碼"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleJoin();
                }}
                className="text-center text-lg font-mono tracking-widest uppercase"
              />
              <Button className="w-full btn-press" onClick={handleJoin} disabled={!inputCode.trim()}>
                進入房間
              </Button>
            </div>
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                返回首頁
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error
  if (error || !state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="elegant-card p-10 max-w-md w-full text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <span className="text-2xl">!</span>
            </div>
            <div>
              <h2 className="font-serif text-xl font-semibold mb-1">房間不存在</h2>
              <p className="text-muted-foreground text-sm">
                {error?.message || "請確認邀請碼是否正確"}
              </p>
            </div>
            <Button variant="outline" className="btn-press" onClick={() => setShowJoin(true)}>
              重新輸入邀請碼
            </Button>
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                返回首頁
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const usedNumbers = new Set(state.winners.map((w: WinnerWithPrize) => w.number));
  const availableCount = state.room.maxNumber - usedNumbers.size;
  const allPrizesDepleted = state.prizes.length > 0 && state.prizes.every((p: PrizeWithWinners) => p.remaining === 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
        <div className="container mx-auto px-6 py-4 max-w-5xl">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[oklch(0.75_0.12_80/0.15)] to-[oklch(0.42_0.18_25/0.08)] flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-[oklch(0.42_0.18_25)]" />
              </div>
              <div>
                <h1 className="font-serif text-xl font-semibold tracking-tight">{state.room.name}</h1>
                <p className="text-xs text-muted-foreground">
                  觀看者模式 · 即時同步中
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5 animate-pulse" />
                即時連線
              </Badge>
              <Badge variant="outline" className="text-xs">
                剩餘 <span className="font-mono font-bold">{availableCount}</span> 號
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-5xl">
        {/* All prizes depleted banner */}
        {allPrizesDepleted && (
          <div className="mb-6 p-6 rounded-xl bg-gradient-to-r from-[oklch(0.75_0.12_80/0.1)] to-[oklch(0.42_0.18_25/0.06)] border border-[oklch(0.75_0.12_80/0.2)] fade-in-up">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-[oklch(0.50_0.15_55)]" />
              <div>
                <p className="font-serif text-lg font-semibold">所有獎項已抽完！</p>
                <p className="text-sm text-muted-foreground">感謝參與，恭喜所有中獎者</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Prize Status */}
          <div className="space-y-6">
            <Card className="elegant-card p-6">
              <div className="flex items-center gap-2 mb-5">
                <Gift className="h-5 w-5 text-[oklch(0.42_0.18_25)]" />
                <h2 className="font-serif text-xl font-semibold">獎品剩餘數量</h2>
              </div>

              {state.prizes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  主辦人尚未新增獎品
                </p>
              ) : (
                <div className="space-y-3">
                  {state.prizes.map((prize: PrizeWithWinners, i: number) => {
                    const total = prize.quantity;
                    const drawn = prize.winners.length;
                    const pct = total > 0 ? (drawn / total) * 100 : 0;
                    return (
                      <div
                        key={prize.id}
                        className="fade-in-up"
                        style={{ animationDelay: `${i * 60}ms` }}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium">{prize.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm tabular-nums text-muted-foreground">
                              {drawn}/{total}
                            </span>
                            {prize.remaining === 0 && (
                              <Badge variant="secondary" className="text-xs bg-[oklch(0.75_0.12_80/0.15)] text-[oklch(0.50_0.15_55)]">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> 已抽完
                              </Badge>
                            )}
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500 ease-out"
                            style={{
                              width: `${pct}%`,
                              background: prize.remaining === 0
                                ? "linear-gradient(90deg, oklch(0.75 0.12 80), oklch(0.65 0.15 55))"
                                : "linear-gradient(90deg, oklch(0.55 0.16 25), oklch(0.42 0.18 25))",
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          剩餘 <span className="font-mono font-bold">{prize.remaining}</span> 個名額
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Stats */}
            <Card className="elegant-card p-6">
              <h3 className="font-serif text-lg font-semibold mb-4">抽獎概況</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-mono font-bold tabular-nums">{state.totalWinners}</p>
                  <p className="text-xs text-muted-foreground mt-1">已中獎</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-mono font-bold tabular-nums">{availableCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">待抽出</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-mono font-bold tabular-nums">
                    {state.prizes.filter((p: PrizeWithWinners) => p.remaining === 0 && p.quantity > 0).length}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">已抽完</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Right: Winners Timeline */}
          <div>
            <Card className="elegant-card p-6">
              <div className="flex items-center gap-2 mb-5">
                <Trophy className="h-5 w-5 text-[oklch(0.75_0.12_80)]" />
                <h2 className="font-serif text-xl font-semibold">中獎動態</h2>
                <Badge variant="secondary" className="ml-auto">{state.totalWinners}</Badge>
              </div>

              {state.winners.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center">
                    <Trophy className="h-7 w-7 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">等待抽獎開始...</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {state.winners.map((w: WinnerWithPrize, i: number) => {
                    const isNew = newWinnerIds.has(w.id);
                    return (
                      <div
                        key={w.id}
                        className={`flex items-center gap-4 p-4 rounded-xl border border-border bg-card fade-in-up ${isNew ? "pulse-glow" : ""}`}
                        style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                      >
                        {/* Number badge */}
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${isNew ? "bg-gradient-to-br from-[oklch(0.75_0.12_80)] to-[oklch(0.55_0.16_25)]" : "bg-gradient-to-br from-[oklch(0.75_0.12_80/0.15)] to-[oklch(0.42_0.18_25/0.08)]"}`}>
                          <span className={`winner-number font-mono font-bold text-2xl ${isNew ? "text-white" : "text-[oklch(0.42_0.18_25)]"}`}>
                            {w.number}
                          </span>
                        </div>
                        {/* Prize info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{w.prizeName}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(w.markedAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </p>
                        </div>
                        {isNew && (
                          <Badge className="bg-[oklch(0.75_0.12_80/0.2)] text-[oklch(0.50_0.15_55)] border-none text-xs">
                            <Sparkles className="h-3 w-3 mr-1" /> NEW
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-6 mt-8">
        <div className="container mx-auto px-6 max-w-5xl text-center">
          <p className="text-xs text-muted-foreground font-serif tracking-wide">
            Lucky Draw System · 觀看者模式 · 僅供瀏覽
          </p>
        </div>
      </footer>
    </div>
  );
}
