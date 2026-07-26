type MerchantPrefillCredentials = {
  email: string;
  password: string;
};

const SESSION_KEY = "dn_merchant_prefill_v1";

function isMerchantRoute() {
  return typeof window !== "undefined" && /^\/merchant(?:\/|$)/i.test(window.location.pathname);
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return decodeURIComponent(
    Array.prototype.map
      .call(atob(padded), (character: string) => `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`)
      .join(""),
  );
}

function normalizeCredentials(value: unknown): MerchantPrefillCredentials | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const email = String(record.email || "").trim().toLowerCase();
  const password = String(record.password || "");
  if (!email || !password || !email.includes("@")) return null;
  return { email, password };
}

function readCredentialsFromLocation(): MerchantPrefillCredentials | null {
  if (!isMerchantRoute()) return null;

  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  const token = hashParams.get("dn_login") || url.searchParams.get("dn_login") || "";

  let credentials: MerchantPrefillCredentials | null = null;

  if (token) {
    try {
      credentials = normalizeCredentials(JSON.parse(decodeBase64Url(token)));
    } catch (_) {
      credentials = null;
    }
  }

  if (!credentials) {
    credentials = normalizeCredentials({
      email: hashParams.get("email") || url.searchParams.get("email"),
      password: hashParams.get("password") || url.searchParams.get("password"),
    });
  }

  if (!credentials) return null;

  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(credentials));
  } catch (_) {}

  // Remove credentials immediately from the visible URL and browser history entry.
  url.searchParams.delete("dn_login");
  url.searchParams.delete("email");
  url.searchParams.delete("password");
  url.hash = "";
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);

  return credentials;
}

function readCredentialsFromSession(): MerchantPrefillCredentials | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    return raw ? normalizeCredentials(JSON.parse(raw)) : null;
  } catch (_) {
    return null;
  }
}

function setReactInputValue(input: HTMLInputElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (nativeSetter) nativeSetter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function fillMerchantLogin(credentials: MerchantPrefillCredentials) {
  const loginRoot = document.querySelector<HTMLElement>(".dn-merchant-login-v3");
  if (!loginRoot) return false;

  const emailInput = loginRoot.querySelector<HTMLInputElement>('input[type="email"]');
  const passwordInput = loginRoot.querySelector<HTMLInputElement>('input[type="password"]');
  if (!emailInput || !passwordInput) return false;

  setReactInputValue(emailInput, credentials.email);
  setReactInputValue(passwordInput, credentials.password);
  emailInput.setAttribute("data-dn-autofilled", "true");
  passwordInput.setAttribute("data-dn-autofilled", "true");
  passwordInput.focus({ preventScroll: true });

  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch (_) {}

  return true;
}

export function installMerchantCredentialAutofill() {
  if (!isMerchantRoute()) return;

  const credentials = readCredentialsFromLocation() || readCredentialsFromSession();
  if (!credentials) return;

  if (fillMerchantLogin(credentials)) return;

  const observer = new MutationObserver(() => {
    if (!fillMerchantLogin(credentials)) return;
    observer.disconnect();
  });

  const root = document.getElementById("root") || document.body;
  observer.observe(root, { childList: true, subtree: true });

  window.setTimeout(() => observer.disconnect(), 15000);
}
