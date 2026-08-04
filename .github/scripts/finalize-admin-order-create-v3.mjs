import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);
const assert = (condition, message) => {
  if (!condition) throw new Error(`finalize_admin_order_create_v3_failed: ${message}`);
};
const replaceOnce = (content, from, to, label) => {
  assert(content.includes(from), `missing replacement target: ${label}`);
  return content.replace(from, to);
};
const replaceBetween = (content, startToken, endToken, replacement, label) => {
  const start = content.indexOf(startToken);
  const end = content.indexOf(endToken, start + startToken.length);
  assert(start >= 0 && end > start, `missing boundaries: ${label}`);
  return content.slice(0, start) + replacement + content.slice(end);
};

const migrationPath = "supabase/migrations/20260804211500_admin_order_crud_v3_nonblocking.sql";
let migration = read(migrationPath);
assert(!migration.includes("create or replace function public.admin_create_order_v3"), "create v3 already injected");

migration = migration.replaceAll(
  "where s.order_id=v_order_id::text",
  "where s.order_id::text=v_order_id::text",
).replaceAll(
  "where e.order_id=v_order_id::text",
  "where e.order_id::text=v_order_id::text",
).replaceAll(
  "where c.order_id=v_order_id",
  "where c.order_id::text=v_order_id::text",
);

