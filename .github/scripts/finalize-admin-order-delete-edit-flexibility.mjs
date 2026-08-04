import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.resolve(root, relative), "utf8");
const write = (relative, content) => {
  const target = path.resolve(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content.endsWith("\n") ? content : `${content}\n`, "utf8");
};
const replaceRequired = (source, search, replacement, label) => {
  const next = typeof search === "string" ? source.replace(search, replacement) : source.replace(search, replacement);
  if (next === source) throw new Error(`finalize_admin_order_flexibility_failed: ${label}`);
  return next;
};

const appRoot = "artifacts/day-night-delivery";
const editPath = `${appRoot}/src/components/admin/AdminOrderEditModalComplete.tsx`;
let edit = read(editPath);

edit = replaceRequired(
  edit,
  '  const [editReason, setEditReason] = useState("");\n  const [confirmed, setConfirmed] = useState(false);\n',
  "",
  "remove manual edit reason state",
);
edit = replaceRequired(
  edit,
  '    setEditReason("");\n    setConfirmed(false);\n',
  "",
  "remove manual edit reason reset",
);
edit = replaceRequired(
  edit,
  `    if (sensitiveChange && clean(editReason).length < 6) {
      return isArabic
        ? "اكتب سببًا واضحًا للتعديل المالي أو نقل الطلب، على ألا يقل عن 6 أحرف."
        : "Enter a clear reason of at least 6 characters for the financial or merchant change.";
    }
    if (sensitiveChange && !confirmed) {
      return isArabic
        ? "أكد مراجعة أثر التعديل على التاجر والعميل والحسابات."
        : "Confirm that you reviewed the merchant, customer, and accounting impact.";
    }
`,
  "",
  "remove manual reason and confirmation validation",
);
edit = replaceRequired(
  edit,
  "      const saveInput = {\n",
  `      const automaticEditReason = isArabic
        ? merchantChanged && financialChanged
          ? "تعديل إداري تلقائي موثّق: تحديث التاجر والقيم المالية"
          : merchantChanged
            ? "تعديل إداري تلقائي موثّق: تحديث التاجر وربط ملكية الطلب"
            : financialChanged
              ? "تعديل إداري تلقائي موثّق: تحديث القيم المالية والتحصيل"
              : "تعديل إداري تلقائي موثّق: تحديث بيانات الطلب"
        : merchantChanged && financialChanged
          ? "Automatic audited admin edit: merchant and financial values updated"
          : merchantChanged
            ? "Automatic audited admin edit: merchant ownership updated"
            : financialChanged
              ? "Automatic audited admin edit: financial and collection values updated"
              : "Automatic audited admin edit: order details updated";
      const saveInput = {
`,
  "insert automatic audit reason",
);
edit = replaceRequired(
  edit,
  `        edit_reason:
          clean(editReason) ||
          (isArabic
            ? "تحديث بيانات الطلب من لوحة الإدارة"
            : "Order details updated from the admin panel"),
`,
  "        edit_reason: automaticEditReason,\n",
  "use automatic edit reason",
);
edit = edit.replace(/\n\s*setConfirmed\(false\);/g, "");

const manualAuditBlock = /            <label className=\{labelClass\}>\n              <span>\n                \{sensitiveChange[\s\S]*?data-admin-complete-order-confirm="true"[\s\S]*?            \)\}\n/;
edit = replaceRequired(
  edit,
  manualAuditBlock,
  `            <div
              className="flex items-start gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4 text-xs font-bold leading-6 text-emerald-50/85"
              data-admin-automatic-audit-reason="true"
            >
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-gold" />
              <span>
                {isArabic
                  ? "لا تحتاج إلى كتابة سبب أو تفعيل تأكيد إضافي. ينشئ النظام وصف تدقيق مهنيًا تلقائيًا وفق الحقول التي غيّرتها، ثم يحفظ القيم السابقة واللاحقة واسم المسؤول."
                  : "No manual reason or extra confirmation is required. The system automatically creates a professional audit description from the changed fields and records before/after values with the acting administrator."}
              </span>
            </div>
`,
  "replace manual reason controls with automatic audit notice",
);

