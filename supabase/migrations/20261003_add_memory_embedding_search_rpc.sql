create extension if not exists vector;

create index if not exists memory_documents_embedding_hnsw_idx
on public.memory_documents using hnsw (embedding vector_cosine_ops)
where embedding is not null;

create index if not exists memory_summaries_embedding_hnsw_idx
on public.memory_summaries using hnsw (embedding vector_cosine_ops)
where embedding is not null;

create or replace function public.match_memory_documents(
  query_embedding vector(768),
  query_user_id uuid,
  match_count int default 40,
  match_threshold float default 0.18
)
returns table (
  document_id text,
  source_type text,
  source_id text,
  kind text,
  label text,
  title text,
  text text,
  document_date date,
  focus_id text,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  select
    md.document_id,
    md.source_type,
    md.source_id,
    md.kind,
    md.label,
    md.title,
    md.text,
    md.document_date,
    md.focus_id,
    md.metadata,
    1 - (md.embedding <=> query_embedding) as similarity
  from public.memory_documents md
  where
    md.user_id = query_user_id
    and query_user_id = auth.uid()
    and md.embedding is not null
    and 1 - (md.embedding <=> query_embedding) >= match_threshold
  order by md.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function public.match_memory_summaries(
  query_embedding vector(768),
  query_user_id uuid,
  match_count int default 10,
  match_threshold float default 0.15
)
returns table (
  summary_id text,
  kind text,
  subject text,
  period_start date,
  period_end date,
  text text,
  similarity float
)
language sql
stable
as $$
  select
    ms.summary_id,
    ms.kind,
    ms.subject,
    ms.period_start,
    ms.period_end,
    ms.text,
    1 - (ms.embedding <=> query_embedding) as similarity
  from public.memory_summaries ms
  where
    ms.user_id = query_user_id
    and query_user_id = auth.uid()
    and ms.embedding is not null
    and 1 - (ms.embedding <=> query_embedding) >= match_threshold
  order by ms.embedding <=> query_embedding
  limit match_count;
$$;

notify pgrst, 'reload schema';
