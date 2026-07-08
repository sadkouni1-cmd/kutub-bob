import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Star, BookOpen, Heart, ExternalLink, ShieldCheck, Loader2, WifiOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { BookReader } from "@/components/BookReader";
import { getBook, languages } from "@/data/books";
import { useIsFavorite, toggleFavorite, getCachedContent, saveCachedContent, removeCachedContent } from "@/lib/library-storage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const BookDetail = () => {
  const { id } = useParams();
  const book = getBook(id ?? "");
  const fav = useIsFavorite(book?.id ?? "");
  const [reading, setReading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pages, setPages] = useState<string[] | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const cached = book ? getCachedContent(book.id) : null;
  const [hasCache, setHasCache] = useState<boolean>(!!cached);

  if (!book) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="font-display text-2xl sm:text-3xl text-primary">الكتاب غير موجود</p>
          <Button asChild className="mt-4"><Link to="/">العودة</Link></Button>
        </div>
      </div>
    );
  }

  const isRTL = book.language === "ar";
  const lang = languages.find((l) => l.id === book.language);

  const loadAndRead = async () => {
    // 1) Try offline cache first — instant, no network needed.
    const local = getCachedContent(book.id);
    if (local?.pages?.length) {
      setPages(local.pages);
      setSource(local.source);
      setReading(true);
      return;
    }

    // 2) Need internet to fetch/generate content the first time.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      toast.error("هذا الكتاب غير محفوظ بعد. يلزم الاتصال بالإنترنت لتحميله أول مرة.");
      return;
    }

    setLoading(true);
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
      if (!data?.pages?.length) throw new Error("لا يوجد محتوى");
      const nextPages = data.pages as string[];
      const nextSource = data.source as string;
      setPages(nextPages);
      setSource(nextSource);
      saveCachedContent(book.id, nextPages, nextSource);
      setHasCache(true);
      setReading(true);
      toast.success("تم حفظ الكتاب على جهازك للقراءة بدون إنترنت");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "تعذر جلب المحتوى";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const removeOffline = () => {
    removeCachedContent(book.id);
    setHasCache(false);
    toast.success("تم حذف النسخة المحفوظة");
  };


  const sourceLabel = source === "gutenberg"
    ? "النص الكامل من Project Gutenberg"
    : source === "wikisource"
    ? "النص الكامل من ويكي مصدر"
    : "ملخّص تفصيلي بالذكاء الاصطناعي";

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container py-4 sm:py-8 px-4 sm:px-6">
        <Button
          asChild
          variant="default"
          size="lg"
          className="mb-4 sm:mb-6 bg-primary text-primary-foreground hover:bg-primary/90 shadow-soft font-display h-11 px-5"
        >
          <Link to="/" className="flex items-center gap-2">
            <ArrowLeft className="h-5 w-5" />
            <span>العودة إلى المكتبة</span>
          </Link>
        </Button>

        {!reading ? (
          <div className="grid sm:grid-cols-[220px_1fr] md:grid-cols-[280px_1fr] gap-6 sm:gap-10 items-start">
            <div className="relative animate-float mx-auto sm:mx-0 max-w-[200px] sm:max-w-none w-full">
              <img
                src={book.cover}
                alt={book.title}
                width={600}
                height={800}
                className="w-full rounded-md shadow-book book-spine"
              />
            </div>
            <div className="animate-fade-up">
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-2">
                <span>{lang?.flag}</span>
                <span>{lang?.label}</span>
                <span>·</span>
                <span className="capitalize">{book.category}</span>
              </div>
              <h1 className={`font-display text-3xl sm:text-4xl md:text-5xl text-primary leading-tight ${isRTL ? "font-arabic" : ""}`}>
                {book.title}
              </h1>
              <Link
                to={`/author/${encodeURIComponent(book.author)}`}
                className="inline-block text-base sm:text-xl text-muted-foreground hover:text-primary hover:underline transition-smooth mt-2"
              >
                {book.author}
              </Link>
              <div className="flex items-center gap-1 mt-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-4 w-4 ${i < Math.round(book.rating) ? "fill-accent text-accent" : "text-muted"}`} />
                ))}
                <span className="ml-2 text-sm text-muted-foreground">{book.rating} / 5</span>
              </div>
              {book.verifiedSource && (
                <div className="mt-3 inline-flex items-center gap-1 text-primary text-sm">
                  <ShieldCheck className="h-4 w-4" /> {book.sourceName}
                </div>
              )}
              <p className={`mt-4 sm:mt-6 text-base sm:text-lg leading-relaxed text-foreground/80 ${isRTL ? "font-arabic" : ""}`}>
                {book.description}
              </p>

              <div className="mt-6 sm:mt-8 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  onClick={loadAndRead}
                  disabled={loading}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 font-display text-sm sm:text-base shadow-book h-11 sm:h-12 flex-1 sm:flex-none min-w-[190px]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      جاري تحضير الكتاب...
                    </>
                  ) : (
                    <>
                      <BookOpen className="h-5 w-5 mr-2" />
                      قراءة الكتاب
                    </>
                  )}
                </Button>
                {book.sourceUrl && (
                  <Button asChild size="lg" variant="secondary" className="font-display h-11 sm:h-12">
                    <a href={book.sourceUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-5 w-5 mr-2" />
                      المصدر الأصلي
                    </a>
                  </Button>
                )}
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => toggleFavorite(book.id)}
                  className="font-display text-sm sm:text-base h-11 sm:h-12 flex-1 sm:flex-none min-w-[140px]"
                >
                  <Heart className={`h-5 w-5 mr-2 ${fav ? "fill-primary text-primary" : ""}`} />
                  {fav ? "في المفضلة" : "أضف للمفضلة"}
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                يتم جلب النص من مصدر أصلي إن أمكن، وإلا يُولَّد ملخّص تفصيلي عالي الجودة. يُحفظ المحتوى ليكون فوريًا في المرات القادمة.
              </p>
            </div>
          </div>
        ) : (
          <div className="animate-fade-up">
            <div className="flex items-start justify-between gap-3 mb-4 sm:mb-6">
              <div className="min-w-0">
                <h2 className={`font-display text-xl sm:text-2xl md:text-3xl text-primary truncate ${isRTL ? "font-arabic" : ""}`}>
                  {book.title}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">{sourceLabel}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setReading(false)} className="shrink-0">
                إغلاق
              </Button>
            </div>
            <BookReader
              pages={pages ?? book.pages}
              isRTL={isRTL}
              bookId={book.id}
              language={book.language}
              illustration={book.illustration}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default BookDetail;