if (/editReason|setEditReason|data-admin-complete-order-reason|data-admin-complete-order-confirm/.test(edit)) {
  throw new Error("finalize_admin_order_flexibility_failed: manual edit-reason controls remain");
}
write(editPath, edit);

const deleteModalPath = `${appRoot}/src/components/admin/AdminOrderDeleteModal.tsx`;
let deleteModal = read(deleteModalPath);
deleteModal = replaceRequired(
  deleteModal,
  `  onClose,
}: Props) {`,
  `  onClose,
  onDeleted,
}: Props) {`,
  "wire deletion callback prop",
);
deleteModal = replaceRequired(
  deleteModal,
  `        // Close immediately. The current section, filters, pagination and scroll
        // position remain mounted while the deleted row disappears locally.
        onClose();`,
  `        await onDeleted?.(result.reference);

        // Close immediately. The current section, filters, pagination and scroll
        // position remain mounted while the deleted row disappears locally.
        onClose();`,
  "invoke deletion callback",
);
deleteModal = replaceRequired(
  deleteModal,
  "  }, [isArabic, onClose, open, order, retryToken]);",
  "  }, [isArabic, onClose, onDeleted, open, order, retryToken]);",
  "track deletion callback dependency",
);
write(deleteModalPath, deleteModal);

