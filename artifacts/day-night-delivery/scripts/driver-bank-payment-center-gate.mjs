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
const customerPayment = read("src/components/tracking/CustomerPaymentActions.tsx");
const tracking = read("src/components/Tracking.tsx");
const driverMessages = read("src/services/driverActionMessageService.ts");
const driverUi = read("src/components/driver/DriverCustomerCommunication.tsx");
const notFound = read("src/components/NotFound.tsx");
const footer = read("src/components/Footer.tsx");
const vercelConfig = read("vercel.json");

expect(bankConfig, /id:\s*"adib"[\s\S]*AE450500000000028787988[\s\S]*ABDIAEADXXX/, "ADIB account contract is present");
expect(bankConfig, /id:\s*"adcb"[\s\S]*AE250030013496442920001[\s\S]*ADCBAEAA/, "ADCB account contract is present");
expect(bankConfig, /buildCustomerPaymentUrl/, "unified customer payment link builder exists");
expect(bankConfig, /buildCashConfirmationWhatsAppUrl/, "cash confirmation WhatsApp link exists");
expect(bankConfig, /buildTransferProofWhatsAppUrl/, "transfer receipt WhatsApp link exists");

expect(driverMessages, /case\s+"driver_on_the_way"/, "on-the-way has an independent message");
expect(driverMessages, /case\s+"driver_request_location"/, "request-location has an independent message");
expect(driverMessages, /case\s+"driver_arrived"/, "arrived has an independent message");
expect(driverMessages, /case\s+"driver_unreachable"/, "unreachable has an independent message");
expect(driverMessages, /case\s+"driver_delivered_feedback"/, "delivered-feedback has an independent message");
expect(driverMessages, /prepareDeterministicDriverWhatsApp/, "deterministic driver message runtime exists");
expect(driverMessages, /buildCustomerPaymentUrl[\s\S]*paymentOptionsBlock/, "every driver message receives the customer payment options link");
expect(driverMessages, /اختر طريقة الدفع — كاش أو أونلاين|Choose cash or online payment/, "driver messages explicitly offer both payment methods");

expect(driverUi, /prepareDeterministicDriverWhatsApp/, "driver UI bypasses stale shared template bodies");
expect(driverUi, /value="cash"[\s\S]*value="online"/, "driver can select cash or online payment");
expect(driverUi, /value="adib"[\s\S]*value="adcb"/, "driver can select either company bank account");
expect(driverUi, /MESSAGE_ACTIONS\.map/, "all message actions remain available");

expect(customerPayment, /setMode\("cash"\)/, "customer can choose cash on delivery");
expect(customerPayment, /setMode\("online"\)/, "customer can choose online payment");
expect(customerPayment, /DAY_NIGHT_BANK_ACCOUNTS\.map/, "customer can choose ADIB or ADCB");
expect(customerPayment, /buildCashConfirmationWhatsAppUrl/, "customer cash choice has a ready confirmation message");
expect(customerPayment, /buildCustomerPaymentUrl/, "customer online choice opens the secure payment center");
expect(tracking, /CustomerPaymentActions/, "tracking page permanently mounts customer payment actions");
expect(tracking, /orderPayableAmount/, "tracking uses the recorded order amount");

expect(paymentCenter, /مركز دفع الشحنات الآمن|Secure shipment payment center/, "public premium payment center is present");
expect(paymentCenter, /setMode\("cash"\)[\s\S]*setMode\("online"\)/, "payment center exposes cash and online buttons");
expect(paymentCenter, /نسخ الآيبان|Copy IBAN/, "IBAN copy action is present");
expect(paymentCenter, /إرسال إيصال التحويل|Send transfer receipt/, "receipt sharing action is present");
expect(paymentCenter, /تأكيد الدفع كاش عبر واتساب|Confirm cash payment on WhatsApp/, "cash confirmation action is present");
expect(paymentCenter, /لا يقوم الموقع بتنفيذ التحويل|does not execute the transfer/, "payment center states the secure handoff boundary");

expect(notFound, /pathname === "\/payment"[\s\S]*BankTransferCenter/, "payment route resolves to the payment center");
expect(notFound, /pathname === "\/bank-transfer"/, "bank-transfer alias resolves");
expect(footer, /الدفع والتحويل البنكي|Bank Transfer & Payment/, "payment center is linked site-wide");
expect(footer, /path:\s*"\/payment"/, "footer points to the live payment route");
expect(vercelConfig, /https:\/\/www\.adib\.ae/, "CSP allows the official ADIB logo");
expect(vercelConfig, /https:\/\/www\.adcb\.com/, "CSP allows the official ADCB logo");

if (failed) {
  console.error("DAY NIGHT driver messages and customer payment gate FAILED");
  process.exit(1);
}

console.log("DAY NIGHT driver messages and customer payment gate PASSED");
