-- =============================================
-- Add the 'processing' status to messages
-- The message processor marks a message as 'processing'
-- while generating a reply, before marking it 'processed' or 'failed'.
-- =============================================

alter table public.messages
  drop constraint if exists messages_status_check;

alter table public.messages
  add constraint messages_status_check
  check (status in ('pending', 'processing', 'processed', 'failed'));