const deleteData = `import { supabase } from "../supabase";
import type { Order } from "../types";

export type AdminOrderDeleteResult = {
  deleted: boolean;
  reference: string;
  source: "rpc" | "db";
};

type RpcDeleteResult = {
  deleted?: boolean;
  reference?: string;
};

type ErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

type RpcAttempt = {
  name: string;
  args: Record<string, unknown>;
};

const INTERNAL_DELETE_REASON =
  "Automatic one-click deletion from DAY NIGHT admin order manager";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function orderReference(order: Order) {
  return clean(
    order.id ||
      order.tracking_number ||
      order.invoice_number ||
      order.coupon_number,
  );
}

function normalizeRpcResult(data: unknown): RpcDeleteResult | null {
  const value = Array.isArray(data) ? data[0] : data;
  if (value === true) return { deleted: true };
  if (!value || typeof value !== "object") return null;
  return value as RpcDeleteResult;
}

function diagnostic(error: unknown) {
  const value = (error || {}) as ErrorLike;
  return [value.code, value.message, value.details, value.hint]
    .map(clean)
    .filter(Boolean)
    .filter((item, index, all) => all.indexOf(item) === index)
    .join(" | ");
}

function deletionError(error: unknown) {
  const value = (error || {}) as ErrorLike;
  const detail = diagnostic(error) || "admin_order_delete_failed";
  const wrapped = new Error(detail) as Error & ErrorLike;
  wrapped.code = clean(value.code || "ADMIN_ORDER_DELETE_FAILED");
  wrapped.details = clean(value.details);
  wrapped.hint = clean(value.hint);
  return wrapped;
}

async function fetchOrder(reference: string, orderId?: string) {
  if (!supabase) return { row: null as Order | null, error: null as unknown };

  if (clean(orderId)) {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", clean(orderId))
      .limit(1);
    return { row: (data?.[0] as Order | undefined) || null, error };
  }

  let lastError: unknown = null;
  for (const column of ["tracking_number", "invoice_number", "coupon_number", "id"]) {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq(column, reference)
      .limit(1);
    if (error) {
      lastError = error;
      continue;
    }
    if (data?.[0]) return { row: data[0] as Order, error: null };
  }

  return { row: null, error: lastError };
}

async function orderStillExists(reference: string, supplied: Order) {
  const lookup = await fetchOrder(reference, clean(supplied.id));
  if (lookup.error) throw lookup.error;
  return Boolean(lookup.row);
}

async function deleteDirectly(reference: string, supplied: Order) {
  if (!supabase) return { result: null as AdminOrderDeleteResult | null, error: null as unknown };

  const lookup = supplied.id
    ? { row: supplied, error: null as unknown }
    : await fetchOrder(reference);
  if (lookup.error) return { result: null, error: lookup.error };
  const targetId = clean(lookup.row?.id);
  let lastError: unknown = null;

  if (targetId) {
    const history = await supabase
      .from("order_status_history")
      .delete()
      .eq("order_id", targetId);
    if (history.error) lastError = history.error;

    const deleted = await supabase
      .from("orders")
      .delete()
      .eq("id", targetId)
      .select("id");
    if (deleted.error) {
      lastError = deleted.error;
    } else if (deleted.data?.length || !(await orderStillExists(reference, supplied))) {
      return {
        result: { deleted: true, reference, source: "db" as const },
        error: null,
      };
    }
  }

  for (const column of ["tracking_number", "invoice_number", "coupon_number"]) {
    const deleted = await supabase
      .from("orders")
      .delete()
      .eq(column, reference)
      .select("id");
    if (deleted.error) {
      lastError = deleted.error;
      continue;
    }
    if (deleted.data?.length || !(await orderStillExists(reference, supplied))) {
      return {
        result: { deleted: true, reference, source: "db" as const },
        error: null,
      };
    }
  }

  return { result: null, error: lastError };
}

/**
 * Deletes an exact order without asking the operator for a reason.
 * A professional internal audit reason is always supplied for compatibility with
 * older production RPCs, while the v2 RPC removes status and assignment blocks.
 */
export async function deleteAdminOrderImmediately(
  order: Order,
): Promise<AdminOrderDeleteResult> {
  if (!supabase) throw deletionError({ message: "supabase_unavailable" });

  const reference = orderReference(order);
  if (!reference) throw deletionError({ message: "order_reference_missing" });

  const payload = {
    reference,
    order_id: clean(order.id || reference),
    reason: INTERNAL_DELETE_REASON,
    audit_reason: INTERNAL_DELETE_REASON,
  };
  const orderId = clean(order.id || reference);
  const rpcAttempts: RpcAttempt[] = [
    { name: "admin_delete_order_flexible_v2", args: { p_payload: payload } },
    { name: "admin_delete_order_runtime", args: { p_payload: payload } },
    {
      name: "admin_delete_order_runtime",
      args: { p_reference: reference, p_reason: INTERNAL_DELETE_REASON },
    },
    { name: "admin_delete_order_runtime", args: { p_reference: reference } },
    {
      name: "admin_delete_order",
      args: { p_reference: reference, p_reason: INTERNAL_DELETE_REASON },
    },
    { name: "admin_delete_order", args: { p_reference: reference } },
    {
      name: "admin_delete_order",
      args: { p_order_id: orderId, p_reason: INTERNAL_DELETE_REASON },
    },
    { name: "admin_delete_order", args: { p_order_id: orderId } },
  ];

  let lastError: unknown = null;

  for (const attempt of rpcAttempts) {
    const { data, error } = await supabase.rpc(attempt.name, attempt.args);
    if (error) {
      lastError = error;
      continue;
    }

    const result = normalizeRpcResult(data);
    if (result?.deleted) {
      return {
        deleted: true,
        reference: clean(result.reference || reference),
        source: "rpc",
      };
    }

    try {
      if (!(await orderStillExists(reference, order))) {
        return { deleted: true, reference, source: "rpc" };
      }
    } catch (verifyError) {
      lastError = verifyError;
    }
  }

  const direct = await deleteDirectly(reference, order);
  if (direct.result) return direct.result;
  if (direct.error) lastError = direct.error;

  console.error("DAY NIGHT admin order deletion failed", diagnostic(lastError));
  throw deletionError(lastError);
}
`;
write(`${appRoot}/src/lib/adminOrderDeleteData.ts`, deleteData);

