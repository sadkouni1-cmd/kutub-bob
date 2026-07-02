// Edge function: get-book-content
// Fetches full/summary content for a book. Caches in public.book_content.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface Payload {
  bookId: string;
  title: string;
  author: string;
  language: "ar" | "en" | "fr" | "es";
  category?: string;
  description?: string;
  sourceUrl?: string;
  refresh?: boolean;
}

function paginate(text: string, target = 1600): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  const paras = clean.split(/\n\n+/);
  const pages: string[] = [];
  let cur = "";
  for (const p of paras) {
    if ((cur + "\n\n" + p).length > target && cur) {
      pages.push(cur.trim());
      cur = p;
    } else {
      cur = cur ? cur + "\n\n" + p : p;
    }
  }
  if (cur.trim()) pages.push(cur.trim());
  return pages;
}

async function fetchGutenberg(sourceUrl: string): Promise<string | null> {
  const m = sourceUrl.match(/gutenberg\.org\/(?:ebooks|files|cache\/epub)\/(\d+)/);
  if (!m) return null;
  const id = m[1];
  const candidates = [
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
    `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
    `https://www.gutenberg.org/files/${id}/${id}.txt`,
  ];
  for (const url of candidates) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      let txt = await r.text();
      // Strip Gutenberg header/footer
      const startIdx = txt.search(/\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG[^*]*\*\*\*/i);
      const endIdx = txt.search(/\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG[^*]*\*\*\*/i);
      if (startIdx >= 0) txt = txt.slice(txt.indexOf("\n", startIdx) + 1);
      if (endIdx >= 0) txt = txt.slice(0, txt.indexOf("*** END", 0));
      return txt.trim();
    } catch { /* try next */ }
  }
  return null;
}

async function fetchWikisource(sourceUrl: string): Promise<string | null> {
  const m = sourceUrl.match(/^https?:\/\/([a-z]+)\.wikisource\.org\/wiki\/(.+)$/);
  if (!m) return null;
  const [, lang, page] = m;
  try {
    const api = `https://${lang}.wikisource.org/w/api.php?action=parse&page=${page}&prop=wikitext&format=json&redirects=1&origin=*`;
    const r = await fetch(api);
    if (!r.ok) return null;
    const j = await r.json();
    const wt: string | undefined = j?.parse?.wikitext?.["*"];
    if (!wt) return null;
    // Very light wikitext cleanup
    const clean = wt
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\{\{[\s\S]*?\}\}/g, "")
      .replace(/<ref[\s\S]*?<\/ref>/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, "$1")
      .replace(/^=+\s*(.+?)\s*=+$/gm, "\n$1\n")
      .replace(/'''?/g, "")
      .trim();
    return clean;
  } catch {
    return null;
  }
}

async function generateSummary(p: Payload): Promise<string> {
  const langMap = { ar: "Arabic", en: "English", fr: "French", es: "Spanish" } as const;
  const langName = langMap[p.language];
  const system = `You are a literary expert. Produce a rich, faithful, well-structured reader-friendly rendition of the requested book strictly in ${langName}. Never invent facts about real books; when unsure, focus on themes and context. Output plain text with paragraphs separated by blank lines. No markdown, no headings with #, no lists. Length: ~3000-5000 words. Split into clear chapters using a chapter title line followed by a blank line then prose.`;
  const user = `Book: "${p.title}" by ${p.author}\nLanguage: ${langName}\nCategory: ${p.category ?? "general"}\n${p.description ? `Description: ${p.description}\n` : ""}\nWrite a detailed, chapter-by-chapter comprehensive summary and analysis of this book (or, if it's a well-known text, a faithful condensed rendering of its key passages and ideas). Aim for a reader who wants to deeply understand the book without owning the original. Use the book's actual language: ${langName}.`;

  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`AI ${r.status}: ${t.slice(0, 200)}`);
  }
  const j = await r.json();
  const text: string = j?.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new Error("Empty AI response");
  return text.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const payload = (await req.json()) as Payload;
    if (!payload?.bookId || !payload?.title) {
      return new Response(JSON.stringify({ error: "bookId & title required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    if (!payload.refresh) {
      const { data: cached } = await admin
        .from("book_content")
        .select("pages, source, source_url")
        .eq("book_id", payload.bookId)
        .maybeSingle();
      if (cached?.pages) {
        return new Response(JSON.stringify({ pages: cached.pages, source: cached.source, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let text: string | null = null;
    let source = "ai-summary";

    if (payload.sourceUrl?.includes("gutenberg.org")) {
      text = await fetchGutenberg(payload.sourceUrl);
      if (text) source = "gutenberg";
    } else if (payload.sourceUrl?.includes("wikisource.org")) {
      text = await fetchWikisource(payload.sourceUrl);
      if (text) source = "wikisource";
    }

    if (!text || text.length < 500) {
      text = await generateSummary(payload);
      source = "ai-summary";
    }

    const pages = paginate(text);
    if (!pages.length) throw new Error("No content produced");

    await admin.from("book_content").upsert({
      book_id: payload.bookId,
      pages,
      source,
      source_url: payload.sourceUrl ?? null,
      updated_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ pages, source, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