const createSql = String.raw`

create unique index if not exists admin_order_mutation_audit_v3_create_request_uidx
  on public.admin_order_mutation_audit_v3(actor_id, request_id, operation)
  where operation = 'create';

create or replace function public.admin_create_order_v3(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_request_id text := btrim(coalesce(nullif(p_payload ->> 'request_id', ''), gen_random_uuid()::text));
  v_source_page text := nullif(btrim(coalesce(p_payload ->> 'source_page', 'admin_new_order')), '');
  v_reason text := nullif(btrim(coalesce(p_payload ->> 'reason', 'Admin order creation')), '');
  v_patch jsonb := coalesce(p_payload -> 'order', p_payload -> 'patch', '{}'::jsonb);
  v_existing public.admin_order_mutation_audit_v3%rowtype;
  v_created public.orders%rowtype;
  v_created_json jsonb;
  v_status text;
  v_reference text;
  v_coupon text;
  v_coupon_key text;
  v_conflict_order uuid;
  v_candidate_merchant uuid;
  v_candidate_count integer := 0;
  v_merchant public.merchants%rowtype;
  v_key text;
  v_raw text;
  v_numeric numeric;
  v_columns text;
  v_values text;
  v_warnings jsonb := '[]'::jsonb;
  v_warning jsonb;
  v_reconciliation boolean := false;
  v_audit_id uuid;
  v_now timestamptz := clock_timestamp();
  v_allowed constant text[] := array[
    'tracking_number','tracking_code','invoice_number','coupon_number',
    'customer_id','customer_name','customer_phone','customer_email',
    'sender_name','sender_phone','sender_email','sender_city','sender_address',
    'sender_emirate','sender_area','sender_landmark','sender_city_ar',
    'sender_emirate_ar','sender_area_ar','sender_address_ar','sender_landmark_ar',
    'receiver_name','receiver_phone','receiver_email','receiver_city','receiver_address',
    'receiver_emirate','receiver_area','receiver_landmark','receiver_city_ar',
    'receiver_emirate_ar','receiver_area_ar','receiver_address_ar','receiver_landmark_ar',
    'destination_country','destination_country_ar','delivery_date',
    'merchant_id','merchant_code','merchant_name','merchant_phone',
    'driver_id','assigned_driver_id','driver_code','driver_name','driver_phone',
    'order_count','shipping_scope','source_channel','source_domain','order_type','order_kind',
    'package_type','package_description','weight','pieces','service_type','payment_method',
    'payment_status','currency','notes','cancellation_reason','return_reason',
    'tracking_information','tracking_notes','cod_amount','goods_value','product_value',
    'merchant_goods_value','delivery_fee','delivery_price','base_price',
    'manual_delivery_price','price_source','discount_amount','discount','customer_total',
    'collected_amount','paid_amount','remaining_amount','merchant_due','company_revenue',
    'subtotal','total','total_amount','total_price','amount','price','delivery_fee_mode',
    'financial_version','pickup_lat','pickup_lng','sender_lat','sender_lng','receiver_lat',
    'receiver_lng','delivery_lat','delivery_lng','driver_lat','driver_lng','current_lat',
    'current_lng','live_lat','live_lng','status','status_history','created_at','updated_at',
    'is_deleted','deleted_at','deleted_by','deletion_reason','archived_at','restored_at','restored_by'
  ];
  v_numeric_keys constant text[] := array[
    'order_count','weight','pieces','cod_amount','goods_value','product_value',
    'merchant_goods_value','delivery_fee','delivery_price','base_price',
    'manual_delivery_price','discount_amount','discount','customer_total','collected_amount',
    'paid_amount','remaining_amount','merchant_due','company_revenue','subtotal','total',
    'total_amount','total_price','amount','price','financial_version','pickup_lat','pickup_lng',
    'sender_lat','sender_lng','receiver_lat','receiver_lng','delivery_lat','delivery_lng',
    'driver_lat','driver_lng','current_lat','current_lng','live_lat','live_lng'
  ];
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if not public.daynight_admin_or_support() then raise exception 'not_authorized'; end if;

  select * into v_existing
  from public.admin_order_mutation_audit_v3 a
  where a.actor_id = v_actor
    and a.request_id = v_request_id
    and a.operation = 'create'
  order by a.created_at desc
  limit 1;

  if v_existing.id is not null then
    select * into v_created from public.orders where id = v_existing.order_id;
    return jsonb_build_object(
      'ok', true,
      'success', true,
      'operation', 'create',
      'order', coalesce(to_jsonb(v_created), v_existing.after_data),
      'warnings', v_existing.warnings,
      'reconciliation_required', v_existing.reconciliation_required,
      'audit_id', v_existing.id,
      'request_id', v_request_id,
      'changed_fields', v_existing.changed_fields,
      'replayed', true
    );
  end if;

  v_patch := v_patch - 'id' - 'created_by' - 'financial_posted_at';
  v_status := public.dn_admin_normalize_status_v3(coalesce(v_patch ->> 'status', 'pending'));
  if v_status is null then raise exception 'invalid_order_status: %', coalesce(v_patch ->> 'status', 'null'); end if;
  v_patch := jsonb_set(v_patch, '{status}', to_jsonb(v_status), true);

  v_reference := coalesce(
    nullif(btrim(v_patch ->> 'tracking_number'), ''),
    nullif(btrim(v_patch ->> 'tracking_code'), ''),
    nullif(btrim(v_patch ->> 'invoice_number'), ''),
    'DN-' || to_char(v_now, 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
  );
  v_patch := jsonb_set(v_patch, '{tracking_number}', to_jsonb(v_reference), true);
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='tracking_code') then
    v_patch := jsonb_set(v_patch, '{tracking_code}', to_jsonb(v_reference), true);
  end if;
  v_patch := jsonb_set(v_patch, '{invoice_number}', to_jsonb(coalesce(nullif(btrim(v_patch ->> 'invoice_number'), ''), v_reference)), true);

  v_patch := v_patch || jsonb_build_object(
    'source_channel', coalesce(nullif(v_patch ->> 'source_channel', ''), 'admin_order_v3'),
    'source_domain', coalesce(nullif(v_patch ->> 'source_domain', ''), 'daynightae.com'),
    'shipping_scope', coalesce(nullif(v_patch ->> 'shipping_scope', ''), 'local'),
    'service_type', coalesce(nullif(v_patch ->> 'service_type', ''), 'standard'),
    'payment_method', coalesce(nullif(v_patch ->> 'payment_method', ''), 'cod'),
    'currency', coalesce(nullif(v_patch ->> 'currency', ''), 'AED'),
    'order_count', coalesce(v_patch -> 'order_count', '1'::jsonb),
    'pieces', coalesce(v_patch -> 'pieces', v_patch -> 'order_count', '1'::jsonb),
    'weight', coalesce(v_patch -> 'weight', '1'::jsonb),
    'goods_value', coalesce(v_patch -> 'goods_value', '0'::jsonb),
    'delivery_fee', coalesce(v_patch -> 'delivery_fee', v_patch -> 'delivery_price', '0'::jsonb),
    'discount_amount', coalesce(v_patch -> 'discount_amount', '0'::jsonb),
    'customer_total', coalesce(v_patch -> 'customer_total', v_patch -> 'total', '0'::jsonb),
    'merchant_due', coalesce(v_patch -> 'merchant_due', '0'::jsonb),
    'company_revenue', coalesce(v_patch -> 'company_revenue', v_patch -> 'delivery_fee', '0'::jsonb),
    'cod_amount', coalesce(v_patch -> 'cod_amount', '0'::jsonb),
    'created_at', coalesce(v_patch -> 'created_at', to_jsonb(v_now)),
    'updated_at', to_jsonb(v_now),
    'is_deleted', false
  );

  foreach v_key in array v_numeric_keys loop
    if v_patch ? v_key and jsonb_typeof(v_patch -> v_key) <> 'null' then
      v_raw := coalesce(v_patch ->> v_key, '');
      v_numeric := public.dn_admin_safe_numeric_v3(v_raw);
      if v_numeric is null then raise exception 'invalid_numeric_value: %', v_key; end if;
      if v_key = any(array[
        'order_count','weight','pieces','cod_amount','goods_value','product_value',
        'merchant_goods_value','delivery_fee','delivery_price','base_price',
        'manual_delivery_price','discount_amount','discount','customer_total','collected_amount',
        'paid_amount','remaining_amount','company_revenue','subtotal','total','total_amount',
        'total_price','amount','price','financial_version'
      ]) and v_numeric < 0 then
        v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
          'code','negative_numeric_normalized','field',v_key,'entered',v_raw,'saved',0
        ));
        v_reconciliation := true;
        v_numeric := 0;
      end if;
      if v_key = any(array['order_count','pieces','financial_version']) then
        v_numeric := round(v_numeric,0);
        if v_key = any(array['order_count','pieces']) then v_numeric := greatest(v_numeric,1); end if;
      elsif v_key='weight' then
        v_numeric := greatest(v_numeric,0.1);
      end if;
      v_patch := jsonb_set(v_patch,array[v_key],to_jsonb(v_numeric),true);
    end if;
  end loop;

  if v_patch ? 'merchant_id' and jsonb_typeof(v_patch -> 'merchant_id') <> 'null'
     and nullif(btrim(v_patch ->> 'merchant_id'),'') is not null then
    v_candidate_merchant := public.dn_admin_safe_uuid_v3(v_patch ->> 'merchant_id');
    if v_candidate_merchant is null then
      v_patch := jsonb_set(v_patch,'{merchant_id}','null'::jsonb,true);
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','merchant_link_warning','reason','invalid_merchant_id'));
      v_reconciliation := true;
    else
      select * into v_merchant from public.merchants where id=v_candidate_merchant;
      if v_merchant.id is null then
        v_patch := jsonb_set(v_patch,'{merchant_id}','null'::jsonb,true);
        v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','merchant_link_warning','reason','merchant_record_not_found','merchant_id',v_candidate_merchant));
        v_reconciliation := true;
      end if;
    end if;
  elsif nullif(btrim(v_patch ->> 'merchant_code'),'') is not null then
    select count(*),(array_agg(m.id order by m.id))[1] into v_candidate_count,v_candidate_merchant
    from public.merchants m
    where lower(btrim(coalesce(m.merchant_code,'')))=lower(btrim(v_patch ->> 'merchant_code'));
    if v_candidate_count=1 then
      select * into v_merchant from public.merchants where id=v_candidate_merchant;
      v_patch := jsonb_set(v_patch,'{merchant_id}',to_jsonb(v_candidate_merchant),true);
    else
      v_patch := jsonb_set(v_patch,'{merchant_id}','null'::jsonb,true);
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','merchant_link_warning','reason',case when v_candidate_count=0 then 'exact_code_not_found' else 'exact_code_ambiguous' end,'merchant_code',v_patch ->> 'merchant_code'));
      v_reconciliation := true;
    end if;
  elsif nullif(regexp_replace(coalesce(v_patch ->> 'merchant_phone',''),'\D','','g'),'') is not null then
    select count(*),(array_agg(m.id order by m.id))[1] into v_candidate_count,v_candidate_merchant
    from public.merchants m
    where right(regexp_replace(coalesce(m.phone,''),'\D','','g'),9)=right(regexp_replace(v_patch ->> 'merchant_phone','\D','','g'),9);
    if v_candidate_count=1 then
      select * into v_merchant from public.merchants where id=v_candidate_merchant;
      v_patch := jsonb_set(v_patch,'{merchant_id}',to_jsonb(v_candidate_merchant),true);
    else
      v_patch := jsonb_set(v_patch,'{merchant_id}','null'::jsonb,true);
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','merchant_link_warning','reason',case when v_candidate_count=0 then 'exact_phone_not_found' else 'exact_phone_ambiguous' end));
      v_reconciliation := true;
    end if;
  else
    v_patch := jsonb_set(v_patch,'{merchant_id}','null'::jsonb,true);
  end if;

  if v_merchant.id is not null then
    if not (v_patch ? 'merchant_code') then v_patch := jsonb_set(v_patch,'{merchant_code}',coalesce(to_jsonb(v_merchant.merchant_code),'null'::jsonb),true); end if;
    if not (v_patch ? 'merchant_name') then v_patch := jsonb_set(v_patch,'{merchant_name}',coalesce(to_jsonb(v_merchant.trade_name),'null'::jsonb),true); end if;
    begin
      if public.dn_merchant_portal_link_count(v_merchant.id)=0 then
        v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','merchant_link_warning','reason','merchant_portal_account_not_linked','merchant_id',v_merchant.id));
        v_reconciliation := true;
      end if;
    exception when others then
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','merchant_link_check_unavailable','merchant_id',v_merchant.id));
      v_reconciliation := true;
    end;
  end if;

  v_coupon := public.canonical_order_coupon(v_patch ->> 'coupon_number');
  if v_coupon is null then
    v_patch := jsonb_set(v_patch,'{coupon_number}','null'::jsonb,true);
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','coupon_reconciliation_required','reason','coupon_missing_or_blank'));
    v_reconciliation := true;
  else
    v_coupon_key := public.normalized_order_coupon(v_coupon);
    select o.id into v_conflict_order
    from public.orders o
    where public.normalized_order_coupon(o.coupon_number)=v_coupon_key
    order by o.created_at asc nulls last,o.id
    limit 1;
    if v_conflict_order is not null then
      v_patch := jsonb_set(v_patch,'{coupon_number}','null'::jsonb,true);
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','coupon_reconciliation_required','reason','coupon_conflict','requested_coupon',v_coupon,'conflicting_order_id',v_conflict_order));
      v_reconciliation := true;
    else
      v_patch := jsonb_set(v_patch,'{coupon_number}',to_jsonb(v_coupon),true);
    end if;
  end if;

  for v_key in select key from jsonb_each(v_patch) loop
    if jsonb_typeof(v_patch -> v_key)='null'
       and exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name='orders' and c.column_name=v_key and c.is_nullable='NO') then
      v_patch := v_patch - v_key;
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','non_nullable_clear_ignored','field',v_key));
      v_reconciliation := true;
    end if;
  end loop;

  select string_agg(format('%I',c.column_name),', ' order by c.ordinal_position),
         string_agg(format('(jsonb_populate_record(null::public.orders,$1)).%I',c.column_name),', ' order by c.ordinal_position)
  into v_columns,v_values
  from information_schema.columns c
  where c.table_schema='public' and c.table_name='orders'
    and c.column_name=any(v_allowed)
    and v_patch ? c.column_name
    and coalesce(c.is_generated,'NEVER')='NEVER'
    and coalesce(c.identity_generation,'')<>'ALWAYS';

  if nullif(v_columns,'') is null then raise exception 'admin_order_v3_create_payload_empty'; end if;

  perform set_config('daynight.admin_order_override','on',true);
  execute format('insert into public.orders (%s) select %s returning *',v_columns,v_values)
    using v_patch into v_created;
  perform set_config('daynight.admin_order_override','off',true);

  if v_created.id is null then raise exception 'admin_order_v3_create_returned_no_row'; end if;
  v_created_json := to_jsonb(v_created);

  begin
    execute 'insert into public.order_status_history(order_id,status,note,created_at)
             select $1,(jsonb_populate_record(null::public.order_status_history,jsonb_build_object(''status'',$2))).status,$3,$4'
      using v_created.id,v_status,coalesce(v_reason,'Admin order creation'),v_now;
  exception when others then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','timeline_reconciliation_required','sqlstate',sqlstate));
    v_reconciliation := true;
  end;

  v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','notification_sync_queued','status',v_status));
  v_reconciliation := true;

  insert into public.admin_order_mutation_audit_v3(
    order_id,operation,request_id,actor_id,source_page,reason,old_status,new_status,
    changed_fields,warnings,reconciliation_required,before_data,after_data
  ) values (
    v_created.id,'create',v_request_id,v_actor,v_source_page,v_reason,null,v_status,
    array(select jsonb_object_keys(v_created_json)),v_warnings,v_reconciliation,null,v_created_json
  ) returning id into v_audit_id;

  for v_warning in select value from jsonb_array_elements(v_warnings) loop
    begin
      insert into public.admin_order_reconciliation_queue(order_id,request_id,warning_code,warning_detail,created_by)
      values(v_created.id,v_request_id,coalesce(nullif(v_warning ->> 'code',''),'admin_order_warning'),v_warning,v_actor)
      on conflict(order_id,request_id,warning_code) do nothing;
    exception when others then null;
    end;
  end loop;

  return jsonb_build_object(
    'ok',true,'success',true,'operation','create','order',v_created_json,
    'warnings',v_warnings,'reconciliation_required',v_reconciliation,
    'audit_id',v_audit_id,'request_id',v_request_id,
    'changed_fields',to_jsonb(array(select jsonb_object_keys(v_created_json))),
    'replayed',false,'core_saved_at',v_now
  );
exception when others then
  perform set_config('daynight.admin_order_override','off',true);
  raise exception using
    errcode=coalesce(nullif(sqlstate,''),'P0001'),
    message='admin_create_order_v3_failed: ' || sqlerrm,
    detail='SQLSTATE=' || sqlstate || '; request_id=' || coalesce(v_request_id,'null'),
    hint='Only authentication, authorization, status and core value conversion can block Admin order creation. Optional relationships are warnings.';
end;
$$;

revoke all on function public.admin_create_order_v3(jsonb) from public,anon;
grant execute on function public.admin_create_order_v3(jsonb) to authenticated,service_role;
`;

