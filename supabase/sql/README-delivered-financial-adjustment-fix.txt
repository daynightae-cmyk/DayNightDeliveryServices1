Run the complete file:

supabase/sql/20260728233000_admin_delivered_financial_adjustment_FIXED.sql

The original parser failure was caused by an unparenthesized CASE expression inside a PL/pgSQL IF comparison. The corrected migration uses:

if v_discount > (
  case
    when v_mode = 'customer_pays' then v_goods + v_delivery
    else v_goods
  end
) then

Do not run db reset.
