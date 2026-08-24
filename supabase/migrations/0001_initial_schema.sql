-- =============================================
-- Initial schema for WhatsApp AI Bot SaaS
-- Multi-tenant: every business table has organization_id
-- =============================================

-- Extensions
create extension if not exists "pgcrypto";

-- =============================================
-- Organizations
-- =============================================
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================
-- Organization members (links users to orgs)
-- =============================================
create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- =============================================
-- Bots
-- =============================================
create table public.bots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  phone_number text,
  language text not null default 'en' check (language in ('en', 'es', 'pt-BR')),
  system_prompt text,
  welcome_message text,
  fallback_message text,
  model text not null default 'deepseek-chat',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_bots_organization_id on public.bots(organization_id);

-- =============================================
-- WhatsApp integrations (per bot)
-- =============================================
create table public.whatsapp_integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bot_id uuid not null references public.bots(id) on delete cascade,
  phone_number_id text not null,
  access_token text not null,
  verify_token text not null,
  webhook_url text,
  is_connected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bot_id)
);

create index idx_whatsapp_integrations_organization_id on public.whatsapp_integrations(organization_id);

-- =============================================
-- AI provider configs (per bot)
-- =============================================
create table public.ai_provider_configs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bot_id uuid not null references public.bots(id) on delete cascade,
  provider text not null default 'openai-compatible',
  api_base_url text not null,
  api_key text not null,
  model text not null default 'deepseek-chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bot_id)
);

create index idx_ai_provider_configs_organization_id on public.ai_provider_configs(organization_id);

-- =============================================
-- Contacts
-- =============================================
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  phone text not null,
  name text,
  language text default 'en' check (language in ('en', 'es', 'pt-BR')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, phone)
);

create index idx_contacts_organization_id on public.contacts(organization_id);

-- =============================================
-- Conversations
-- =============================================
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bot_id uuid not null references public.bots(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'closed', 'pending')),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_conversations_organization_id on public.conversations(organization_id);
create index idx_conversations_bot_id on public.conversations(bot_id);
create index idx_conversations_contact_id on public.conversations(contact_id);

-- =============================================
-- Messages
-- =============================================
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender text not null check (sender in ('customer', 'bot')),
  content text not null,
  created_at timestamptz not null default now()
);

create index idx_messages_organization_id on public.messages(organization_id);
create index idx_messages_conversation_id on public.messages(conversation_id);

-- =============================================
-- Row Level Security
-- =============================================
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.bots enable row level security;
alter table public.whatsapp_integrations enable row level security;
alter table public.ai_provider_configs enable row level security;
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Helper: get current user's organization ids
create or replace function public.get_user_organization_ids()
returns setof uuid
language sql
security definer
set search_path = public
as $$
  select organization_id
  from public.organization_members
  where user_id = auth.uid();
$$;

-- Organizations: members can view their org
create policy "Users can view their organizations"
  on public.organizations for select
  using (id in (select public.get_user_organization_ids()));

-- Organization members: users can view their memberships
create policy "Users can view their memberships"
  on public.organization_members for select
  using (user_id = auth.uid());

-- Bots: members can CRUD their org's bots
create policy "Members can view bots"
  on public.bots for select
  using (organization_id in (select public.get_user_organization_ids()));

create policy "Members can insert bots"
  on public.bots for insert
  with check (organization_id in (select public.get_user_organization_ids()));

create policy "Members can update bots"
  on public.bots for update
  using (organization_id in (select public.get_user_organization_ids()));

create policy "Members can delete bots"
  on public.bots for delete
  using (organization_id in (select public.get_user_organization_ids()));

-- WhatsApp integrations: members can CRUD
create policy "Members can view whatsapp integrations"
  on public.whatsapp_integrations for select
  using (organization_id in (select public.get_user_organization_ids()));

create policy "Members can insert whatsapp integrations"
  on public.whatsapp_integrations for insert
  with check (organization_id in (select public.get_user_organization_ids()));

create policy "Members can update whatsapp integrations"
  on public.whatsapp_integrations for update
  using (organization_id in (select public.get_user_organization_ids()));

create policy "Members can delete whatsapp integrations"
  on public.whatsapp_integrations for delete
  using (organization_id in (select public.get_user_organization_ids()));

-- AI provider configs: members can CRUD
create policy "Members can view ai provider configs"
  on public.ai_provider_configs for select
  using (organization_id in (select public.get_user_organization_ids()));

create policy "Members can insert ai provider configs"
  on public.ai_provider_configs for insert
  with check (organization_id in (select public.get_user_organization_ids()));

create policy "Members can update ai provider configs"
  on public.ai_provider_configs for update
  using (organization_id in (select public.get_user_organization_ids()));

create policy "Members can delete ai provider configs"
  on public.ai_provider_configs for delete
  using (organization_id in (select public.get_user_organization_ids()));

-- Contacts: members can CRUD
create policy "Members can view contacts"
  on public.contacts for select
  using (organization_id in (select public.get_user_organization_ids()));

create policy "Members can insert contacts"
  on public.contacts for insert
  with check (organization_id in (select public.get_user_organization_ids()));

create policy "Members can update contacts"
  on public.contacts for update
  using (organization_id in (select public.get_user_organization_ids()));

create policy "Members can delete contacts"
  on public.contacts for delete
  using (organization_id in (select public.get_user_organization_ids()));

-- Conversations: members can CRUD
create policy "Members can view conversations"
  on public.conversations for select
  using (organization_id in (select public.get_user_organization_ids()));

create policy "Members can insert conversations"
  on public.conversations for insert
  with check (organization_id in (select public.get_user_organization_ids()));

create policy "Members can update conversations"
  on public.conversations for update
  using (organization_id in (select public.get_user_organization_ids()));

create policy "Members can delete conversations"
  on public.conversations for delete
  using (organization_id in (select public.get_user_organization_ids()));

-- Messages: members can CRUD
create policy "Members can view messages"
  on public.messages for select
  using (organization_id in (select public.get_user_organization_ids()));

create policy "Members can insert messages"
  on public.messages for insert
  with check (organization_id in (select public.get_user_organization_ids()));

create policy "Members can update messages"
  on public.messages for update
  using (organization_id in (select public.get_user_organization_ids()));

create policy "Members can delete messages"
  on public.messages for delete
  using (organization_id in (select public.get_user_organization_ids()));

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
  before update on public.bots
  for each row execute function public.handle_updated_at();

create trigger set_updated_at
  before update on public.whatsapp_integrations
  for each row execute function public.handle_updated_at();

create trigger set_updated_at
  before update on public.ai_provider_configs
  for each row execute function public.handle_updated_at();

create trigger set_updated_at
  before update on public.contacts
  for each row execute function public.handle_updated_at();

create trigger set_updated_at
  before update on public.conversations
  for each row execute function public.handle_updated_at();

-- =============================================
-- Trigger: auto-create organization on signup
-- =============================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
begin
  insert into public.organizations (name)
  values (coalesce(new.raw_user_meta_data->>'organization_name', 'My Organization'))
  returning id into new_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();