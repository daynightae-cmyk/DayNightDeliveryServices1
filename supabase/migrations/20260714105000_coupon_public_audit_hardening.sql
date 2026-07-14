-- =========================================================
-- DAY NIGHT — Public Coupon Audit Hardening
-- Limits anonymous audit metadata, validates a real order reference,
-- and prevents duplicate public audit rows for the same order.
-- =========================================================

create unique index if not exists coupon_intake_public_tracking_unique
on public.coupon_intake_sessions (tracking_number)
where source_channel = 'public_request'
  and tracking_number is not null;

create or replace function public.public_create_coupon_intake_session(p_payload jsonb)
returns public.coupon_intake_sessions
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  created public.coupon_intake_sessions;
  safe_fields jsonb;
  reference text;
  order_exists boolean;
begin
  reference := nullif(left(trim(p_payload->>'tracking_number'), 120), '');
  if reference is null then
    raise exception 'tracking_number_required';
  end if;

  select exists (
    select 1
    from public.orders o
    where o.id::text = reference
       or o.tracking_number::text = reference
       or o.invoice_number::text = reference
  ) into order_exists;

  if not order_exists then
    raise exception 'order_reference_not_found';
  end if;

  -- Public audit stores only operational metadata. It intentionally excludes
  -- names, phone numbers, full addresses, image paths, and raw OCR text.
  safe_fields := jsonb_strip_nulls(jsonb_build_object(
    'coupon_number', nullif(left(trim(p_payload->'extracted_fields'->>'coupon_number'), 120), ''),
    'delivery_city', nullif(left(trim(p_payload->'extracted_fields'->>'delivery_city'), 80), ''),
    'package_type', nullif(left(trim(p_payload->'extracted_fields'->>'package_type'), 160), ''),
    'cod_amount', nullif(left(trim(p_payload->'extracted_fields'->>'cod_amount'), 40), '')
  ));

  insert into public.coupon_intake_sessions (
    tracking_number,
    coupon_number,
    image_path,
    source_channel,
    intake_source,
    extraction_source,
    extraction_confidence,
    extracted_fields,
    raw_text_preview,
    status,
    created_by,
    reviewed_at
  ) values (
    reference,
    nullif(left(trim(p_payload->>'coupon_number'), 120), ''),
    null,
    'public_request',
    coalesce(nullif(left(trim(p_payload->>'intake_source'), 30), ''), 'upload'),
    coalesce(nullif(left(trim(p_payload->>'extraction_source'), 30), ''), 'manual'),
    greatest(0, least(100, coalesce((p_payload->>'extraction_confidence')::integer, 0))),
    safe_fields,
    null,
    'order_created',
    auth.uid(),
    now()
  )
  on conflict (tracking_number) where source_channel = 'public_request'
  do update set
    coupon_number = excluded.coupon_number,
    intake_source = excluded.intake_source,
    extraction_source = excluded.extraction_source,
    extraction_confidence = excluded.extraction_confidence,
    extracted_fields = excluded.extracted_fields,
    status = 'order_created',
    reviewed_at = now(),
    updated_at = now()
  returning * into created;

  return created;
end;
$$;

revoke all on function public.public_create_coupon_intake_session(jsonb) from public;
grant execute on function public.public_create_coupon_intake_session(jsonb) to anon, authenticated;

comment on function public.public_create_coupon_intake_session(jsonb) is
  'Creates metadata-only coupon intake audit after validating an existing order reference; stores no public image, PII, or raw OCR text.';
