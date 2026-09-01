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
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";


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
  const isChildren = p.category === "children";

  const lessonsLabel = {
    ar: "أهم الدروس المستفادة من الكتاب",
    en: "Key Lessons from the Book",
    fr: "Principales leçons du livre",
    es: "Lecciones clave del libro",
  }[p.language];

  let system: string;
  let user: string;

  if (isChildren) {
    system = `You are a beloved children's storyteller. Write the FULL children's story (not a summary) strictly in ${langName}, faithful to the original when it is a well-known tale. Warm, vivid, age-appropriate language. Plain text only, no markdown, no # headings, no bullet lists. Paragraphs separated by blank lines. Length: 1500-3000 words. If the story has natural scenes or chapters, separate them with a short title line followed by a blank line.`;
    user = `Children's story: "${p.title}" by ${p.author}\nLanguage: ${langName}\n${p.description ? `Description: ${p.description}\n` : ""}\nRewrite/tell the COMPLETE story from beginning to end in the child's own voice and rhythm — do NOT summarize, do NOT add a "lessons" section. Keep it in ${langName}.`;
  } else {
    system = `You are a literary expert producing a COMPREHENSIVE, EXPANDED multi-page summary of the requested book, strictly in ${langName}. Never invent facts about real books; when unsure, discuss themes, context, and the author's known ideas. Output plain text, paragraphs separated by blank lines. No markdown, no # headings, no bullet lists inside chapters. Split the work into 6–10 clearly titled chapters/sections (title on its own line, blank line, then prose). Target length: 5000–8000 words — be thorough, quote key ideas, give examples, and unpack arguments deeply. End with a final section titled exactly "${lessonsLabel}" containing 7–12 numbered lessons (each lesson: one short bold-worthy sentence, then 2–3 sentences explaining it). This final section is REQUIRED.`;
    user = `Book: "${p.title}" by ${p.author}\nLanguage: ${langName}\nCategory: ${p.category ?? "general"}\n${p.description ? `Description: ${p.description}\n` : ""}\nProduce a rich, expanded, chapter-by-chapter comprehensive summary and analysis so a reader deeply understands the book without owning the original. Be extensive across multiple pages. Finish with the required "${lessonsLabel}" section listing the concrete, actionable lessons the reader should take away. Write everything in ${langName}.`;
  }

  // Prefer Google AI Studio (Gemini API) directly — free tier / cheaper tokens.
  if (GEMINI_API_KEY) {
    const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.6-flash";
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 8192 },
        }),
      },
    );
    if (r.ok) {
      const j = await r.json();
      const parts = j?.candidates?.[0]?.content?.parts ?? [];
      const text: string = parts.map((p: { text?: string }) => p?.text ?? "").join("").trim();
      if (text) return text;
    } else {
      const t = await r.text();
      console.error(`Gemini API ${r.status}: ${t.slice(0, 300)}`);
      // 429 = free-tier rate limit, 4xx = key/model problem → surface it
      if (r.status === 429 || r.status === 401 || r.status === 403) {
        const err = new Error(`Gemini ${r.status}: ${t.slice(0, 200)}`) as Error & { status?: number };
        err.status = r.status;
        throw err;
      }
      // otherwise fall through to the Lovable gateway below
    }
  }

  if (!LOVABLE_API_KEY) throw new Error("No AI provider configured");

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
    const err = new Error(`AI ${r.status}: ${t.slice(0, 200)}`) as Error & { status?: number };
    err.status = r.status;
    throw err;
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
    const err = e as Error & { status?: number };
    const status = err.status;
    let message = err.message ?? "تعذر تحضير الملخّص";
    let code = "unknown";
    if (status === 402) {
      code = "no_credits";
      message = "انتهى رصيد الذكاء الاصطناعي للتطبيق. يلزم إضافة رصيد لتوليد ملخّصات جديدة. الكتب المحفوظة مسبقًا تعمل بدون إنترنت.";
    } else if (status === 429) {
      code = "rate_limited";
      message = "الطلبات كثيرة الآن. يُرجى المحاولة بعد قليل.";
    } else if (status === 403) {
      code = "blocked";
      message = "خدمة الذكاء الاصطناعي غير متاحة حاليًا لهذا التطبيق.";
    }
    // Always answer 200 so the client can show a clean message instead of crashing.
    return new Response(JSON.stringify({ error: message, code, upstreamStatus: status ?? null }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
