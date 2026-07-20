
create extension if not exists pgcrypto;
create table if not exists public.rooms(
 id uuid primary key default gen_random_uuid(),code text not null unique,status text not null default 'lobby',
 host_player_id uuid,current_round integer not null default 0,deck jsonb not null default '[]',custom_cards jsonb not null default '[]',created_at timestamptz default now());
create table if not exists public.players(
 id uuid primary key default gen_random_uuid(),room_id uuid not null references public.rooms(id) on delete cascade,
 session_id uuid not null,name text not null,is_host boolean not null default false,active boolean not null default true,score integer not null default 0,joined_at timestamptz default now(),unique(room_id,session_id));
alter table public.rooms drop constraint if exists rooms_host_player_id_fkey;
alter table public.rooms add constraint rooms_host_player_id_fkey foreign key(host_player_id) references public.players(id) on delete set null;
create table if not exists public.rounds(
 id uuid primary key default gen_random_uuid(),room_id uuid not null references public.rooms(id) on delete cascade,
 round_number integer not null,subject_player_id uuid not null references public.players(id),card jsonb not null,status text not null default 'answering',
 created_at timestamptz default now(),revealed_at timestamptz,unique(room_id,round_number));
create table if not exists public.answers(
 id uuid primary key default gen_random_uuid(),room_id uuid not null references public.rooms(id) on delete cascade,
 round_id uuid not null references public.rounds(id) on delete cascade,player_id uuid not null references public.players(id),
 ranking jsonb not null check(jsonb_array_length(ranking)=3),submitted_at timestamptz default now(),unique(round_id,player_id));
alter table public.rooms enable row level security;alter table public.players enable row level security;alter table public.rounds enable row level security;alter table public.answers enable row level security;
create policy "rooms all select" on public.rooms for select to anon using(true);
create policy "rooms all insert" on public.rooms for insert to anon with check(true);
create policy "rooms all update" on public.rooms for update to anon using(true) with check(true);
create policy "players all select" on public.players for select to anon using(true);
create policy "players all insert" on public.players for insert to anon with check(true);
create policy "players all update" on public.players for update to anon using(true) with check(true);
create policy "rounds all select" on public.rounds for select to anon using(true);
create policy "rounds all insert" on public.rounds for insert to anon with check(true);
create policy "rounds all update" on public.rounds for update to anon using(true) with check(true);
create policy "answers all select" on public.answers for select to anon using(true);
create policy "answers all insert" on public.answers for insert to anon with check(true);
grant usage on schema public to anon;grant select,insert,update on public.rooms,public.players,public.rounds to anon;grant select,insert on public.answers to anon;
do $$ begin alter publication supabase_realtime add table public.rooms; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.players; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.rounds; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.answers; exception when duplicate_object then null; end $$;
