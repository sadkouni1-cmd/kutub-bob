import { useEffect, useMemo, useRef, useState } from "react";
import { Download, CheckCircle2, Loader2, WifiOff, XCircle } from "lucide-react";
import { books } from "@/data/books";
import { getCachedContent, saveCachedContent, listCachedBookIds } from "@/lib/library-storage";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Status = "idle" | "running" | "paused" | "done" | "error";

const STORAGE_LAST_RUN = "rwb:offline:lastRun";

export const OfflineDownloader = ({ className }: { className?: string }) => {
  const total = books.length;
  const [cachedCount, setCachedCount] = useState(() => listCachedBookIds().length);
  const [status, setStatus] = useState<Status>("idle");
  const [currentTitle, setCurrentTitle] = useState<string>("");
  const [failed, setFailed] = useState(0);
  const abortRef = useRef(false);
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const remaining = useMemo(
    () => books.filter((b) => !getCachedContent(b.id)),
    // recompute on cachedCount change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cachedCount, status],
  );

  const start = async () => {
    if (status === "running") return;
    abortRef.current = false;
    setStatus("running");
    setFailed(0);

    for (const book of remaining) {
      if (abortRef.current) {
        setStatus("paused");
        return;
      }
      // Skip if became cached in another tab / previous partial run
      if (getCachedContent(book.id)) continue;

      setCurrentTitle(book.title);

      try {
        const { data, error } = await supabase.functions.invoke("get-book-content", {
          body: {
            bookId: book.id,
            title: book.title,
            author: book.author,
            language: book.language,
            category: book.category,
            description: book.description,
            sourceUrl: book.sourceUrl,
          },
        });
        if (error) throw error;
        const pages = data?.pages as string[] | undefined;
        const source = (data?.source as string) ?? "ai-summary";
        if (pages?.length) {
          saveCachedContent(book.id, pages, source);
          setCachedCount(listCachedBookIds().length);
        } else {
          setFailed((n) => n + 1);
        }
      } catch {
        setFailed((n) => n + 1);
        // Small backoff on failure to avoid hammering
        await new Promise((r) => setTimeout(r, 800));
      }

      // Gentle pacing so the AI gateway doesn't rate-limit
      await new Promise((r) => setTimeout(r, 250));
    }

    setCurrentTitle("");
    setStatus("done");
    try {
      localStorage.setItem(STORAGE_LAST_RUN, String(Date.now()));
    } catch { /* ignore */ }
  };

  const stop = () => {
    abortRef.current = true;
  };

  const pct = Math.round((cachedCount / total) * 100);
  const allDone = cachedCount >= total;

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card p-4 sm:p-5 shadow-soft",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="font-display text-lg sm:text-xl text-primary flex items-center gap-2">
            <WifiOff className="h-5 w-5" />
            المكتبة بدون إنترنت
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            حمّل ملخّصات جميع الكتب مرة واحدة، وستكون متاحة دائمًا على جهازك حتى بدون اتصال.
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="font-display text-2xl text-primary">
            {cachedCount}<span className="text-muted-foreground text-base"> / {total}</span>
          </div>
          <div className="text-[10px] text-muted-foreground">كتاب محفوظ</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-2 w-full rounded-full bg-secondary overflow-hidden">
        <div
          className={cn(
            "h-full bg-primary transition-all duration-500",
            status === "running" && "animate-pulse",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground gap-2">
        <span className="truncate">
          {status === "running" && currentTitle && (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              جارٍ حفظ: {currentTitle}
            </span>
          )}
          {status === "done" && (
            <span className="inline-flex items-center gap-1 text-primary">
              <CheckCircle2 className="h-3.5 w-3.5" /> اكتمل الحفظ
            </span>
          )}
          {status === "paused" && (
            <span className="inline-flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5" /> تم الإيقاف — يمكنك المتابعة لاحقًا
            </span>
          )}
          {status === "idle" && !allDone && <span>{remaining.length} كتاب متبقٍ</span>}
          {allDone && (
            <span className="inline-flex items-center gap-1 text-primary">
              <CheckCircle2 className="h-3.5 w-3.5" /> جميع الكتب محفوظة على جهازك
            </span>
          )}
        </span>
        {failed > 0 && <span className="text-destructive shrink-0">فشل: {failed}</span>}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {status === "running" ? (
          <Button size="sm" variant="outline" onClick={stop}>
            إيقاف
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={start}
            disabled={allDone || !online}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Download className="h-4 w-4 mr-1.5" />
            {cachedCount === 0
              ? "تحميل كل الكتب للاستخدام بدون إنترنت"
              : allDone
              ? "كل شيء محفوظ"
              : `متابعة تحميل ${remaining.length} كتاب`}
          </Button>
        )}
        {!online && (
          <span className="text-xs text-muted-foreground self-center">
            لا يوجد اتصال — الكتب المحفوظة تعمل، والباقي بحاجة لإنترنت لتحميله أول مرة.
          </span>
        )}
      </div>
    </div>
  );
};
