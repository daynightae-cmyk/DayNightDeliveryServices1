from pathlib import Path

root = Path(__file__).resolve().parents[2]
path = root / ".github/scripts/personal-order-unified-browser-save.mjs"
source = path.read_text(encoding="utf-8")

old = '''  await page.locator('[data-admin-personal-order-save="true"]').click();
  await page.getByText(/تم إنشاء الطلب الشخصي|Personal order .* was created/).waitFor({ state: 'visible', timeout: 90000 });

  const saved = await waitForSavedOrder();
'''
new = '''  await page.locator('[data-admin-personal-order-save="true"]').click();
  const saved = await waitForSavedOrder();
  const successMessageVisible = await page
    .getByText(/تم إنشاء الطلب الشخصي|Personal order .* was created/)
    .isVisible()
    .catch(() => false);
  await page.screenshot({ path: path.join(evidenceDir, 'personal-order-after-save.png'), fullPage: true });
'''
if source.count(old) != 1:
    raise SystemExit(f"save assertion patch expected 1 match, found {source.count(old)}")
source = source.replace(old, new, 1)

old = "let browser;\nlet adminClient;\n"
new = "let browser;\nlet adminClient;\nlet page;\n"
if source.count(old) != 1:
    raise SystemExit("page declaration patch missing")
source = source.replace(old, new, 1)

old = "  const page = await context.newPage();\n"
new = "  page = await context.newPage();\n"
if source.count(old) != 1:
    raise SystemExit("page assignment patch missing")
source = source.replace(old, new, 1)

old = "      visible_in_all_orders: true,\n      standalone_personal_menu_removed: true,\n"
new = "      visible_in_all_orders: true,\n      success_message_visible: successMessageVisible,\n      standalone_personal_menu_removed: true,\n"
if source.count(old) != 1:
    raise SystemExit("result metadata patch missing")
source = source.replace(old, new, 1)

old = "} catch (error) {\n  fs.writeFileSync(path.join(evidenceDir, 'failure.txt'), String(error?.stack || error));\n"
new = "} catch (error) {\n  if (page) {\n    await page.screenshot({ path: path.join(evidenceDir, 'personal-order-failure.png'), fullPage: true }).catch(() => {});\n    const body = await page.locator('body').innerText().catch(() => 'body unavailable');\n    fs.writeFileSync(path.join(evidenceDir, 'failure-body.txt'), body);\n  }\n  fs.writeFileSync(path.join(evidenceDir, 'failure.txt'), String(error?.stack || error));\n"
if source.count(old) != 1:
    raise SystemExit("failure evidence patch missing")
source = source.replace(old, new, 1)

path.write_text(source, encoding="utf-8")
print("PASS personal-order browser acceptance now verifies database save before transient UI message")
