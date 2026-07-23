\set ON_ERROR_STOP on

DO $$
DECLARE
  v_health jsonb;
  v_required_table text;
  v_required_function text;
BEGIN
  v_health := public.customer_experience_runtime_health();
  IF coalesce((v_health->>'ok')::boolean,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'customer_experience_runtime_health failed: %', v_health;
  END IF;

  FOREACH v_required_table IN ARRAY ARRAY[
    'customer_experience_settings',
    'message_templates',
    'outbound_message_logs',
    'feedback_tokens',
    'order_feedback',
    'complaints',
    'complaint_attachments',
    'complaint_events',
    'order_contact_attempts'
  ] LOOP
    IF to_regclass('public.'||v_required_table) IS NULL THEN
      RAISE EXCEPTION 'missing required table: %', v_required_table;
    END IF;
  END LOOP;

  FOREACH v_required_function IN ARRAY ARRAY[
    'public.create_feedback_token_for_order(uuid)',
    'public.get_feedback_context(text)',
    'public.submit_order_feedback(text,integer,integer,integer,integer,integer,integer,integer,integer,text[],text,boolean,boolean)',
    'public.submit_public_complaint(text,text,text,text,text,boolean)',
    'public.driver_feedback_summary()',
    'public.merchant_order_feedback()',
    'public.admin_order_feedback_rows()',
    'public.admin_update_complaint(uuid,text,text,uuid,text,text)',
    'public.admin_set_feedback_review(uuid,text,boolean)',
    'public.admin_create_complaint_from_feedback(uuid,text)',
    'public.admin_suspend_driver_for_complaint(uuid,text)'
  ] LOOP
    IF to_regprocedure(v_required_function) IS NULL THEN
      RAISE EXCEPTION 'missing required function: %', v_required_function;
    END IF;
  END LOOP;

  IF NOT EXISTS(
    SELECT 1 FROM storage.buckets
    WHERE id='complaint-attachments'
      AND public=false
      AND file_size_limit=8388608
      AND allowed_mime_types @> ARRAY['image/jpeg','image/png','image/webp','application/pdf']::text[]
  ) THEN
    RAISE EXCEPTION 'complaint attachment bucket contract failed';
  END IF;

  IF NOT EXISTS(
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage'
      AND tablename='objects'
      AND policyname='ce_complaint_storage_insert'
  ) THEN
    RAISE EXCEPTION 'complaint attachment insert policy missing';
  END IF;

  IF NOT EXISTS(
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public'
      AND p.proname='dn_ce_request_ip_hash'
      AND pg_get_functiondef(p.oid) LIKE '%extensions.hmac(%'
  ) THEN
    RAISE EXCEPTION 'salted request hash contract failed';
  END IF;

  IF EXISTS(
    SELECT 1
    FROM information_schema.role_column_grants
    WHERE table_schema='public'
      AND table_name='order_feedback'
      AND grantee='authenticated'
      AND column_name IN ('customer_id','ip_hash','metadata')
      AND privilege_type='SELECT'
  ) THEN
    RAISE EXCEPTION 'authenticated role can select sensitive feedback columns';
  END IF;

  IF NOT EXISTS(
    SELECT 1
    FROM information_schema.role_column_grants
    WHERE table_schema='public'
      AND table_name='order_feedback'
      AND grantee='authenticated'
      AND column_name='overall_rating'
      AND privilege_type='SELECT'
  ) THEN
    RAISE EXCEPTION 'safe feedback rating columns are not granted';
  END IF;

  IF (SELECT count(*) FROM public.message_templates WHERE language IN ('ar','en') AND channel='whatsapp') < 30 THEN
    RAISE EXCEPTION 'bilingual WhatsApp template seed is incomplete';
  END IF;
END;
$$;

\echo 'DAY NIGHT Customer Experience PostgreSQL verification: PASS'
