import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
let failed = false;

function read(relative) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) {
    console.error(`FAIL missing ${relative}`);
    failed = true;
    return "";
  }
  console.log(`PASS ${relative}`);
  return fs.readFileSync(file, "utf8");
}

function expect(content, pattern, label) {
  if (!pattern.test(content)) {
    console.error(`FAIL ${label}`);
    failed = true;
  } else {
    console.log(`PASS ${label}`);
  }
}

const bankConfig = read("src/config/bankTransfer.ts");
const paymentCenter = read("src/components/BankTransferCenter.tsx");
const driverMessages = read("src/services/driverActionMessageService.ts");
const driverUi = read("src/components/driver/DriverCustomerCommunication.tsx");
const notFound = read("src/components/NotFound.tsx");
const footer = read("src/components/Footer.tsx");

expect(bankConfig, /id:\s*"adib"[\s\S]*AE450500000000028787988[\s\S]*ABDIAEADXXX/, "ADIB account contract is present");
expect(bankConfig, /id:\s*"adcb"[\s\S]*AE250030013496442920001[\s\S]*ADCBAEAA/, "ADCB account contract is present");
expect(bankConfig, /www\.adib\.ae[\s\S]*logo\.svg/, "ADIB official logo is configured");
expect(bankConfig, /www\.adcb\.com[\s\S]*ADCB_Master/, "ADCB official logo is configured");
expect(bankConfig, /buildBankTransferUrl/, "customer payment link builder exists");
expect(bankConfig, /buildTransferProofWhatsAppUrl/, "transfer receipt WhatsApp link exists");

expect(driverMessages, /case\s+"driver_on_the_way"/, "on-the-way has an independent message");
expect(driverMessages, /case\s+"driver_request_location"/, "request-location has an independent message");
expect(driverMessages, /case\s+"driver_arrived"/, "arrived has an independent message");
expect(driverMessages, /case\s+"driver_unreachable"/, "unreachable has an independent message");
expect(driverMessages, /case\s+"driver_delivered_feedback"/, "delivered-feedback has an independent message");
expect(driverMessages, /prepareDeterministicDriverWhatsApp/, "deterministic driver message runtime exists");
expect(driverMessages, /paymentMode[\s\S]*preferredBank[\s\S]*buildBankTransferUrl/, "messages are payment and bank aware");
expect(driverMessages, /كاش عند الاستلام|prepare the cash amount/, "cash instructions are explicit");
expect(driverMessages, /التحويل الأونلاين|online bank transfer/, "online transfer instructions are explicit");

expect(driverUi, /prepareDeterministicDriverWhatsApp/, "driver UI bypasses stale shared template bodies");
expect(driverUi, /value="cash"[\s\S]*value="online"/, "driver can select cash or online payment");
expect(driverUi, /value="adib"[\s\S]*value="adcb"/, "driver can select either company bank account");
expect(driverUi, /MESSAGE_ACTIONS\.map/, "all message actions remain available");

expect(paymentCenter, /مركز التحويل البنكي الآمن|Secure bank transfer center/, "public premium payment center is present");
expect(paymentCenter, /نسخ الآيبان|Copy IBAN/, "IBAN copy action is present");
expect(paymentCenter, /إرسال إيصال التحويل|Send transfer receipt/, "receipt sharing action is present");
expect(paymentCenter, /لا يقوم الموقع بتنفيذ التحويل|does not execute the transfer/, "payment center states the secure handoff boundary");

expect(notFound, /pathname === "\/payment"[\s\S]*BankTransferCenter/, "payment route resolves to the payment center");
expect(notFound, /pathname === "\/bank-transfer"/, "bank-transfer alias resolves");
expect(footer, /الدفع والتحويل البنكي|Bank Transfer & Payment/, "bank payment center is linked site-wide");
expect(footer, /path:\s*"\/payment"/, "footer points to the live payment route");

if (failed) {
  console.error("DAY NIGHT driver messages and bank payment gate FAILED");
  process.exit(1);
}

console.log("DAY NIGHT driver messages and bank payment gate PASSED");