const migrationMarker = "\nnotify pgrst, 'reload schema';\n\ncommit;";
assert(migration.includes(migrationMarker), "migration tail marker missing");
migration = migration.replace(migrationMarker, `${createSql}${migrationMarker}`);
migration = migration.replace(
  "to_regprocedure('public.admin_update_order_complete_v3(jsonb)') is not null",
  "to_regprocedure('public.admin_update_order_complete_v3(jsonb)') is not null\n      and to_regprocedure('public.admin_create_order_v3(jsonb)') is not null",
);
migration = migration.replace(
  "'canonical_rpc','admin_update_order_complete_v3',",
  "'canonical_rpc','admin_update_order_complete_v3',\n    'canonical_create_rpc','admin_create_order_v3',",
);
write(migrationPath, migration);

const mutationsPath = "artifacts/day-night-delivery/src/lib/adminOrderMutations.ts";
let mutations = read(mutationsPath);
mutations = replaceOnce(
  mutations,
  `export type AdminOrderMutationOperation =\n  | "update"`,
  `export type AdminOrderMutationOperation =\n  | "create"\n  | "update"`,
  "mutation operation create union",
);
const createClient = `export async function createAdminOrder(
  patch: Record<string, unknown>,
  options: MutationOptions = {},
): Promise<AdminOrderMutationResult> {
  if (!supabase) throw new Error("supabase_unavailable");
  const mutationRequestId = clean(options.requestId) || requestId("create");
  const submissionKey = \`create:\${mutationRequestId}\`;
  const existing = inFlight.get(submissionKey);
  if (existing) return existing;

  const promise: Promise<AdminOrderMutationResult> = (async () => {
    const { data, error } = await supabase.rpc("admin_create_order_v3", {
      p_payload: {
        operation: "create",
        request_id: mutationRequestId,
        source_page: clean(options.sourcePage) || "admin_new_order",
        reason: clean(options.reason || options.note) || "DAY NIGHT Admin order creation",
        order: patch,
      },
    });
    if (error) throw new Error(diagnostic(error) || "admin_create_order_v3_failed");
    const envelope = normalizeEnvelope(data);
    if (envelope.ok !== true || envelope.success !== true || !envelope.order?.id) {
      throw new Error("admin_order_v3_create_not_confirmed");
    }
    return {
      success: true,
      operation: "create",
      order: envelope.order,
      warnings: normalizeWarnings(envelope.warnings),
      reconciliationRequired: Boolean(envelope.reconciliation_required),
      auditId: clean(envelope.audit_id) || null,
      requestId: clean(envelope.request_id) || mutationRequestId,
      changedFields: Array.isArray(envelope.changed_fields)
        ? envelope.changed_fields.map(clean).filter(Boolean)
        : [],
      replayed: Boolean(envelope.replayed),
      source: "rpc",
    };
  })();

  inFlight.set(submissionKey, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(submissionKey);
  }
}

`;
mutations = replaceOnce(
  mutations,
  "export function updateAdminOrder(\n",
  createClient + "export function updateAdminOrder(\n",
  "create mutation client insertion",
);
write(mutationsPath, mutations);

