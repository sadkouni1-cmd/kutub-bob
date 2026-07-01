import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Star, BookOpen, Heart, ExternalLink, ShieldCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { BookReader } from "@/components/BookReader";
import { getBook, languages } from "@/data/books";
import { useIsFavorite, toggleFavorite } from "@/lib/library-storage";

const BookDetail = () => {
  const { id } = useParams();
  const book = getBook(id ?? "");
  const fav = useIsFavorite(book?.id ?? "");
  const [reading, setReading] = useState(false);

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
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs sm:text-sm text-muted-foreground">
                <span>{book.sourceUrl ? "مصدر أصلي موثّق" : `${book.pageCount} صفحة قيد التحقق`}</span>
                {book.verifiedSource ? (
                  <span className="inline-flex items-center gap-1 text-primary">
                    <ShieldCheck className="h-4 w-4" /> {book.sourceName}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <AlertTriangle className="h-4 w-4" /> النص غير مفعل حتى التحقق
                  </span>
                )}
              </div>
              <p className={`mt-4 sm:mt-6 text-base sm:text-lg leading-relaxed text-foreground/80 ${isRTL ? "font-arabic" : ""}`}>
                {book.description}
              </p>

              <div className="mt-6 sm:mt-8 flex flex-wrap gap-3">
                {book.sourceUrl ? (
                  <Button
                    asChild
                    size="lg"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 font-display text-sm sm:text-base shadow-book h-11 sm:h-12 flex-1 sm:flex-none min-w-[170px]"
                  >
                    <a href={book.sourceUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-5 w-5 mr-2" />
                      فتح المصدر الأصلي
                    </a>
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    onClick={() => setReading(true)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 font-display text-sm sm:text-base shadow-book h-11 sm:h-12 flex-1 sm:flex-none min-w-[170px]"
                  >
                    <BookOpen className="h-5 w-5 mr-2" />
                    حالة التحقق
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
            </div>
          </div>
        ) : (
          <div className="animate-fade-up">
            <div className="flex items-start justify-between gap-3 mb-4 sm:mb-6">
              <div className="min-w-0">
                <h2 className={`font-display text-xl sm:text-2xl md:text-3xl text-primary truncate ${isRTL ? "font-arabic" : ""}`}>
                  {book.title}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {book.sourceUrl ? `مصدر أصلي: ${book.sourceName}` : "النص الكامل غير مفعل حتى التحقق من مصدر أصلي"}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setReading(false)} className="shrink-0">
                إغلاق
              </Button>
            </div>
            <BookReader pages={book.pages} isRTL={isRTL} bookId={book.id} language={book.language} illustration={book.illustration} />
          </div>
        )}
      </div>
    </div>
  );
};

export default BookDetail;
