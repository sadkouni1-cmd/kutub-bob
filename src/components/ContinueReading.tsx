import { Link } from "react-router-dom";
import { BookOpen, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { books } from "@/data/books";
import { useFavorites, useLastRead, useProgressMap } from "@/lib/library-storage";
import { cn } from "@/lib/utils";

export const ContinueReading = ({ className }: { className?: string }) => {
  const last = useLastRead();
  const progress = useProgressMap();
  const { favorites } = useFavorites();

  const lastBook = last ? books.find((b) => b.id === last.id) : undefined;
  const p = lastBook ? progress[lastBook.id] : undefined;
  const percent = p
    ? Math.min(100, Math.round(((p.spread + 1) / Math.max(1, p.totalSpreads)) * 100))
    : 0;

  const favoriteBooks = books.filter((b) => favorites.includes(b.id)).slice(0, 12);

  if (!lastBook && favoriteBooks.length === 0) return null;

  return (
    <div className={cn("space-y-8", className)}>
      {lastBook && (
        <section className="animate-fade-up">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl sm:text-2xl text-primary">تابع القراءة</h2>
          </div>
          <div className="flex gap-4 rounded-xl border border-border bg-card p-4 shadow-soft">
            <Link to={`/book/${lastBook.id}`} className="shrink-0">
              <img
                src={lastBook.cover}
                alt={lastBook.title}
                className="h-24 w-16 object-cover rounded shadow-book book-spine"
                loading="lazy"
              />
            </Link>
            <div className="flex-1 min-w-0">
              <Link to={`/book/${lastBook.id}`}>
                <h3 className="font-display text-lg sm:text-xl text-foreground hover:text-primary transition-smooth line-clamp-1">
                  {lastBook.title}
                </h3>
              </Link>
              <p className="text-xs text-muted-foreground">{lastBook.author}</p>
              {p ? (
                <div className="mt-3">
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-gold transition-all" style={{ width: `${percent}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                    <span>صفحة {p.spread * 2 + 1} من {p.totalSpreads * 2}</span>
                    <span>{percent}%</span>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">آخر كتاب فتحته</p>
              )}
              <Button asChild size="sm" className="mt-3 font-display">
                <Link to={`/book/${lastBook.id}`}>متابعة من حيث توقفت</Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {favoriteBooks.length > 0 && (
        <section className="animate-fade-up">
          <div className="flex items-center justify-between mb-3 gap-3">
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary fill-primary" />
              <h2 className="font-display text-xl sm:text-2xl text-primary">كتبي المفضلة</h2>
              <span className="text-xs text-muted-foreground">({favorites.length})</span>
            </div>
            <Button asChild variant="ghost" size="sm" className="shrink-0">
              <Link to="/my-books">عرض الكل</Link>
            </Button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {favoriteBooks.map((b) => (
              <Link
                key={b.id}
                to={`/book/${b.id}`}
                className="shrink-0 w-24 sm:w-28 group"
              >
                <img
                  src={b.cover}
                  alt={b.title}
                  className="w-full h-32 sm:h-40 object-cover rounded shadow-book book-spine transition-smooth group-hover:-translate-y-1"
                  loading="lazy"
                />
                <p className="mt-2 text-xs text-foreground line-clamp-2 group-hover:text-primary transition-smooth">
                  {b.title}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
