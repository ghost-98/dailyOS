create extension if not exists vector;

create table if not exists public.memory_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id text not null,
  source_type text not null,
  source_id text not null,
  kind text not null,
  label text not null,
  title text not null,
  text text not null,
  document_date date not null,
  focus_id text,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(768),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, document_id)
);

create table if not exists public.memory_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  summary_id text not null,
  kind text not null check (kind in ('day', 'week', 'month', 'person', 'place', 'recent')),
  subject text,
  period_start date,
  period_end date,
  text text not null,
  embedding vector(768),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, summary_id)
);

create table if not exists public.memory_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '기록 대화',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memory_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.memory_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists memory_documents_user_date_idx on public.memory_documents(user_id, document_date desc);
create index if not exists memory_documents_user_kind_idx on public.memory_documents(user_id, kind, document_date desc);
create index if not exists memory_summaries_user_kind_idx on public.memory_summaries(user_id, kind, period_start desc);
create index if not exists memory_conversations_user_updated_idx on public.memory_conversations(user_id, updated_at desc);
create index if not exists memory_messages_conversation_created_idx on public.memory_messages(conversation_id, created_at);
create index if not exists memory_documents_embedding_hnsw_idx on public.memory_documents using hnsw (embedding vector_cosine_ops) where embedding is not null;
create index if not exists memory_summaries_embedding_hnsw_idx on public.memory_summaries using hnsw (embedding vector_cosine_ops) where embedding is not null;

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

drop trigger if exists set_memory_documents_updated_at on public.memory_documents;
create trigger set_memory_documents_updated_at
before update on public.memory_documents
for each row execute function public.set_updated_at();

drop trigger if exists set_memory_summaries_updated_at on public.memory_summaries;
create trigger set_memory_summaries_updated_at
before update on public.memory_summaries
for each row execute function public.set_updated_at();

drop trigger if exists set_memory_conversations_updated_at on public.memory_conversations;
create trigger set_memory_conversations_updated_at
before update on public.memory_conversations
for each row execute function public.set_updated_at();

alter table public.memory_documents enable row level security;
alter table public.memory_summaries enable row level security;
alter table public.memory_conversations enable row level security;
alter table public.memory_messages enable row level security;

drop policy if exists "Users can read own memory documents" on public.memory_documents;
create policy "Users can read own memory documents"
on public.memory_documents for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own memory documents" on public.memory_documents;
create policy "Users can insert own memory documents"
on public.memory_documents for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own memory documents" on public.memory_documents;
create policy "Users can update own memory documents"
on public.memory_documents for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own memory documents" on public.memory_documents;
create policy "Users can delete own memory documents"
on public.memory_documents for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own memory summaries" on public.memory_summaries;
create policy "Users can read own memory summaries"
on public.memory_summaries for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own memory summaries" on public.memory_summaries;
create policy "Users can insert own memory summaries"
on public.memory_summaries for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own memory summaries" on public.memory_summaries;
create policy "Users can update own memory summaries"
on public.memory_summaries for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can read own memory conversations" on public.memory_conversations;
create policy "Users can read own memory conversations"
on public.memory_conversations for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own memory conversations" on public.memory_conversations;
create policy "Users can insert own memory conversations"
on public.memory_conversations for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own memory conversations" on public.memory_conversations;
create policy "Users can update own memory conversations"
on public.memory_conversations for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own memory conversations" on public.memory_conversations;
create policy "Users can delete own memory conversations"
on public.memory_conversations for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own memory messages" on public.memory_messages;
create policy "Users can read own memory messages"
on public.memory_messages for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own memory messages" on public.memory_messages;
create policy "Users can insert own memory messages"
on public.memory_messages for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.memory_conversations
    where id = conversation_id and user_id = auth.uid()
  )
);

notify pgrst, 'reload schema';
