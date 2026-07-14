create or replace function public.admin_normalize_order_status(p_status text)
returns text
language plpgsql
immutable
as $$
declare
  v text := lower(trim(coalesce(p_status, '')));
begin
  v := replace(replace(v, '-', '_'), ' ', '_');
  if v = '' then return 'pending'; end if;
  if v in ('pending','new','order_pending','waiting','قيد_الانتظار','جديد','طلب_جديد') then return 'pending'; end if;
  if v in ('review','under_review','needs_review','manual_review','manual_approval','hold','قيد_المراجعة','مراجعة','تحت_المراجعة') then return 'review'; end if;
  if v in ('confirmed','accepted','approved','تم_التأكيد','تم_التاكيد','مؤكد') then return 'confirmed'; end if;
  if v in ('assigned','driver_assigned','assign','معين','تم_تعيين_مندوب','تعيين_مندوب') then return 'assigned'; end if;
  if v in ('picked_up','pickup','collecting','collected','collect','قيد_الإحضار','قيد_الاحضار','تم_الإحضار','تم_الاحضار') then return 'picked_up'; end if;
  if v in ('in_transit','out_for_delivery','on_route','on_the_way','transit','في_الطريق','جاري_التوصيل') then return 'in_transit'; end if;
  if v in ('delivered','completed','complete','order_delivered','تم_التسليم','مسلم') then return 'delivered'; end if;
  if v in ('postponed','postpone','deferred','scheduled','later','مؤجل','مؤجلة','تأجيل','تاجيل') then return 'postponed'; end if;
  if v in ('returned','return','return_to_merchant','راجع','راجعة','مرتجع','مرتجعة') then return 'returned'; end if;
  if v in ('cancelled','canceled','cancel','failed','order_cancelled','ملغي','ملغية','مكنسل','كنسل','إلغاء','الغاء') then return 'cancelled'; end if;
  if v in ('international','gcc','worldwide','global','دولي','خليجي','عالمي') then return 'international'; end if;
  if v in ('out_of_zone','out_of_scope','unsupported','خارج_النطاق') then return 'out_of_zone'; end if;
  return v;
end;
$$;

create or replace function public.admin_update_order_status(
  p_order_id text,
  p_status text,
  p_note text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := public.admin_normalize_order_status(p_status);
  v_order public.orders%rowtype;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if v_status not in ('pending','review','confirmed','assigned','picked_up','in_transit','delivered','postponed','returned','cancelled','out_of_zone','international') then
    raise exception 'Unsupported order status: %', p_status using errcode = '22023';
  end if;

  update public.orders
     set status = v_status,
         updated_at = now()
   where id::text = p_order_id
      or tracking_number = p_order_id
      or invoice_number = p_order_id
      or coupon_number = p_order_id
   returning * into v_order;

  if not found then
    raise exception 'Order not found: %', p_order_id using errcode = 'P0002';
  end if;

  if to_regclass('public.order_status_history') is not null then
    insert into public.order_status_history(order_id, status, note, created_at)
    values (v_order.id, v_status, coalesce(v_note, 'Admin status update'), now());
  end if;

  if to_regclass('public.admin_audit_events') is not null then
    insert into public.admin_audit_events(event_type, entity_type, entity_id, payload, created_at)
    values ('order_status_updated', 'order', v_order.id::text, jsonb_build_object('status', v_status, 'note', v_note), now());
  end if;

  return v_order;
end;
$$;

grant execute on function public.admin_normalize_order_status(text) to authenticated;
grant execute on function public.admin_update_order_status(text, text, text) to authenticated;
