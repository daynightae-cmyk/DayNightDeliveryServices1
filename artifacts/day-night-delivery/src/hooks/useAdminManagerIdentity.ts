import { useEffect } from "react";
import { ADMIN_IDENTITY, adminIdentityName, adminIdentityRole } from "../config/adminIdentity";

function setImage(image: HTMLImageElement, alt: string) {
  if (image.getAttribute("src") !== ADMIN_IDENTITY.logoUrl) image.src = ADMIN_IDENTITY.logoUrl;
  image.alt = alt;
  image.loading = "eager";
  image.decoding = "async";
  image.classList.add("dn-admin-manager-identity-image");
}

function managerCopy(element: Element) {
  const value = element.textContent?.replace(/\s+/g, " ").trim().toLowerCase() || "";
  return value.includes("مدير") || value.includes("manager");
}

function replaceAvatar(container: Element, alt: string) {
  let image = container.querySelector<HTMLImageElement>("img");
  if (!image) {
    container.textContent = "";
    image = document.createElement("img");
    container.appendChild(image);
  }
  setImage(image, alt);
}

function applyShellIdentity(isArabic: boolean) {
  const name = adminIdentityName(isArabic);
  const role = adminIdentityRole(isArabic);
  const alt = `${name} — ${role}`;

  document
    .querySelectorAll<HTMLImageElement>(
      ".dncc-brand img, .dn-admin-fullscreen [class*='brand'] img, .dn-admin-fullscreen [class*='logo'] img",
    )
    .forEach((image) => setImage(image, alt));

  document.querySelectorAll<HTMLElement>(".dncc-operator").forEach((operator) => {
    const avatar = operator.querySelector<HTMLElement>(".dncc-operator-avatar");
    if (avatar) replaceAvatar(avatar, alt);

    const copy = operator.querySelector<HTMLElement>(":scope > div");
    const nameNode = copy?.querySelector<HTMLElement>("strong");
    const roleNode = copy?.querySelector<HTMLElement>("span");
    if (nameNode && nameNode.textContent !== name) nameNode.textContent = name;
    if (roleNode && roleNode.textContent !== role) roleNode.textContent = role;
  });

  document.querySelectorAll<HTMLElement>(".dn-admin-user-head").forEach((profile) => {
    const image = profile.querySelector<HTMLImageElement>("img");
    const nameNode = profile.querySelector<HTMLElement>("strong");
    const roleNode = profile.querySelector<HTMLElement>("span");
    if (image) setImage(image, alt);
    if (nameNode && nameNode.textContent !== name) nameNode.textContent = name;
    if (roleNode && roleNode.textContent !== role) roleNode.textContent = role;
    profile.dataset.dnManagerIdentity = "true";
  });

  document.querySelectorAll<HTMLElement>("[data-admin-manager-profile]").forEach((profile) => {
    const avatar = profile.querySelector<HTMLElement>("[data-admin-manager-avatar]");
    if (avatar) replaceAvatar(avatar, alt);
    const nameNode = profile.querySelector<HTMLElement>("[data-admin-manager-name]");
    const roleNode = profile.querySelector<HTMLElement>("[data-admin-manager-role]");
    if (nameNode && nameNode.textContent !== name) nameNode.textContent = name;
    if (roleNode && roleNode.textContent !== role) roleNode.textContent = role;
  });
}

function applyManagerEmployeeCards(isArabic: boolean) {
  const root = document.querySelector<HTMLElement>(".dn-employee-hr-embedded-root");
  if (!root) return;

  const name = adminIdentityName(isArabic);
  const role = adminIdentityRole(isArabic);
  const alt = `${name} — ${role}`;

  root.querySelectorAll<HTMLElement>("article").forEach((card) => {
    const roleLine = Array.from(card.querySelectorAll("p")).find(managerCopy);
    if (!roleLine) return;

    const heading = card.querySelector<HTMLElement>("h3");
    if (heading && heading.textContent !== name) heading.textContent = name;

    const avatar = Array.from(card.querySelectorAll<HTMLElement>("span")).find((span) =>
      span.className.includes("h-14") && span.className.includes("w-14"),
    );
    if (avatar) replaceAvatar(avatar, alt);
    card.dataset.dnManagerIdentity = "true";
  });

  root.querySelectorAll<HTMLElement>("header").forEach((header) => {
    const roleLine = Array.from(header.querySelectorAll("p")).find(managerCopy);
    if (!roleLine) return;

    const heading = header.querySelector<HTMLElement>("h2");
    if (heading && heading.textContent !== name) heading.textContent = name;

    const avatar = Array.from(header.querySelectorAll<HTMLElement>("span")).find((span) =>
      span.className.includes("h-16") && span.className.includes("w-16"),
    );
    if (avatar) replaceAvatar(avatar, alt);
    header.dataset.dnManagerIdentity = "true";
  });
}

export function useAdminManagerIdentity(enabled: boolean, isArabic: boolean) {
  useEffect(() => {
    if (!enabled) return;

    let frame = 0;
    const apply = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        applyShellIdentity(isArabic);
        applyManagerEmployeeCards(isArabic);
      });
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [enabled, isArabic]);
}
