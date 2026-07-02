import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { BookCard } from "@/components/BookCard";
import { books, categories, languages, type Category, type Lang } from "@/data/books";
import { quickSearchBooks } from "@/lib/search";
import { cn } from "@/lib/utils";

const INITIAL_VISIBLE_BOOKS = 36;
const BOOKS_PER_BATCH = 48;

const Index = () => {
  const [activeCat, setActiveCat] = useState<Category | "all">("all");
  const [activeLang, setActiveLang] = useState<Lang | "all">("all");
  const [activeSource, setActiveSource] = useState<"all" | "full" | "summary">("all");
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_BOOKS);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const deferredActiveCat = useDeferredValue(activeCat);
  const deferredActiveLang = useDeferredValue(activeLang);
  const deferredActiveSource = useDeferredValue(activeSource);
  const deferredSearch = useDeferredValue(search);

  const handleSearch = useCallback((value: string) => {
    startTransition(() => setSearch(value));
  }, []);

  const filtered = useMemo(() => {
    const base = deferredSearch.trim() ? quickSearchBooks(deferredSearch) : books;
    if (deferredActiveCat === "all" && deferredActiveLang === "all" && deferredActiveSource === "all") return base;
    return base.filter((b) => {
      if (deferredActiveCat !== "all" && b.category !== deferredActiveCat) return false;
      if (deferredActiveLang !== "all" && b.language !== deferredActiveLang) return false;
      if (deferredActiveSource === "full" && !b.verifiedSource) return false;
      if (deferredActiveSource === "summary" && b.verifiedSource) return false;
      return true;
    });
  }, [deferredActiveCat, deferredActiveLang, deferredActiveSource, deferredSearch]);

  useEffect(() => {
    setVisibleCount(Math.min(INITIAL_VISIBLE_BOOKS, filtered.length));
  }, [filtered]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || visibleCount >= filtered.length) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        startTransition(() => {
          setVisibleCount((current) => Math.min(current + BOOKS_PER_BATCH, filtered.length));
        });
      },
      { rootMargin: "900px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [filtered.length, startTransition, visibleCount]);

  const displayedBooks = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const hasSearch = search.trim().length > 0;
  const isUpdatingResults =
    activeCat !== deferredActiveCat || activeLang !== deferredActiveLang || search !== deferredSearch;

  // Group by author when the user is inside a specific section (or searching),
  // so that each author appears as a header with their books listed beneath.
  const groupedByAuthor = useMemo(() => {
    if (deferredActiveCat === "all") return null;
    const map = new Map<string, typeof displayedBooks>();
    for (const b of displayedBooks) {
      const list = map.get(b.author) ?? [];
      list.push(b);
      map.set(b.author, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "ar"));
  }, [displayedBooks, deferredActiveCat, deferredSearch]);

  return (
    <div className="min-h-screen">
      <Header onSearch={handleSearch} search={search} />

      {!hasSearch && <Hero />}

      <main id="library" className={cn("container px-4 sm:px-6", hasSearch ? "py-6 sm:py-8" : "py-10 sm:py-16")}>
        {/* Category strip */}
        <div className="mb-6 sm:mb-8">
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl text-primary mb-1 sm:mb-2">الأقسام</h2>
          <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">اختر القسم الذي يناسب مزاجك اليوم</p>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <button
              onClick={() => setActiveCat("all")}
              className={cn(
                "px-3 sm:px-5 py-2 sm:py-2.5 rounded-full font-display text-sm sm:text-base transition-smooth shadow-soft",
                activeCat === "all" ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-secondary"
              )}
            >
              الكل
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={cn(
                  "px-3 sm:px-5 py-2 sm:py-2.5 rounded-full font-display text-sm sm:text-base transition-smooth shadow-soft flex items-center gap-1.5 sm:gap-2",
                  activeCat === c.id ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-secondary"
                )}
              >
                <span>{c.icon}</span>
                <span>{c.label}</span>
                <span className="hidden sm:inline text-xs opacity-70">· {c.labelEn}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Language filter */}
        <div className="mb-8 sm:mb-12 flex flex-wrap items-center gap-2">
          <span className="text-xs sm:text-sm text-muted-foreground mr-1 sm:mr-2">اللغة:</span>
          <button
            onClick={() => setActiveLang("all")}
            className={cn(
              "px-3 py-1 rounded-full text-xs sm:text-sm transition-smooth border",
              activeLang === "all" ? "bg-accent text-accent-foreground border-accent" : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            All
          </button>
          {languages.map((l) => (
            <button
              key={l.id}
              onClick={() => setActiveLang(l.id)}
              className={cn(
                "px-3 py-1 rounded-full text-xs sm:text-sm transition-smooth border flex items-center gap-1.5",
                activeLang === l.id ? "bg-accent text-accent-foreground border-accent" : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <span>{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>

        {/* Source filter: full text vs AI summary */}
        <div className="mb-8 sm:mb-12 flex flex-wrap items-center gap-2">
          <span className="text-xs sm:text-sm text-muted-foreground mr-1 sm:mr-2">النوع:</span>
          {([
            { id: "all", label: "الكل", icon: "📚" },
            { id: "full", label: "كتب كاملة", icon: "✅" },
            { id: "summary", label: "ملخّصات ذكية", icon: "✨" },
          ] as const).map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSource(s.id)}
              className={cn(
                "px-3 py-1 rounded-full text-xs sm:text-sm transition-smooth border flex items-center gap-1.5",
                activeSource === s.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        {/* Books grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 sm:py-20 text-muted-foreground">
            <p className="font-display text-xl sm:text-2xl">لا توجد كتب مطابقة</p>
          </div>
        ) : groupedByAuthor ? (
          <div className="space-y-10 sm:space-y-12" aria-busy={isUpdatingResults}>
            {groupedByAuthor.map(([author, list]) => (
              <section key={author} className="animate-fade-up">
                <div className="flex items-baseline justify-between mb-3 sm:mb-4 border-b border-border/60 pb-2 gap-3">
                  <h3 className="font-display text-xl sm:text-2xl md:text-3xl text-primary truncate">{author}</h3>
                  <span className="text-xs text-muted-foreground shrink-0">{list.length} كتاب</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 sm:gap-x-6 gap-y-8 sm:gap-y-10">
                  {list.map((b) => (
                    <BookCard key={b.id} book={b} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 sm:gap-x-6 gap-y-8 sm:gap-y-10" aria-busy={isUpdatingResults}>
            {displayedBooks.map((b) => (
              <BookCard key={b.id} book={b} />
            ))}
          </div>
        )}

        {visibleCount < filtered.length && (
          <div ref={loadMoreRef} className="h-10" aria-hidden="true" />
        )}
      </main>

      <footer className="border-t border-border/60 mt-12 sm:mt-20 py-8 sm:py-10 text-center text-xs sm:text-sm text-muted-foreground px-4">
        <p className="font-display text-xl sm:text-2xl text-primary">Read With Bob</p>
        <p className="mt-2">صُنعت بحب للقراء حول العالم — Developed by <span className="text-foreground font-medium">Ayoub Sadkouni</span></p>
      </footer>
    </div>
  );
};

export default Index;
