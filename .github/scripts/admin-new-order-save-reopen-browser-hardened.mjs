import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const sourcePath = path.resolve('.github/scripts/admin-new-order-save-reopen-browser.mjs');
const temporaryPath = path.resolve(
  `.github/scripts/.admin-new-order-save-reopen-${process.pid}.mjs`,
);

let source = fs.readFileSync(sourcePath, 'utf8');

function replaceRequired(pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`save_reopen_patch_missing_${label}`);
  source = next;
}

replaceRequired(
  `    await form.locator('[data-admin-next-order-focus="true"]').fill(testCoupon);
    const textInputs = form.locator('input:not([type="number"])');
    await textInputs.nth(1).fill('DAY NIGHT FINANCIAL TEST');
    await textInputs.nth(2).fill('0500000000');`,
  [
    `    const couponInput = form.locator('[data-admin-next-order-focus="true"]');`,
    `    const receiverNameInput = form.getByPlaceholder(/اسم العميل|Customer name/).first();`,
    `    const receiverPhoneInput = form.getByPlaceholder(/رقم تليفون العميل|Customer phone/).first();`,
    `    await couponInput.fill(testCoupon);`,
    `    await receiverNameInput.fill('DAY NIGHT FINANCIAL TEST');`,
    `    await receiverPhoneInput.fill('0500000000');`,
    `    assert((await couponInput.inputValue()) === testCoupon, 'coupon_dom_value_mismatch');`,
    `    assert((await receiverNameInput.inputValue()) === 'DAY NIGHT FINANCIAL TEST', 'receiver_name_dom_value_mismatch');`,
    `    assert((await receiverPhoneInput.inputValue()) === '0500000000', 'receiver_phone_dom_value_mismatch');`,
  ].join('\n'),
  'field_ownership',
);

replaceRequired(
  `    await form
      .getByRole('button', { name: /حفظ وبدء طلب جديد|Save and start next order/ })
      .click();

    createdOrder = await waitForSavedOrder(serviceClient);`,
  [
    `    const validity = await form.evaluate((node) => ({`,
    `      valid: node.checkValidity(),`,
    `      invalid: [...node.querySelectorAll(':invalid')].map((element) => ({`,
    `        tag: element.tagName,`,
    `        type: element.getAttribute('type') || '',`,
    `        name: element.getAttribute('name') || '',`,
    `        placeholder: element.getAttribute('placeholder') || '',`,
    `        value: 'value' in element ? String(element.value || '') : '',`,
    `        validationMessage: 'validationMessage' in element ? String(element.validationMessage || '') : '',`,
    `      })),`,
    `    }));`,
    `    fs.writeFileSync(`,
    `      evidenceDirectory + '/financial-save-form-validity.json',`,
    `      JSON.stringify(validity, null, 2),`,
    `    );`,
    `    assert(validity.valid, 'save_form_invalid:' + JSON.stringify(validity.invalid));`,
    ``,
    `    const submissionTrace = { submitEvents: 0, console: [], responses: [], requestFailures: [] };`,
    `    page.on('console', (message) => {`,
    `      const text = message.text();`,
    `      if (/DAY NIGHT order creation rejected|admin_create_order|financial|order/i.test(text)) {`,
    `        submissionTrace.console.push({ type: message.type(), text: text.slice(0, 4000) });`,
    `      }`,
    `    });`,
    `    page.on('requestfailed', (request) => {`,
    `      if (request.url().startsWith(supabaseUrl)) {`,
    `        submissionTrace.requestFailures.push({`,
    `          method: request.method(),`,
    `          url: request.url(),`,
    `          error: request.failure()?.errorText || '',`,
    `        });`,
    `      }`,
    `    });`,
    `    page.on('response', async (response) => {`,
    `      if (!response.url().startsWith(supabaseUrl)) return;`,
    `      let body = '';`,
    `      try {`,
    `        body = (await response.text()).slice(0, 8000);`,
    `      } catch {}`,
    `      submissionTrace.responses.push({`,
    `        method: response.request().method(),`,
    `        url: response.url(),`,
    `        status: response.status(),`,
    `        body,`,
    `      });`,
    `    });`,
    ``,
    `    await form.evaluate((node) => {`,
    `      node.dataset.dnSaveSubmitEvents = '0';`,
    `      node.addEventListener(`,
    `        'submit',`,
    `        () => {`,
    `          node.dataset.dnSaveSubmitEvents = String(`,
    `            Number(node.dataset.dnSaveSubmitEvents || '0') + 1,`,
    `          );`,
    `        },`,
    `        { once: true, capture: true },`,
    `      );`,
    `    });`,
    ``,
    `    const submitButton = form.locator('button[type="submit"]');`,
    `    await submitButton.waitFor({ state: 'visible', timeout: 10000 });`,
    `    assert(!(await submitButton.isDisabled()), 'save_submit_button_disabled');`,
    `    await submitButton.click();`,
    `    await page.waitForFunction(`,
    `      () => document.querySelector('[data-admin-new-order-form="merchant"]')?.getAttribute('data-dn-save-submit-events') === '1',`,
    `      undefined,`,
    `      { timeout: 10000 },`,
    `    );`,
    `    submissionTrace.submitEvents = Number(`,
    `      (await form.getAttribute('data-dn-save-submit-events')) || '0',`,
    `    );`,
    ``,
    `    const uiError = form.locator('div.border-rose-400').first();`,
    `    const savedOrderPromise = waitForSavedOrder(serviceClient);`,
    `    const uiErrorPromise = uiError`,
    `      .waitFor({ state: 'visible', timeout: 65000 })`,
    `      .then(async () => {`,
    `        throw new Error('ui_save_error:' + (await uiError.innerText()).trim());`,
    `      });`,
    ``,
    `    try {`,
    `      createdOrder = await Promise.race([savedOrderPromise, uiErrorPromise]);`,
    `    } finally {`,
    `      await page.waitForTimeout(500);`,
    `      fs.writeFileSync(`,
    `        evidenceDirectory + '/financial-save-submission-trace.json',`,
    `        JSON.stringify(submissionTrace, null, 2),`,
    `      );`,
    `    }`,
  ].join('\n'),
  'submission_trace',
);

fs.writeFileSync(temporaryPath, source, 'utf8');
try {
  await import(`${pathToFileURL(temporaryPath).href}?run=${Date.now()}`);
} finally {
  fs.rmSync(temporaryPath, { force: true });
}
