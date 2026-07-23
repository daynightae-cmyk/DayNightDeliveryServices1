-- DAY NIGHT Customer Experience Arabic UTF-8 repair.
-- Repairs legacy UTF-8 text that was previously interpreted as Windows-1252,
-- disables any template that cannot be repaired safely, and protects notifications.

begin;

create or replace function public.dn_ce_repair_utf8_mojibake(p_value text)
returns text
language plpgsql
immutable
strict
set search_path = pg_catalog, pg_temp
as $$
begin
  if position('Ø' in p_value) = 0
     and position('Ù' in p_value) = 0
     and position('ðŸ' in p_value) = 0
     and position('â€' in p_value) = 0
     and position('âœ' in p_value) = 0
     and position('â­' in p_value) = 0
     and position('â†' in p_value) = 0
     and position('ï¸' in p_value) = 0 then
    return p_value;
  end if;

  begin
    return convert_from(convert_to(p_value, 'WIN1252'), 'UTF8');
  exception when others then
    return p_value;
  end;
end;
$$;

revoke all on function public.dn_ce_repair_utf8_mojibake(text) from public;

update public.message_templates
set title = public.dn_ce_repair_utf8_mojibake(title),
    body = public.dn_ce_repair_utf8_mojibake(body),
    updated_at = now()
where position('Ø' in title) > 0
   or position('Ù' in title) > 0
   or position('ðŸ' in title) > 0
   or position('â€' in title) > 0
   or position('âœ' in title) > 0
   or position('â­' in title) > 0
   or position('â†' in title) > 0
   or position('ï¸' in title) > 0
   or position('Ø' in body) > 0
   or position('Ù' in body) > 0
   or position('ðŸ' in body) > 0
   or position('â€' in body) > 0
   or position('âœ' in body) > 0
   or position('â­' in body) > 0
   or position('â†' in body) > 0
   or position('ï¸' in body) > 0;

-- Any row that still contains damaged byte markers is disabled. The web client
-- then uses its verified UTF-8 source default instead of sending corrupted text.
update public.message_templates
set is_active = false,
    updated_at = now()
where position('Ø' in title) > 0
   or position('Ù' in title) > 0
   or position('ðŸ' in title) > 0
   or position('â€' in title) > 0
   or position('âœ' in title) > 0
   or position('â­' in title) > 0
   or position('â†' in title) > 0
   or position('ï¸' in title) > 0
   or position('Ø' in body) > 0
   or position('Ù' in body) > 0
   or position('ðŸ' in body) > 0
   or position('â€' in body) > 0
   or position('âœ' in body) > 0
   or position('â­' in body) > 0
   or position('â†' in body) > 0
   or position('ï¸' in body) > 0;

-- Repair existing notification copy where possible.
update public.notifications
set title = public.dn_ce_repair_utf8_mojibake(title),
    message = public.dn_ce_repair_utf8_mojibake(message)
where position('Ø' in title) > 0
   or position('Ù' in title) > 0
   or position('ðŸ' in title) > 0
   or position('â€' in title) > 0
   or position('âœ' in title) > 0
   or position('â­' in title) > 0
   or position('â†' in title) > 0
   or position('ï¸' in title) > 0
   or position('Ø' in message) > 0
   or position('Ù' in message) > 0
   or position('ðŸ' in message) > 0
   or position('â€' in message) > 0
   or position('âœ' in message) > 0
   or position('â­' in message) > 0
   or position('â†' in message) > 0
   or position('ï¸' in message) > 0;

create or replace function public.dn_ce_repair_notification_utf8()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.title := public.dn_ce_repair_utf8_mojibake(new.title);
  new.message := public.dn_ce_repair_utf8_mojibake(new.message);
  return new;
end;
$$;

revoke all on function public.dn_ce_repair_notification_utf8() from public;

drop trigger if exists dn_ce_notification_utf8_guard on public.notifications;
create trigger dn_ce_notification_utf8_guard
before insert or update of title, message on public.notifications
for each row execute function public.dn_ce_repair_notification_utf8();

do $$
begin
  if exists (
    select 1
    from public.message_templates
    where is_active = true
      and (
        position('Ø' in title) > 0
        or position('Ù' in title) > 0
        or position('ðŸ' in title) > 0
        or position('â€' in title) > 0
        or position('âœ' in title) > 0
        or position('â­' in title) > 0
        or position('â†' in title) > 0
        or position('ï¸' in title) > 0
        or position('Ø' in body) > 0
        or position('Ù' in body) > 0
        or position('ðŸ' in body) > 0
        or position('â€' in body) > 0
        or position('âœ' in body) > 0
        or position('â­' in body) > 0
        or position('â†' in body) > 0
        or position('ï¸' in body) > 0
      )
  ) then
    raise exception 'active_customer_experience_template_contains_mojibake';
  end if;
end;
$$;

select pg_notify('pgrst', 'reload schema');

commit;
