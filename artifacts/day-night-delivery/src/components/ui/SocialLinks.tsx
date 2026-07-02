import type { ElementType } from "react";
import { Facebook, Instagram, Linkedin, Youtube } from "lucide-react";
import companyMeta from "../../data/companyMeta";

type SocialIconProps = { className?: string };

function TikTokIcon({ className }: SocialIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

function ThreadsIcon({ className }: SocialIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12.15 21.5c-5.18 0-9.05-3.62-9.05-9.5 0-5.88 3.87-9.5 9.05-9.5 4.17 0 7.21 2.28 8.35 6.03l-2.63.72c-.82-2.72-2.9-4.16-5.72-4.16-3.7 0-6.16 2.58-6.16 6.91 0 4.33 2.46 6.91 6.16 6.91 3.28 0 5.57-1.84 5.57-4.5 0-1.03-.36-1.9-1.02-2.57-.78 2.64-2.85 4.23-5.49 4.23-2.6 0-4.37-1.42-4.37-3.55 0-2.2 1.88-3.7 4.65-3.7 1.05 0 2.02.15 2.87.44-.3-1.5-1.33-2.3-2.95-2.3-1.2 0-2.2.34-3.15 1.07L6.9 6.38c1.25-1 2.82-1.53 4.6-1.53 3.26 0 5.17 1.84 5.43 5.12 2.13.96 3.27 2.64 3.27 4.55 0 4.03-3.28 6.98-8.05 6.98Zm-.72-7.33c1.58 0 2.73-.88 3.15-2.34-.76-.35-1.72-.54-2.83-.54-1.48 0-2.31.54-2.31 1.46 0 .87.78 1.42 1.99 1.42Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SnapchatIcon({ className }: SocialIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2.25c3.02 0 5.03 2.12 5.03 5.25 0 .55-.04 1.06-.08 1.53-.02.28-.05.55-.05.8.23.12.52.17.84.17.23 0 .45-.03.66-.07.46-.07.84.24.9.66.05.35-.13.68-.48.83l-.9.38c-.4.17-.68.36-.77.55-.11.24.1.72.59 1.35.55.7 1.35 1.18 2.38 1.43.39.1.65.47.6.87-.04.36-.32.65-.68.72-.62.13-1.1.33-1.45.6-.23.18-.33.38-.44.6-.17.33-.42.8-1.06.8-.27 0-.56-.08-.92-.18-.41-.12-.92-.27-1.56-.27-.43 0-.8.13-1.19.4-.42.28-.95.62-1.97.62s-1.55-.34-1.97-.62c-.39-.27-.76-.4-1.19-.4-.64 0-1.15.15-1.56.27-.36.1-.65.18-.92.18-.64 0-.89-.47-1.06-.8-.11-.22-.21-.42-.44-.6-.35-.27-.83-.47-1.45-.6a.82.82 0 0 1-.68-.72c-.05-.4.21-.77.6-.87 1.03-.25 1.83-.73 2.38-1.43.49-.63.7-1.11.59-1.35-.09-.19-.37-.38-.77-.55l-.9-.38a.82.82 0 0 1-.48-.83c.06-.42.44-.73.9-.66.21.04.43.07.66.07.32 0 .61-.05.84-.17 0-.25-.03-.52-.05-.8-.04-.47-.08-.98-.08-1.53C6.97 4.37 8.98 2.25 12 2.25Z" />
    </svg>
  );
}

export type CompanySocialLink = {
  key: keyof typeof companyMeta.socials;
  label: string;
  labelAr: string;
  handle: string;
  href: string;
  color: string;
  Icon: ElementType<SocialIconProps>;
};

export function getCompanySocialLinks(isArabic = false): CompanySocialLink[] {
  const items: CompanySocialLink[] = [
    {
      key: "facebook",
      label: "Facebook",
      labelAr: "فيسبوك",
      handle: companyMeta.socialHandles.facebook,
      href: companyMeta.socials.facebook,
      color: "#1877F2",
      Icon: Facebook
    },
    {
      key: "instagram",
      label: "Instagram",
      labelAr: "إنستغرام",
      handle: companyMeta.socialHandles.instagram,
      href: companyMeta.socials.instagram,
      color: "#E4405F",
      Icon: Instagram
    },
    {
      key: "threads",
      label: "Threads",
      labelAr: "ثريدز",
      handle: companyMeta.socialHandles.threads,
      href: companyMeta.socials.threads,
      color: "#FFFFFF",
      Icon: ThreadsIcon
    },
    {
      key: "tiktok",
      label: "TikTok",
      labelAr: "تيك توك",
      handle: companyMeta.socialHandles.tiktok,
      href: companyMeta.socials.tiktok,
      color: "#00F2EA",
      Icon: TikTokIcon
    },
    {
      key: "youtube",
      label: "YouTube",
      labelAr: "يوتيوب",
      handle: companyMeta.socialHandles.youtube,
      href: companyMeta.socials.youtube,
      color: "#FF0033",
      Icon: Youtube
    },
    {
      key: "linkedin",
      label: "LinkedIn",
      labelAr: "لينكدإن",
      handle: companyMeta.socialHandles.linkedin,
      href: companyMeta.socials.linkedin,
      color: "#0A66C2",
      Icon: Linkedin
    },
    {
      key: "snapchat",
      label: "Snapchat",
      labelAr: "سناب شات",
      handle: companyMeta.socialHandles.snapchat,
      href: companyMeta.socials.snapchat,
      color: "#FFFC00",
      Icon: SnapchatIcon
    }
  ];

  return items.map((item) => ({
    ...item,
    label: isArabic ? item.labelAr : item.label
  }));
}