const adminDataPath = "artifacts/day-night-delivery/src/lib/adminOperationsData.ts";
let adminData = read(adminDataPath);
adminData = replaceOnce(
  adminData,
  `import { currentUiIsArabic, friendlyDatabaseErrorMessage } from "./friendlyErrorMessage";`,
  `import { currentUiIsArabic, friendlyDatabaseErrorMessage } from "./friendlyErrorMessage";\nimport { createAdminOrder, type AdminOrderWarning } from "./adminOrderMutations";`,
  "admin operations create import",
);
adminData = replaceOnce(
  adminData,
  `export type OpsCreateResult<T> = { row: T; source: OpsDataSource };`,
  `export type OpsCreateResult<T> = {\n  row: T;\n  source: OpsDataSource;\n  warnings?: AdminOrderWarning[];\n  reconciliationRequired?: boolean;\n  requestId?: string;\n};`,
  "create result warning metadata",
);
const createOpsReplacement = `export async function createOpsOrder(
  input: OpsOrderInput,
): Promise<OpsCreateResult<Order>> {
  if (!supabase)
    throw operationsError(null, "Supabase is not configured for order operations.");

  const merchant = input.merchant || null;
  const createdAt = new Date().toISOString();
  const trackingSeed =
    clean(input.coupon_number) ||
    \`\${merchant?.merchant_code || clean(input.merchant_code) || "ADMIN"}-\${Date.now().toString(36)}\`;
  const trackingNumber = createDayNightInvoiceNumber(trackingSeed, new Date(createdAt));
  const payload = buildOrderPayload(input, merchant, trackingNumber, createdAt);
  const result = await createAdminOrder(payload, {
    sourcePage: "admin_new_order_flexible",
    reason: "Admin order creation from flexible entry",
  });
  return {
    row: result.order,
    source: "rpc",
    warnings: result.warnings,
    reconciliationRequired: result.reconciliationRequired,
    requestId: result.requestId,
  };
}

`;
adminData = replaceBetween(
  adminData,
  "export async function createOpsOrder(\n",
  "export async function updateOpsOrder(",
  createOpsReplacement,
  "createOpsOrder function",
);
write(adminDataPath, adminData);

