import { memo } from "react";
import { Link } from "react-router-dom";
import { Star, Heart } from "lucide-react";
import type { Book } from "@/data/books";
import { useIsFavorite, toggleFavorite } from "@/lib/library-storage";

const BookCardImpl = ({ book }: { book: Book }) => {
  const fav = useIsFavorite(book.id);

  return (
    <div className="group block relative [content-visibility:auto] [contain-intrinsic-size:320px]">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleFavorite(book.id);
        }}
        className={`absolute top-2 left-2 z-10 rounded-full p-1.5 shadow-soft transition-smooth ${
          fav ? "bg-primary text-primary-foreground" : "bg-card/80 text-muted-foreground hover:text-primary"
        }`}
        aria-label={fav ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
      >
        <Heart className={`h-3.5 w-3.5 ${fav ? "fill-current" : ""}`} />
      </button>

      <Link to={`/book/${book.id}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden rounded-md shadow-book transition-smooth group-hover:-translate-y-2 group-hover:rotate-1 duration-500">
          <img
            src={book.cover}
            alt={book.title}
            loading="lazy"
            decoding="async"
            width={300}
            height={400}
            className="h-full w-full object-cover transition-smooth group-hover:scale-105"
          />

          <div className="book-spine absolute inset-0 pointer-events-none" />
          <div className="absolute top-2 right-2 rounded-full bg-card/90 px-2 py-0.5 text-[10px] text-card-foreground shadow-soft">
            {book.language === "ar" ? "عربي" : book.language === "fr" ? "Français" : book.language === "es" ? "Español" : "English"}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-smooth" />
          <div className="absolute bottom-2 left-2 right-2 text-primary-foreground opacity-0 group-hover:opacity-100 transition-smooth">
            <p className="text-xs line-clamp-2">{book.description}</p>
          </div>
        </div>
        <div className="mt-3 px-1">
          <h3 className="font-display text-lg leading-tight text-foreground line-clamp-2 group-hover:text-primary transition-smooth">
            {book.title}
          </h3>
        </div>
      </Link>
      <div className="px-1">
        <Link
          to={`/author/${encodeURIComponent(book.author)}`}
          className="text-xs text-muted-foreground hover:text-primary hover:underline transition-smooth inline-block mt-1"
        >
          {book.author}
        </Link>
        <div className="flex items-center gap-1 mt-1.5">
          <Star className="h-3 w-3 fill-accent text-accent" />
          <span className="text-xs text-muted-foreground">{book.rating}</span>
          {book.duration && <span className="text-xs text-muted-foreground ml-2">• {book.duration}</span>}
        </div>
      </div>
    </div>
  );
};

export const BookCard = memo(BookCardImpl);
