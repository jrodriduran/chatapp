-- =============================================
-- Complete Supabase schema for WhatsApp AI Bot SaaS
-- Multi-tenant: every business table has organization_id
-- =============================================

-- Extensions
create extension if not exists "pgcrypto";

-- =============================================
-- 1. Organizations
-- =============================================
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  default_locale text not null default 'en' check (default_locale in ('en', 'es', 'pt-BR')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_organizations_slug on public.organizations(slug);

-- =============================================
-- 2. Profiles
-- =============================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'agent' check (role in ('owner', 'admin', 'agent')),
  created_at timestamptz not null default now()
);

create index idx_profiles_organization_id on public.profiles(organization_id);
create index idx_profiles_email on public.profiles(email);

-- =============================================
-- 3. WhatsApp Accounts
-- =============================================
create table public.whatsapp_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  phone_number text not null,
  phone_number_id text not null,
  waba_id text not null,
  access_token_encrypted text not null,
  webhook_verify_token text not null,
  status text not null default 'pending' check (status in ('active', 'pending', 'disconnected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_whatsapp_accounts_organization_id on public.whatsapp_accounts(organization_id);
create index idx_whatsapp_accounts_phone_number_id on public.whatsapp_accounts(phone_number_id);

-- =============================================
-- 4. Bots
-- =============================================
create table public.bots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  instructions text,
  tone text,
  language text not null default 'en' check (language in ('en', 'es', 'pt-BR')),
  temperature numeric not null default 0.7 check (temperature >= 0 and temperature <= 2),
  fallback_message text,
  human_handoff_enabled boolean not null default false,
  status text not null default 'inactive' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_bots_organization_id on public.bots(organization_id);
create index idx_bots_status on public.bots(status);

-- =============================================
-- 5. Contacts
-- =============================================
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  phone text not null,
  name text,
  language text default 'en' check (language in ('en', 'es', 'pt-BR')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, phone)
);

create index idx_contacts_organization_id on public.contacts(organization_id);
create index idx_contacts_phone on public.contacts(phone);
create index idx_contacts_organization_phone on public.contacts(organization_id, phone);

-- =============================================
-- 6. Conversations
-- =============================================
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  bot_id uuid references public.bots(id) on delete set null,
  status text not null default 'new' check (status in ('new', 'open', 'pending_agent', 'resolved', 'closed')),
  unread_count integer not null default 0,
  last_message_at timestamptz,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_conversations_organization_id on public.conversations(organization_id);
create index idx_conversations_contact_id on public.conversations(contact_id);
create index idx_conversations_bot_id on public.conversations(bot_id);
create index idx_conversations_status on public.conversations(status);
create index idx_conversations_assigned_to on public.conversations(assigned_to);
create index idx_conversations_last_message_at on public.conversations(last_message_at desc);

-- =============================================
-- 7. Messages
-- =============================================
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  direction text not null check (direction in ('incoming', 'outgoing')),
  sender_type text not null check (sender_type in ('user', 'bot', 'agent')),
  content text not null,
  wa_message_id text,
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_messages_organization_id on public.messages(organization_id);
create index idx_messages_conversation_id on public.messages(conversation_id);
create index idx_messages_created_at on public.messages(created_at desc);
create index idx_messages_wa_message_id on public.messages(wa_message_id);

-- =============================================
-- Row Level Security
-- =============================================
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.whatsapp_accounts enable row level security;
alter table public.bots enable row level security;
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Helper: get current user's organization id
create or replace function public.get_user_organization_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select organization_id
  from public.profiles
  where id = auth.uid();
$$;

-- =============================================
-- Organizations policies
-- =============================================
create policy "Users can view their organization"
  on public.organizations for select
  using (id = public.get_user_organization_id());

create policy "Users can update their organization"
  on public.organizations for update
  using (id = public.get_user_organization_id());

-- =============================================
-- Profiles policies
-- =============================================
create policy "Users can view profiles in their organization"
  on public.profiles for select
  using (organization_id = public.get_user_organization_id());

create policy "Users can update their own profile"
  on public.profiles for update
  using (id = auth.uid());

-- =============================================
-- WhatsApp accounts policies
-- =============================================
create policy "Users can view whatsapp accounts in their organization"
  on public.whatsapp_accounts for select
  using (organization_id = public.get_user_organization_id());

create policy "Users can insert whatsapp accounts in their organization"
  on public.whatsapp_accounts for insert
  with check (organization_id = public.get_user_organization_id());

create policy "Users can update whatsapp accounts in their organization"
  on public.whatsapp_accounts for update
  using (organization_id = public.get_user_organization_id());

create policy "Users can delete whatsapp accounts in their organization"
  on public.whatsapp_accounts for delete
  using (organization_id = public.get_user_organization_id());

-- =============================================
-- Bots policies
-- =============================================
create policy "Users can view bots in their organization"
  on public.bots for select
  using (organization_id = public.get_user_organization_id());

create policy "Users can insert bots in their organization"
  on public.bots for insert
  with check (organization_id = public.get_user_organization_id());

create policy "Users can update bots in their organization"
  on public.bots for update
  using (organization_id = public.get_user_organization_id());

create policy "Users can delete bots in their organization"
  on public.bots for delete
  using (organization_id = public.get_user_organization_id());

-- =============================================
-- Contacts policies
-- =============================================
create policy "Users can view contacts in their organization"
  on public.contacts for select
  using (organization_id = public.get_user_organization_id());

create policy "Users can insert contacts in their organization"
  on public.contacts for insert
  with check (organization_id = public.get_user_organization_id());

create policy "Users can update contacts in their organization"
  on public.contacts for update
  using (organization_id = public.get_user_organization_id());

create policy "Users can delete contacts in their organization"
  on public.contacts for delete
  using (organization_id = public.get_user_organization_id());

-- =============================================
-- Conversations policies
-- =============================================
create policy "Users can view conversations in their organization"
  on public.conversations for select
  using (organization_id = public.get_user_organization_id());

create policy "Users can insert conversations in their organization"
  on public.conversations for insert
  with check (organization_id = public.get_user_organization_id());

create policy "Users can update conversations in their organization"
  on public.conversations for update
  using (organization_id = public.get_user_organization_id());

create policy "Users can delete conversations in their organization"
  on public.conversations for delete
  using (organization_id = public.get_user_organization_id());

-- =============================================
-- Messages policies
-- =============================================
create policy "Users can view messages in their organization"
  on public.messages for select
  using (organization_id = public.get_user_organization_id());

create policy "Users can insert messages in their organization"
  on public.messages for insert
  with check (organization_id = public.get_user_organization_id());

create policy "Users can update messages in their organization"
  on public.messages for update
  using (organization_id = public.get_user_organization_id());

create policy "Users can delete messages in their organization"
  on public.messages for delete
  using (organization_id = public.get_user_organization_id());

-- =============================================
-- Triggers: updated_at
-- =============================================
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at
  before update on public.organizations
  for each row execute function public.handle_updated_at();

create trigger set_updated_at
  before update on public.whatsapp_accounts
  for each row execute function public.handle_updated_at();

create trigger set_updated_at
  before update on public.bots
  for each row execute function public.handle_updated_at();

create trigger set_updated_at
  before update on public.contacts
  for each row execute function public.handle_updated_at();

create trigger set_updated_at
  before update on public.conversations
  for each row execute function public.handle_updated_at();

-- =============================================
-- Trigger: auto-create organization and profile on signup
-- =============================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  org_slug text;
  user_email text;
  user_name text;
begin
  user_email := coalesce(new.email, '');
  user_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(user_email, '@', 1));
  org_slug := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'organization_name', user_name), '[^a-zA-Z0-9]+', '-', 'g'));

  -- Ensure unique slug
  if exists (select 1 from public.organizations where slug = org_slug) then
    org_slug := org_slug || '-' || substr(new.id::text, 1, 8);
  end if;

  -- Create default organization
  insert into public.organizations (name, slug)
  values (
    coalesce(new.raw_user_meta_data->>'organization_name', user_name),
    org_slug
  )
  returning id into new_org_id;

  -- Create profile as owner
  insert into public.profiles (id, organization_id, email, full_name, role)
  values (new.id, new_org_id, user_email, user_name, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();