const migration = `-- DAY NIGHT DELIVERY SERVICES
-- Final flexible admin order deletion runtime v2.
-- Operator input is never required; an internal audit reason is recorded automatically.

begin;

create extension if not exists pgcrypto;

create table if not exists public.admin_order_deletion_log (
  id uuid primary key default gen_random_uuid(),
  order_id text,
  order_reference text not null,
  merchant_id uuid,
  reason text not null default 'admin_one_click_delete',
  order_snapshot jsonb not null,
  deleted_by uuid references auth.users(id),
  deleted_at timestamptz not null default now()
);

alter table public.admin_order_deletion_log
  alter column reason set default 'admin_one_click_delete';
alter table public.admin_order_deletion_log enable row level security;

drop policy if exists admin_order_deletion_log_read on public.admin_order_deletion_log;
create policy admin_order_deletion_log_read
on public.admin_order_deletion_log
for select
to authenticated
using (public.is_admin_or_support());

revoke all on public.admin_order_deletion_log from public, anon;
grant select on public.admin_order_deletion_log to authenticated;

create or replace function public.admin_delete_order_flexible_v2(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  r public.orders;
  v_reference text := nullif(btrim(coalesce(
    p_payload ->> 'reference',
    p_payload ->> 'order_id',
    p_payload ->> 'tracking_number',
    p_payload ->> 'invoice_number',
    p_payload ->> 'coupon_number'
  )), '');
  v_reason text := coalesce(
    nullif(btrim(p_payload ->> 'audit_reason'), ''),
    nullif(btrim(p_payload ->> 'reason'), ''),
    'admin_one_click_delete'
  );
  v_snapshot jsonb;
  v_order_reference text;
  v_merchant_id uuid;
  v_fk record;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_admin_or_support() then
    raise exception 'not_authorized';
  end if;
  if v_reference is null then
    raise exception 'order_reference_required';
  end if;

  select o.* into r
  from public.orders o
  where to_jsonb(o) ->> 'id' = v_reference
     or to_jsonb(o) ->> 'tracking_number' = v_reference
     or to_jsonb(o) ->> 'invoice_number' = v_reference
     or to_jsonb(o) ->> 'coupon_number' = v_reference
  limit 1
  for update;

  if to_jsonb(r) ->> 'id' is null then
    raise exception 'order_not_found';
  end if;

  v_snapshot := to_jsonb(r);
  v_order_reference := coalesce(
    nullif(v_snapshot ->> 'tracking_number', ''),
    nullif(v_snapshot ->> 'invoice_number', ''),
    nullif(v_snapshot ->> 'coupon_number', ''),
    nullif(v_snapshot ->> 'id', ''),
    v_reference
  );

  begin
    v_merchant_id := nullif(v_snapshot ->> 'merchant_id', '')::uuid;
  exception when others then
    v_merchant_id := null;
  end;

  insert into public.admin_order_deletion_log (
    order_id,
    order_reference,
    merchant_id,
    reason,
    order_snapshot,
    deleted_by
  ) values (
    v_snapshot ->> 'id',
    v_order_reference,
    v_merchant_id,
    left(v_reason, 600),
    v_snapshot,
    auth.uid()
  );

  -- Resolve every direct, single-column foreign key to orders.id. Nullable links
  -- are detached and required dependent rows are removed in the same transaction.
  for v_fk in
    select
      child_ns.nspname as child_schema,
      child.relname as child_table,
      child_attr.attname as child_column,
      not child_attr.attnotnull as child_nullable
    from pg_constraint con
    join pg_class child on child.oid = con.conrelid
    join pg_namespace child_ns on child_ns.oid = child.relnamespace
    join lateral unnest(con.conkey) with ordinality child_key(attnum, ord) on true
    join lateral unnest(con.confkey) with ordinality parent_key(attnum, ord)
      on parent_key.ord = child_key.ord
    join pg_attribute child_attr
      on child_attr.attrelid = con.conrelid
     and child_attr.attnum = child_key.attnum
    join pg_attribute parent_attr
      on parent_attr.attrelid = con.confrelid
     and parent_attr.attnum = parent_key.attnum
    where con.contype = 'f'
      and con.confrelid = 'public.orders'::regclass
      and con.conrelid <> con.confrelid
      and array_length(con.conkey, 1) = 1
      and array_length(con.confkey, 1) = 1
      and parent_attr.attname = 'id'
  loop
    if v_fk.child_nullable then
      execute format(
        'update %I.%I set %I = null where %I = $1',
        v_fk.child_schema,
        v_fk.child_table,
        v_fk.child_column,
        v_fk.child_column
      ) using r.id;
    else
      execute format(
        'delete from %I.%I where %I = $1',
        v_fk.child_schema,
        v_fk.child_table,
        v_fk.child_column
      ) using r.id;
    end if;
  end loop;

  delete from public.orders where id = r.id;
  if not found then
    raise exception 'order_delete_failed';
  end if;

  return jsonb_build_object(
    'deleted', true,
    'reference', v_order_reference,
    'order_id', v_snapshot ->> 'id',
    'deleted_at', now(),
    'runtime_version', 2
  );
exception
  when others then
    raise exception using
      message = 'admin_delete_order_flexible_v2_failed: ' || sqlerrm,
      detail = 'SQLSTATE=' || sqlstate,
      hint = 'Authenticated admin/support is required; no operator-entered reason is required.';
end;
$$;

create or replace function public.admin_delete_order_runtime(p_payload jsonb)
returns jsonb
language sql
security definer
set search_path = public, auth, pg_temp
as $$
  select public.admin_delete_order_flexible_v2(p_payload);
$$;

create or replace function public.admin_delete_order_runtime(p_reference text)
returns jsonb
language sql
security definer
set search_path = public, auth, pg_temp
as $$
  select public.admin_delete_order_flexible_v2(jsonb_build_object('reference', p_reference));
$$;

create or replace function public.admin_delete_order(p_reference text)
returns jsonb
language sql
security definer
set search_path = public, auth, pg_temp
as $$
  select public.admin_delete_order_runtime(p_reference);
$$;

create or replace function public.admin_delete_order(p_order_id uuid)
returns jsonb
language sql
security definer
set search_path = public, auth, pg_temp
as $$
  select public.admin_delete_order_runtime(p_order_id::text);
$$;

revoke all on function public.admin_delete_order_flexible_v2(jsonb) from public, anon;
revoke all on function public.admin_delete_order_runtime(jsonb) from public, anon;
revoke all on function public.admin_delete_order_runtime(text) from public, anon;
revoke all on function public.admin_delete_order(text) from public, anon;
revoke all on function public.admin_delete_order(uuid) from public, anon;

grant execute on function public.admin_delete_order_flexible_v2(jsonb) to authenticated;
grant execute on function public.admin_delete_order_runtime(jsonb) to authenticated;
grant execute on function public.admin_delete_order_runtime(text) to authenticated;
grant execute on function public.admin_delete_order(text) to authenticated;
grant execute on function public.admin_delete_order(uuid) to authenticated;

create or replace function public.admin_delete_order_flexible_v2_health()
returns jsonb
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select jsonb_build_object(
    'ok',
      to_regprocedure('public.admin_delete_order_flexible_v2(jsonb)') is not null
      and to_regprocedure('public.admin_delete_order_runtime(jsonb)') is not null
      and to_regprocedure('public.admin_delete_order_runtime(text)') is not null,
    'runtime_version', 2,
    'reason_required', false,
    'status_restricted', false,
    'assignment_restricted', false,
    'is_admin_or_support', public.is_admin_or_support()
  );
$$;

revoke all on function public.admin_delete_order_flexible_v2_health() from public, anon;
grant execute on function public.admin_delete_order_flexible_v2_health() to authenticated;

notify pgrst, 'reload schema';
commit;
`;
write("supabase/migrations/20260804053000_admin_order_delete_flexible_v2.sql", migration);

