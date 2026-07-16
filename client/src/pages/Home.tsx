import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Crown, Eye, ArrowRight, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { startLogin } from "@/const";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Hero Section */}
      <header className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-[oklch(0.42_0.18_25/0.06)] via-transparent to-[oklch(0.75_0.12_80/0.06)]" />
        <div className="absolute inset-0 shimmer opacity-30" />
        <div className="relative container mx-auto px-6 py-20 md:py-28 max-w-5xl">
          <div className="flex flex-col items-center text-center gap-6">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground tracking-widest uppercase">
              <Sparkles className="h-4 w-4 text-[oklch(0.75_0.12_80)]" />
              <span>即時抽獎系統</span>
              <Sparkles className="h-4 w-4 text-[oklch(0.75_0.12_80)]" />
            </div>
            <h1 className="font-serif text-5xl md:text-7xl font-semibold tracking-tight leading-tight">
              <span className="text-gold-gradient">Lucky Draw</span>
              <br />
              <span className="text-foreground">優雅抽獎，完美呈現</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
              精緻的線上抽獎平台，讓每一場抽獎活動都充滿儀式感。
              主辦人輕鬆管理，觀看者即時參與，所有動態無縫同步。
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              {isAuthenticated ? (
                <Link href="/host">
                  <Button size="lg" className="btn-press gap-2 px-8 text-base">
                    <Crown className="h-5 w-5" />
                    進入主辦人介面
                  </Button>
                </Link>
              ) : (
                <Button
                  size="lg"
                  className="btn-press gap-2 px-8 text-base"
                  onClick={() => startLogin()}
                  disabled={loading}
                >
                  <Crown className="h-5 w-5" />
                  登入開始主辦
                </Button>
              )}
              <Button size="lg" variant="outline" className="btn-press gap-2 px-8 text-base" onClick={() => window.location.href = '/view'}>
                <Eye className="h-5 w-5" />
                我是觀看者
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Feature Cards */}
      <main className="flex-1 container mx-auto px-6 py-16 max-w-5xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="elegant-card p-8 group cursor-pointer" onClick={() => window.location.href = '/host'}>
            <div className="flex flex-col gap-4">
              <div className="w-12 h-12 rounded-xl bg-[oklch(0.42_0.18_25/0.08)] flex items-center justify-center">
                <Crown className="h-6 w-6 text-[oklch(0.42_0.18_25)]" />
              </div>
              <div>
                <h3 className="font-serif text-2xl font-semibold mb-2">主辦人介面</h3>
                <p className="text-muted-foreground leading-relaxed">
                  建立抽獎房間、管理獎品清單、執行抽獎操作。支援手動輸入與隨機產生號碼，
                  內嵌編輯獎品，撤銷中獎標記，完整房間歷史管理。
                </p>
              </div>
              <div className="flex items-center gap-1 text-sm font-medium text-[oklch(0.42_0.18_25)] group-hover:gap-2 transition-all">
                <span>前往管理</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </Card>

          <Card className="elegant-card p-8 group cursor-pointer" onClick={() => window.location.href = '/view'}>
            <div className="flex flex-col gap-4">
              <div className="w-12 h-12 rounded-xl bg-[oklch(0.75_0.12_80/0.12)] flex items-center justify-center">
                <Eye className="h-6 w-6 text-[oklch(0.65_0.15_55)]" />
              </div>
              <div>
                <h3 className="font-serif text-2xl font-semibold mb-2">觀看者頁面</h3>
                <p className="text-muted-foreground leading-relaxed">
                  透過房間連結即時加入，頁面即時顯示中獎號碼、各獎品剩餘數量，
                  以及完整的抽獎動態。無需登入，僅供瀏覽，所有狀態無縫同步。
                </p>
              </div>
              <div className="flex items-center gap-1 text-sm font-medium text-[oklch(0.65_0.15_55)] group-hover:gap-2 transition-all">
                <span>前往觀看</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </Card>
        </div>

        {/* Feature highlights */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { title: "即時同步", desc: "所有中獎標記、獎品數量變動即時同步至觀看者頁面" },
            { title: "內嵌編輯", desc: "點擊獎品名稱或數量即可直接修改，無需彈出對話框" },
            { title: "歷史管理", desc: "查看過往已關閉的房間，支援重新開啟或刪除" },
          ].map((feature, i) => (
            <div key={i} className="text-center fade-in-up" style={{ animationDelay: `${i * 80}ms` }}>
              <h4 className="font-serif text-lg font-semibold mb-2">{feature.title}</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-6 max-w-5xl text-center">
          <p className="text-sm text-muted-foreground font-serif tracking-wide">
            Lucky Draw System — 優雅抽獎，完美呈現
          </p>
        </div>
      </footer>
    </div>
  );
}
