from pathlib import Path

root = Path(__file__).resolve().parents[2]


def patch(path_str: str, old: str, new: str, label: str) -> None:
    path = root / path_str
    source = path.read_text(encoding="utf-8")
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    path.write_text(source.replace(old, new, 1), encoding="utf-8")
    print(f"PASS {label}")


patch(
    "artifacts/day-night-delivery/src/lib/orderFinancials.ts",
    '''export function financialsFromOrder(
  order: Partial<Order> & Record<string, unknown>,
): OrderFinancialBreakdown {
  const deliveryFee = financialNumber(
''',
    '''export function financialsFromOrder(
  order: Partial<Order> & Record<string, unknown>,
): OrderFinancialBreakdown {
  const isPersonalOrder =
    String(order.source_channel ?? "").trim().toLowerCase() === "admin_personal_order" &&
    !String(order.merchant_id ?? "").trim();

  if (isPersonalOrder) {
    const goodsValue = roundMoney(Math.max(0, financialNumber(
      order.goods_value ?? order.product_value ?? order.merchant_goods_value,
      0,
    )));
    const deliveryFee = roundMoney(Math.max(0, financialNumber(
      order.delivery_fee ??
        order.delivery_price ??
        order.manual_delivery_price ??
        order.base_price,
      25,
    )));
    const discountAmount = roundMoney(Math.max(0, financialNumber(
      order.discount_amount ?? order.discount,
      0,
    )));
    const calculatedCustomerTotal = roundMoney(
      Math.max(0, goodsValue + deliveryFee - discountAmount),
    );

    return {
      goodsValue,
      deliveryFee,
      discountAmount,
      deliveryFeeMode: "customer_pays",
      customerTotal: roundMoney(Math.max(0, financialNumber(
        order.customer_total ?? order.total ?? order.total_price,
        calculatedCustomerTotal,
      ))),
      merchantDue: 0,
      companyRevenue: roundMoney(Math.max(0, financialNumber(
        order.company_revenue,
        deliveryFee,
      ))),
    };
  }

  const deliveryFee = financialNumber(
''',
    "personal orders use authoritative no-merchant financial display",
)

patch(
    ".github/scripts/personal-order-unified-browser-save.mjs",
    '''  const list = page.locator('.dn-admin-bulk-selector-list');
  await list.waitFor({ state: 'visible', timeout: 90000 });
  let listText = '';
  for (let attempt = 0; attempt < 60; attempt += 1) {
    listText = await list.innerText().catch(() => '');
    if (listText.includes(coupon)) break;
    await page.waitForTimeout(500);
  }
  assert(listText.includes(coupon), 'saved_personal_order_not_visible_in_all_orders');
  assert(listText.includes(senderName), 'saved_personal_order_sender_not_visible_in_all_orders');
  await page.screenshot({ path: path.join(evidenceDir, 'personal-order-visible-in-all-orders.png'), fullPage: true });
''',
    '''  const list = page.locator('.dn-admin-bulk-selector-list');
  await list.waitFor({ state: 'visible', timeout: 90000 });
  const orderRow = page.locator('tr').filter({ hasText: coupon }).first();
  await orderRow.waitFor({ state: 'visible', timeout: 90000 });
  const rowText = await orderRow.innerText();
  assert(rowText.includes(coupon), 'saved_personal_order_not_visible_in_all_orders');
  assert(rowText.includes(senderName), 'saved_personal_order_sender_not_visible_in_all_orders');
  assert(/مستحق التاجر\\s*0\\.00|Merchant due\\s*0\\.00/i.test(rowText), 'personal_order_ui_merchant_due_is_not_zero');
  assert(!/مستحق التاجر\\s*125\\.00|Merchant due\\s*125\\.00/i.test(rowText), 'personal_order_goods_leaked_into_merchant_due');
  await page.screenshot({ path: path.join(evidenceDir, 'personal-order-visible-in-all-orders.png'), fullPage: true });
''',
    "browser acceptance verifies the actual All Orders table row",
)

patch(
    "artifacts/day-night-delivery/scripts/personal-orders-admin-gate.mjs",
    '''const operations = read("src/lib/personalOrderOperations.ts");
''',
    '''const orderFinancials = read("src/lib/orderFinancials.ts");
expect(orderFinancials, /source_channel.*admin_personal_order/s, "personal financial display detects true personal orders");
expect(orderFinancials, /merchantDue: 0/, "personal financial display never creates merchant due");
const operations = read("src/lib/personalOrderOperations.ts");
''',
    "source gate protects personal financial isolation",
)

print("All final personal-order UI acceptance patches completed.")