const financialPath = "artifacts/day-night-delivery/src/lib/orderFinancialOperations.ts";
let financial = read(financialPath);
financial = replaceOnce(
  financial,
  `import { createDayNightInvoiceNumber } from "./printableDocuments";`,
  `import { createDayNightInvoiceNumber } from "./printableDocuments";\nimport { createAdminOrder } from "./adminOrderMutations";`,
  "financial create import",
);
financial = financial.replace(
  "  merchant: Merchant,\n  financials: ReturnType<typeof calculateFinancialOpsOrder>,\n  trackingNumber: string,",
  "  merchant: Merchant | null,\n  financials: ReturnType<typeof calculateFinancialOpsOrder>,\n  trackingNumber: string,",
);
financial = financial.replace(
  "const senderCity = clean(input.pickup_city || merchant.emirate || \"Abu Dhabi\");",
  "const senderCity = clean(input.pickup_city || merchant?.emirate || \"Abu Dhabi\");",
);
financial = financial.replace(
  "    merchant.pickup_address || merchant.address || senderCity,",
  "    merchant?.pickup_address || merchant?.address || senderCity,",
);
financial = financial.replace(
  "    merchant_id: merchant.id,\n    merchant_name: merchant.trade_name,\n    merchant_code: merchant.merchant_code || \"\",",
  "    merchant_id: merchant?.id || clean(input.merchant_id) || null,\n    merchant_name: merchant?.trade_name || clean(input.merchant_name) || null,\n    merchant_code: merchant?.merchant_code || clean(input.merchant_code) || null,",
);
financial = financial.replace(
  "    sender_name: merchant.trade_name,\n    sender_phone: clean(merchant.phone || \"971568757331\"),",
  "    sender_name: merchant?.trade_name || clean(input.sender_name) || \"DAY NIGHT Admin\",\n    sender_phone: clean(merchant?.phone || input.sender_phone),",
);
const createFinancialReplacement = `export async function createFinancialOpsOrder(
  input: FinancialOpsOrderInput,
): Promise<OpsCreateResult<Order>> {
  if (!supabase) throw operationError(null, "Supabase is not configured.");
  const merchant = input.merchant || null;
  const financials = calculateFinancialOpsOrder(input);
  const createdAt = new Date().toISOString();
  const trackingSeed =
    clean(input.coupon_number) ||
    \`\${merchant?.merchant_code || clean(input.merchant_code) || "ADMIN"}-\${Date.now().toString(36)}\`;
  const trackingNumber = createDayNightInvoiceNumber(trackingSeed, new Date(createdAt));
  const payload = buildFinancialOrderPayload(input, merchant, financials, trackingNumber, createdAt);
  const result = await createAdminOrder(payload, {
    sourcePage: "admin_new_order_complete",
    reason: "Admin financially complete order creation",
  });
  return {
    row: result.order,
    source: "rpc",
    warnings: result.warnings,
    reconciliationRequired: result.reconciliationRequired,
    requestId: result.requestId,
  };
}

`;
financial = replaceBetween(
  financial,
  "export async function createFinancialOpsOrder(\n",
  "function buildCorePatch(\n",
  createFinancialReplacement,
  "createFinancialOpsOrder function",
);
write(financialPath, financial);

