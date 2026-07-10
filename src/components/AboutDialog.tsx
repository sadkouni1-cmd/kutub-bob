import { BookOpen, Mail, Copy, Check, Heart } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";

const DEV_EMAIL = "sadkouni1@gmail.com";

export const AboutDialog = ({ trigger }: { trigger?: React.ReactNode }) => {
  const [copied, setCopied] = useState(false);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(DEV_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="icon" aria-label="حول التطبيق" className="h-9 w-9">
            <Info className="h-5 w-5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-md bg-gradient-gold p-2 shadow-soft">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle className="font-display text-2xl text-primary">
              Read With Bob
            </DialogTitle>
          </div>
          <DialogDescription className="text-right leading-relaxed text-foreground/80 font-arabic text-base">
            مكتبة رقمية أنيقة تقدّم ملخّصات ذكية لمئات الكتب بأربع لغات — العربية والفرنسية والإنجليزية والإسبانية.
            تصفّح الفلسفة، الروايات، الكتب الدينية، قصص الأطفال، التنمية الذاتية والأكثر رواجًا،
            واقرأ ملخّصات واضحة على هاتفك أو حاسوبك بدون إنترنت.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="rounded-lg border border-border/60 bg-card/60 p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
              المطوّر
            </p>
            <p className="font-display text-lg text-primary">Ayoub Sadkouni</p>
          </div>

          <div className="rounded-lg border border-border/60 bg-card/60 p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
              للتواصل
            </p>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary shrink-0" />
              <a
                href={`mailto:${DEV_EMAIL}`}
                className="text-sm sm:text-base text-foreground hover:text-primary transition-smooth break-all flex-1"
                dir="ltr"
              >
                {DEV_EMAIL}
              </a>
              <Button
                variant="outline"
                size="icon"
                onClick={copyEmail}
                className="h-8 w-8 shrink-0"
                aria-label={copied ? "تم النسخ" : "نسخ الإيميل"}
                title={copied ? "تم النسخ" : "نسخ الإيميل"}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <a
              href={`mailto:${DEV_EMAIL}?subject=Read%20With%20Bob%20—%20تواصل`}
              className="mt-3 inline-flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground rounded-md py-2.5 text-sm font-display hover:bg-primary/90 transition-smooth"
            >
              <Mail className="h-4 w-4" />
              راسل المطوّر
            </a>
          </div>

          <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
            صُنع بـ <Heart className="h-3.5 w-3.5 text-primary fill-primary" /> للقراء حول العالم
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