const flexibilityGate = `import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.resolve(root, relative), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error("admin_order_delete_edit_flexibility_gate_failed: " + message);
};

const edit = read("src/components/admin/AdminOrderEditModalComplete.tsx");
const deleteModal = read("src/components/admin/AdminOrderDeleteModal.tsx");
const deleteData = read("src/lib/adminOrderDeleteData.ts");
const migration = read("../../supabase/migrations/20260804053000_admin_order_delete_flexible_v2.sql");

assert(edit.includes("automaticEditReason"), "automatic edit reason is missing");
assert(edit.includes('edit_reason: automaticEditReason'), "automatic reason is not persisted");
assert(edit.includes('data-admin-automatic-audit-reason="true"'), "automatic audit notice is missing");
assert(!edit.includes("const [editReason"), "manual edit reason state remains");
assert(!edit.includes("const [confirmed"), "manual confirmation state remains");
assert(!edit.includes('data-admin-complete-order-reason="true"'), "manual reason field remains");
assert(!edit.includes('data-admin-complete-order-confirm="true"'), "manual confirmation remains");

assert(deleteData.includes("INTERNAL_DELETE_REASON"), "internal delete audit reason is missing");
assert(deleteData.includes('name: "admin_delete_order_flexible_v2"'), "v2 delete RPC is not preferred");
assert(deleteData.includes("reason: INTERNAL_DELETE_REASON"), "legacy payload compatibility reason is missing");
assert(deleteData.includes("p_reference: reference, p_reason: INTERNAL_DELETE_REASON"), "legacy text reason signature is missing");
assert(deleteData.includes("throw deletionError(lastError)"), "exact deletion diagnostic is discarded");
assert(deleteModal.includes("await onDeleted?.(result.reference)"), "parent delete callback is not invoked");

assert(migration.includes("admin_delete_order_flexible_v2"), "flexible v2 migration RPC is missing");
assert(migration.includes("reason_required', false"), "migration does not declare reason-free deletion");
assert(migration.includes("status_restricted', false"), "migration does not declare status flexibility");
assert(migration.includes("assignment_restricted', false"), "migration does not declare assignment flexibility");
assert(!migration.includes("active_or_completed_order_cannot_be_deleted"), "legacy status block remains");
assert(!migration.includes("assigned_order_cannot_be_deleted"), "legacy assignment block remains");

console.log(JSON.stringify({
  result: "PASS",
  automaticEditAudit: true,
  manualReasonRemoved: true,
  manualConfirmationRemoved: true,
  backwardCompatibleDeleteReason: true,
  exactDeleteDiagnostics: true,
  anyStatusDeleteRuntime: true,
  assignedOrderDeleteRuntime: true
}, null, 2));
`;
write(`${appRoot}/scripts/admin-order-delete-edit-flexibility-gate.mjs`, flexibilityGate);