const personalPath = "artifacts/day-night-delivery/src/lib/personalOrderOperations.ts";
let personal = read(personalPath);
personal = replaceOnce(
  personal,
  `import { createDayNightInvoiceNumber } from "./printableDocuments";`,
  `import { createDayNightInvoiceNumber } from "./printableDocuments";\nimport { createAdminOrder } from "./adminOrderMutations";`,
  "personal create import",
);
const personalStart = personal.indexOf("export async function createPersonalOpsOrder(\n");
assert(personalStart >= 0, "personal create function start");
const personalReplacement = `export async function createPersonalOpsOrder(
  input: PersonalOrderInput,
): Promise<OpsCreateResult<Order>> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const couponNumber = clean(input.reference);
  const financials = calculatePersonalOrderFinancials({
    goodsValue: input.goods_value,
    discountAmount: input.discount_amount,
  });
  const now = new Date();
  const createdAt = now.toISOString();
  const trackingNumber = createDayNightInvoiceNumber(
    couponNumber || \`PERSONAL-\${Date.now().toString(36)}\`,
    now,
  );
  const paymentMethod = normalizedPaymentMethod(input.payment_method);
  const packageValue = clean(input.package_type) || "Personal shipment";
  const payload = {
    tracking_number: trackingNumber,
    tracking_code: trackingNumber,
    invoice_number: trackingNumber,
    coupon_number: couponNumber || null,
    merchant_id: null,
    merchant_name: null,
    merchant_code: null,
    source_channel: "admin_personal_order",
    source_domain: "daynightae.com",
    sender_name: clean(input.sender_name),
    sender_phone: clean(input.sender_phone),
    sender_city: clean(input.pickup_city || "Abu Dhabi"),
    sender_address: address([input.pickup_area, input.pickup_street, input.pickup_city]),
    receiver_name: clean(input.receiver_name),
    receiver_phone: clean(input.receiver_phone),
    receiver_city: clean(input.delivery_city || "Abu Dhabi"),
    receiver_address: address([input.delivery_area, input.delivery_street, input.delivery_city]),
    package_type: packageValue,
    package_description: packageValue,
    weight: 1,
    pieces: 1,
    order_count: 1,
    shipping_scope: "local",
    service_type: "standard",
    payment_method: paymentMethod,
    cod_amount: paymentMethod === "cod" ? financials.customerTotal : 0,
    goods_value: financials.goodsValue,
    delivery_fee: PERSONAL_ORDER_DELIVERY_FEE,
    discount_amount: financials.discountAmount,
    delivery_fee_mode: "customer_pays",
    customer_total: financials.customerTotal,
    merchant_due: 0,
    company_revenue: PERSONAL_ORDER_DELIVERY_FEE,
    delivery_price: PERSONAL_ORDER_DELIVERY_FEE,
    base_price: PERSONAL_ORDER_DELIVERY_FEE,
    subtotal: financials.customerTotal,
    total: financials.customerTotal,
    total_price: financials.customerTotal,
    amount: financials.customerTotal,
    price: financials.customerTotal,
    manual_delivery_price: null,
    price_source: "system",
    currency: "AED",
    notes: [clean(input.notes), "PERSONAL_ORDER · Fixed delivery 25 AED"].filter(Boolean).join(" | "),
    status: "pending",
    status_history: [{ status: "pending", date: createdAt, created_at: createdAt, note: "Created by Admin as a personal order without merchant" }],
    created_at: createdAt,
    updated_at: createdAt,
  };
  const result = await createAdminOrder(payload, {
    sourcePage: "admin_personal_order",
    reason: "Admin personal order creation",
  });
  return {
    row: result.order,
    source: "rpc",
    warnings: result.warnings,
    reconciliationRequired: result.reconciliationRequired,
    requestId: result.requestId,
  };
}
`;
personal = personal.slice(0, personalStart) + personalReplacement;
write(personalPath, personal);

console.log("Prepared canonical non-blocking Admin order creation v3 backend and service layer.");
