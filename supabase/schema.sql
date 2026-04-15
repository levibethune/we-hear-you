-- People table: one row per unique person (email is primary identifier)
create table people (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  name text,
  persona text,
  latest_mood text,
  latest_sentiment text,
  response_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Responses table: one row per video submission
create table responses (
  id uuid default gen_random_uuid() primary key,
  person_id uuid references people(id) on delete cascade not null,
  transcription text not null,
  themes text[] default '{}',
  mood text,
  sentiment text,
  video_url text,
  videoask_response_id text unique,
  created_at timestamptz default now()
);

-- Index for fast lookups
create index idx_responses_person_id on responses(person_id);
create index idx_people_email on people(email);
create index idx_people_persona on people(persona);

-- Full-text search on transcriptions
alter table responses add column transcription_search tsvector
  generated always as (to_tsvector('english', coalesce(transcription, ''))) stored;
create index idx_responses_transcription_search on responses using gin(transcription_search);

-- Auto-update the updated_at timestamp on people
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger people_updated_at
  before update on people
  for each row execute function update_updated_at();