const completeGatePath = `${appRoot}/scripts/admin-complete-order-edit-gate.mjs`;
let completeGate = read(completeGatePath);
completeGate = replaceRequired(
  completeGate,
  `assert(
  modal.includes('data-admin-complete-order-reason="true"'),
  "required audit reason control missing",
);
assert(
  modal.includes('data-admin-complete-order-confirm="true"'),
  "explicit impact confirmation missing",
);
`,
  `assert(
  modal.includes("automaticEditReason") &&
    modal.includes('edit_reason: automaticEditReason') &&
    modal.includes('data-admin-automatic-audit-reason="true"'),
  "automatic audited edit reason is missing",
);
assert(
  !modal.includes('data-admin-complete-order-reason="true"') &&
    !modal.includes('data-admin-complete-order-confirm="true"'),
  "manual reason or impact confirmation still burdens the operator",
);
`,
  "update complete edit gate for automatic reason",
);
write(completeGatePath, completeGate);

const packagePath = `${appRoot}/package.json`;
const packageJson = JSON.parse(read(packagePath));
packageJson.scripts["admin-order-delete-edit-flexibility:gate"] =
  "node scripts/admin-order-delete-edit-flexibility-gate.mjs";
const gateCommand = "node scripts/admin-order-delete-edit-flexibility-gate.mjs";
if (!packageJson.scripts["production:gate"].includes(gateCommand)) {
  packageJson.scripts["production:gate"] += " && " + gateCommand;
}
write(packagePath, JSON.stringify(packageJson, null, 2));

console.log(JSON.stringify({
  result: "PATCHED",
  automaticEditReason: true,
  oneClickDeleteCompatibility: true,
  flexibleDeleteMigration: true,
  exactDiagnostics: true
}, null, 2));
