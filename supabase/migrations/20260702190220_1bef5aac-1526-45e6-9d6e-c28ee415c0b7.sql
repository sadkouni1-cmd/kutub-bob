
CREATE TABLE public.book_content (
  book_id TEXT PRIMARY KEY,
  pages JSONB NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.book_content TO anon, authenticated;
GRANT ALL ON public.book_content TO service_role;

ALTER TABLE public.book_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read cached book content"
ON public.book_content FOR SELECT
USING (true);
