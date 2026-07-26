import { jsPDF } from "jspdf";
import type {
  MerchantStatementLanguage,
  MerchantStatementPayload,
  MerchantStatementRow,
} from "./merchantStatementExport";

type PdfLink = { x: number; y: number; width: number; height: number; url: string };
type ColumnKey =
  | "index"
  | "order"
  | "customer"
  | "phone"
  | "destination"
  | "date"
  | "customerTotal"
  | "deliveryFee"
  | "merchantDue"
  | "tracking";

type Column = {
  key: ColumnKey;
  ar: string;
  en: string;
  weight: number;
  ltr?: boolean;
  lines?: number;
};

const LOCAL_LOGO_URL = "/assets/daynight/merchant-statement-logo.png";
const REMOTE_LOGO_URL = "https://i.postimg.cc/XqnP282D/cropped-circle-image-(9).png";
const WEBSITE_URL = "https://www.daynightae.com";
const TRACKING_URL = "https://daynightae.com/tracking";
const WHATSAPP_URL = "https://wa.me/971568757331";
const EMAIL_URL = "mailto:Admin@daynightae.com";
const PAGE_FONT = "Tahoma, Arial, 'Noto Sans Arabic', 'Segoe UI', sans-serif";

const COLUMNS: Column[] = [
  { key: "index", ar: "#", en: "#", weight: 0.38, ltr: true },
  { key: "order", ar: "الطلب / الكوبون", en: "Order / Coupon", weight: 1.36, ltr: true, lines: 2 },
  { key: "customer", ar: "العميل", en: "Customer", weight: 1.05, lines: 2 },
  { key: "phone", ar: "الهاتف", en: "Phone", weight: 1.02, ltr: true },
  { key: "destination", ar: "عنوان التسليم", en: "Destination", weight: 2.12, lines: 2 },
  { key: "date", ar: "التاريخ", en: "Date", weight: 0.92, ltr: true },
  { key: "customerTotal", ar: "إجمالي العميل", en: "Customer total", weight: 1.02, ltr: true },
  { key: "deliveryFee", ar: "التوصيل", en: "Delivery", weight: 0.94, ltr: true },
  { key: "merchantDue", ar: "تسوية التاجر", en: "Merchant settlement", weight: 1.18, ltr: true, lines: 2 },
  { key: "tracking", ar: "متابعة الطلبية", en: "Track order", weight: 1.17, lines: 2 },
];

function clean(value: unknown) {
  return String(value ?? "").trim() || "—";
}

function numeric(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown, language: MerchantStatementLanguage) {
  const amount = numeric(value);
  return language === "ar" ? `${amount.toFixed(2)} درهم` : `${amount.toFixed(2)} AED`;
}

function merchantSettlement(value: unknown, language: MerchantStatementLanguage) {
  const amount = numeric(value);
  if (amount < 0) {
    return language === "ar"
      ? `على التاجر ${money(Math.abs(amount), language)}`
      : `Due from merchant ${money(Math.abs(amount), language)}`;
  }
  return language === "ar"
    ? `للتاجر ${money(amount, language)}`
    : `Due to merchant ${money(amount, language)}`;
}

function safeFileName(payload: MerchantStatementPayload) {
  const merchant = clean(payload.merchant.tradeName)
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 55);
  return `DAY_NIGHT_Merchant_Statement_${merchant}_${new Date().toISOString().slice(0, 10)}`;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function setFont(
  ctx: CanvasRenderingContext2D,
  size: number,
  weight = "500",
  color = "#0b172a",
) {
  ctx.font = `${weight} ${size}px ${PAGE_FONT}`;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
}

function fitSingleLine(ctx: CanvasRenderingContext2D, value: unknown, maxWidth: number) {
  let text = clean(value).replace(/\s+/g, " ");
  if (ctx.measureText(text).width <= maxWidth) return text;
  while (text.length > 1 && ctx.measureText(`${text}…`).width > maxWidth) {
    text = text.slice(0, -1);
  }
  return `${text}…`;
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  value: unknown,
  maxWidth: number,
  maxLines = 2,
) {
  const source = clean(value).replace(/\s+/g, " ");
  if (maxLines <= 1) return [fitSingleLine(ctx, source, maxWidth)];
  const words = source.split(" ");
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      return;
    }
    if (line) lines.push(line);
    line = word;
  });
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = fitSingleLine(
    ctx,
    `${kept[maxLines - 1]} ${lines.slice(maxLines).join(" ")}`,
    maxWidth,
  );
  return kept;
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  value: unknown,
  x: number,
  y: number,
  width: number,
  height: number,
  align: CanvasTextAlign,
  options: {
    size?: number;
    weight?: string;
    color?: string;
    maxLines?: number;
    direction?: CanvasDirection;
  } = {},
) {
  const size = options.size ?? 8.5;
  setFont(ctx, size, options.weight ?? "500", options.color ?? "#0b172a");
  ctx.textAlign = align;
  ctx.direction = options.direction ?? "inherit";
  const lines = wrapLines(ctx, value, width - 10, options.maxLines ?? 2);
  const lineHeight = size + 3;
  const startY = y + height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line, x, startY + index * lineHeight, width - 10);
  });
}

async function loadOneLogo(url: string): Promise<HTMLImageElement | null> {
  if (typeof window === "undefined" || typeof Image === "undefined") return null;
  try {
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) return null;
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("logo_load_failed"));
      image.src = objectUrl;
    });
    URL.revokeObjectURL(objectUrl);
    return image;
  } catch {
    return null;
  }
}

async function loadLogo(payloadLogo?: string): Promise<HTMLImageElement | null> {
  const candidates = [LOCAL_LOGO_URL, payloadLogo, REMOTE_LOGO_URL]
    .map((value) => String(value || "").trim())
    .filter((value, index, all) => value && all.indexOf(value) === index);
  for (const candidate of candidates) {
    const image = await loadOneLogo(candidate);
    if (image) return image;
  }
  return null;
}

function drawCircularLogo(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  x: number,
  y: number,
  size: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, size, size);
  if (image) {
    ctx.drawImage(image, x, y, size, size);
  } else {
    setFont(ctx, 19, "900", "#03101f");
    ctx.textAlign = "center";
    ctx.direction = "ltr";
    ctx.fillText("DN", x + size / 2, y + size / 2 + 1);
  }
  ctx.restore();
  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.stroke();
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  payload: MerchantStatementPayload,
  logo: HTMLImageElement | null,
  width: number,
  page: number,
  totalPages: number,
) {
  const isArabic = payload.language === "ar";
  const margin = 22;
  roundedRect(ctx, margin, 16, width - margin * 2, 76, 15);
  ctx.fillStyle = "#03101f";
  ctx.fill();
  ctx.fillStyle = "#d4af37";
  ctx.fillRect(margin, 88, width - margin * 2, 4);

  const logoSize = 56;
  const logoX = isArabic ? width - margin - logoSize - 10 : margin + 10;
  drawCircularLogo(ctx, logo, logoX, 25, logoSize);
  const brandX = isArabic ? logoX - 14 : logoX + logoSize + 14;
  ctx.textAlign = isArabic ? "right" : "left";
  ctx.direction = isArabic ? "rtl" : "ltr";
  setFont(ctx, 18, "900", "#d4af37");
  ctx.fillText("DAY NIGHT", brandX, 43, 250);
  setFont(ctx, 9, "700", "#ffffff");
  ctx.fillText(
    isArabic ? "داي نايت لخدمات التوصيل والشحن" : "DAY NIGHT DELIVERY SERVICES",
    brandX,
    65,
    290,
  );

  const metaX = isArabic ? margin + 12 : width - margin - 12;
  ctx.textAlign = isArabic ? "left" : "right";
  ctx.direction = isArabic ? "rtl" : "ltr";
  setFont(ctx, 8.2, "650", "#ffffff");
  ctx.fillText(
    `${isArabic ? "تاريخ الإصدار" : "Issued"}: ${new Date().toLocaleString(isArabic ? "ar-AE" : "en-AE")}`,
    metaX,
    43,
    260,
  );
  setFont(ctx, 8.7, "850", "#d4af37");
  ctx.fillText(`${isArabic ? "صفحة" : "Page"} ${page} / ${totalPages}`, metaX, 65, 170);
}

function drawMerchantCard(
  ctx: CanvasRenderingContext2D,
  payload: MerchantStatementPayload,
  width: number,
) {
  const isArabic = payload.language === "ar";
  const margin = 22;
  setFont(ctx, 17, "900", "#03101f");
  ctx.textAlign = isArabic ? "right" : "left";
  ctx.direction = isArabic ? "rtl" : "ltr";
  ctx.fillText(
    isArabic
      ? `كشف حساب وطلبات التاجر - ${payload.merchant.tradeName}`
      : `Merchant orders and account statement - ${payload.merchant.tradeName}`,
    isArabic ? width - margin : margin,
    111,
    width - margin * 2,
  );

  roundedRect(ctx, margin, 126, width - margin * 2, 42, 10);
  ctx.fillStyle = "#f7f9fc";
  ctx.fill();
  ctx.strokeStyle = "#d8dee8";
  ctx.stroke();

  const details = [
    [isArabic ? "التاجر" : "Merchant", payload.merchant.tradeName],
    [isArabic ? "المالك" : "Owner", payload.merchant.ownerName || "—"],
    [isArabic ? "الكود" : "Code", payload.merchant.code || "—"],
    [isArabic ? "الهاتف" : "Phone", payload.merchant.phone || "—"],
    [isArabic ? "الموقع" : "Location", payload.merchant.location || payload.merchant.address || "—"],
    [isArabic ? "الفترة" : "Period", payload.periodLabel],
  ];
  const gap = 7;
  const itemWidth = (width - margin * 2 - gap * 2) / 3;
  details.forEach(([label, value], index) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    const x = isArabic
      ? width - margin - itemWidth - column * (itemWidth + gap)
      : margin + column * (itemWidth + gap);
    const itemY = 136 + row * 18;
    setFont(ctx, 7.2, "850", "#926f00");
    ctx.textAlign = isArabic ? "right" : "left";
    ctx.direction = isArabic ? "rtl" : "ltr";
    ctx.fillText(label, isArabic ? x + itemWidth : x, itemY, itemWidth);
    setFont(ctx, 8.2, "650", "#0b172a");
    ctx.fillText(
      fitSingleLine(ctx, value, itemWidth - 45),
      isArabic ? x + itemWidth - 40 : x + 40,
      itemY,
      itemWidth - 40,
    );
  });
}

function columnRects(width: number, margin: number, language: MerchantStatementLanguage) {
  const tableWidth = width - margin * 2;
  const totalWeight = COLUMNS.reduce((sum, column) => sum + column.weight, 0);
  const rects: Array<Column & { x: number; width: number }> = [];
  if (language === "ar") {
    let cursor = width - margin;
    COLUMNS.forEach((column) => {
      const columnWidth = tableWidth * (column.weight / totalWeight);
      cursor -= columnWidth;
      rects.push({ ...column, x: cursor, width: columnWidth });
    });
  } else {
    let cursor = margin;
    COLUMNS.forEach((column) => {
      const columnWidth = tableWidth * (column.weight / totalWeight);
      rects.push({ ...column, x: cursor, width: columnWidth });
      cursor += columnWidth;
    });
  }
  return rects;
}

function rowValue(
  row: MerchantStatementRow,
  key: ColumnKey,
  language: MerchantStatementLanguage,
) {
  if (key === "index") return row.index;
  if (key === "order") return `${row.reference}\n${language === "ar" ? "كوبون" : "Coupon"}: ${row.coupon || "—"}`;
  if (key === "customer") return row.customer;
  if (key === "phone") return row.phone;
  if (key === "destination") return row.destination;
  if (key === "date") return row.date;
  if (key === "customerTotal") return money(row.customerTotal, language);
  if (key === "deliveryFee") return money(row.deliveryFee, language);
  if (key === "merchantDue") return merchantSettlement(row.merchantDue, language);
  return language === "ar" ? "متابعة الطلبية" : "Track order";
}

function drawTable(
  ctx: CanvasRenderingContext2D,
  payload: MerchantStatementPayload,
  rows: MerchantStatementRow[],
  width: number,
  startY: number,
) {
  const isArabic = payload.language === "ar";
  const margin = 22;
  const headerHeight = 27;
  const rowHeight = 43;
  const rects = columnRects(width, margin, payload.language);
  const links: PdfLink[] = [];

  rects.forEach((column) => {
    ctx.fillStyle = "#d4af37";
    ctx.fillRect(column.x, startY, column.width, headerHeight);
    ctx.strokeStyle = "#b88f16";
    ctx.strokeRect(column.x, startY, column.width, headerHeight);
    drawWrappedText(
      ctx,
      isArabic ? column.ar : column.en,
      column.x + column.width / 2,
      startY,
      column.width,
      headerHeight,
      "center",
      { size: 7.3, weight: "900", color: "#03101f", maxLines: 2, direction: isArabic ? "rtl" : "ltr" },
    );
  });

  let y = startY + headerHeight;
  rows.forEach((row, rowIndex) => {
    rects.forEach((column) => {
      ctx.fillStyle = rowIndex % 2 === 0 ? "#ffffff" : "#f6f8fb";
      ctx.fillRect(column.x, y, column.width, rowHeight);
      ctx.strokeStyle = "#dce3ec";
      ctx.strokeRect(column.x, y, column.width, rowHeight);
      const value = rowValue(row, column.key, payload.language);
      if (column.key === "tracking") {
        roundedRect(ctx, column.x + 5, y + 9, column.width - 10, rowHeight - 18, 7);
        ctx.fillStyle = "#eaf3ff";
        ctx.fill();
        ctx.strokeStyle = "#8bbcff";
        ctx.stroke();
        drawWrappedText(ctx, value, column.x + column.width / 2, y + 9, column.width - 10, rowHeight - 18, "center", {
          size: 7.2,
          weight: "900",
          color: "#0057b8",
          maxLines: 2,
          direction: isArabic ? "rtl" : "ltr",
        });
        links.push({ x: column.x + 3, y: y + 6, width: column.width - 6, height: rowHeight - 12, url: row.trackingUrl });
        return;
      }
      drawWrappedText(ctx, value, column.x + column.width / 2, y, column.width, rowHeight, "center", {
        size: column.key === "destination" ? 7.3 : 7.6,
        weight: column.key === "merchantDue" ? "800" : "600",
        color:
          column.key === "merchantDue"
            ? numeric(row.merchantDue) < 0
              ? "#b42318"
              : "#16794b"
            : "#0b172a",
        maxLines: column.lines ?? 1,
        direction: column.ltr ? "ltr" : isArabic ? "rtl" : "ltr",
      });
    });
    y += rowHeight;
  });

  return { links, endY: y };
}

function drawBottomSummary(
  ctx: CanvasRenderingContext2D,
  payload: MerchantStatementPayload,
  width: number,
  y: number,
) {
  const isArabic = payload.language === "ar";
  const margin = 22;
  const gap = 10;
  const cards: Array<[string, string]> = [
    [isArabic ? "قيمة البضاعة" : "Goods value", money(payload.totals.goodsValue, payload.language)],
    [isArabic ? "رسوم التوصيل" : "Delivery fees", money(payload.totals.deliveryFees, payload.language)],
    [isArabic ? "الصافي" : "Net", money(payload.totals.merchantBalance, payload.language)],
  ];
  const cardWidth = (width - margin * 2 - gap * 2) / 3;
  cards.forEach(([label, value], index) => {
    const x = isArabic
      ? width - margin - cardWidth - index * (cardWidth + gap)
      : margin + index * (cardWidth + gap);
    roundedRect(ctx, x, y, cardWidth, 44, 10);
    ctx.fillStyle = index === 2 ? "#fff9df" : "#ffffff";
    ctx.fill();
    ctx.strokeStyle = index === 2 ? "#d4af37" : "#dce3ec";
    ctx.lineWidth = index === 2 ? 1.5 : 1;
    ctx.stroke();
    setFont(ctx, 8, "900", "#926f00");
    ctx.textAlign = "center";
    ctx.direction = isArabic ? "rtl" : "ltr";
    ctx.fillText(label, x + cardWidth / 2, y + 13, cardWidth - 14);
    setFont(ctx, 11, "900", index === 2 && numeric(payload.totals.merchantBalance) < 0 ? "#b42318" : "#0b172a");
    ctx.fillText(fitSingleLine(ctx, value, cardWidth - 16), x + cardWidth / 2, y + 30, cardWidth - 16);
  });
}

function drawTransferNotice(
  ctx: CanvasRenderingContext2D,
  payload: MerchantStatementPayload,
  width: number,
  y: number,
) {
  const isArabic = payload.language === "ar";
  const margin = 22;
  const notice = isArabic
    ? "تنويه: الشركة غير مسؤولة عن أي تحويلات بعد مرور أسبوع من تاريخ إصدار الكشف."
    : "Notice: The company is not responsible for any transfers after one week from the statement issue date.";
  roundedRect(ctx, margin, y, width - margin * 2, 27, 8);
  ctx.fillStyle = "#fff9df";
  ctx.fill();
  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  setFont(ctx, 8.2, "900", "#6f5200");
  ctx.textAlign = "center";
  ctx.direction = isArabic ? "rtl" : "ltr";
  ctx.fillText(notice, width / 2, y + 13.5, width - margin * 2 - 18);
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  payload: MerchantStatementPayload,
  width: number,
  height: number,
) {
  const isArabic = payload.language === "ar";
  const margin = 22;
  const links: PdfLink[] = [];
  const lineY = height - 49;
  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(margin, lineY);
  ctx.lineTo(width - margin, lineY);
  ctx.stroke();
  setFont(ctx, 8.2, "800", "#03101f");
  ctx.textAlign = isArabic ? "right" : "left";
  ctx.direction = isArabic ? "rtl" : "ltr";
  ctx.fillText(
    isArabic
      ? `شكراً لشريكنا ${payload.merchant.tradeName} على ثقتكم وتعاونكم مع DAY NIGHT.`
      : `Thank you ${payload.merchant.tradeName} for your trust and partnership with DAY NIGHT.`,
    isArabic ? width - margin : margin,
    height - 36,
    width - margin * 2,
  );
  const footerLinks = [
    { label: "www.daynightae.com", url: WEBSITE_URL },
    { label: isArabic ? "تتبع الطلبات" : "Order tracking", url: TRACKING_URL },
    { label: "+971 56 875 7331", url: WHATSAPP_URL },
    { label: "Admin@daynightae.com", url: EMAIL_URL },
  ];
  const gap = 8;
  const itemWidth = (width - margin * 2 - gap * 3) / 4;
  footerLinks.forEach((item, index) => {
    const x = isArabic
      ? width - margin - itemWidth - index * (itemWidth + gap)
      : margin + index * (itemWidth + gap);
    roundedRect(ctx, x, height - 25, itemWidth, 15, 5);
    ctx.fillStyle = "#f0f5fb";
    ctx.fill();
    ctx.strokeStyle = "#cad7e7";
    ctx.stroke();
    setFont(ctx, 6.9, "800", "#0057b8");
    ctx.textAlign = "center";
    ctx.direction = "ltr";
    ctx.fillText(fitSingleLine(ctx, item.label, itemWidth - 8), x + itemWidth / 2, height - 17.5, itemWidth - 8);
    links.push({ x, y: height - 27, width: itemWidth, height: 19, url: item.url });
  });
  return links;
}

function paginateRows(rows: MerchantStatementRow[], height: number) {
  const rowHeight = 43;
  const headerHeight = 27;
  const firstTableY = 176;
  const laterTableY = 118;
  const footerTop = height - 54;
  const finalSection = 91;
  const firstGeneral = Math.max(1, Math.floor((footerTop - firstTableY - headerHeight) / rowHeight));
  const firstFinal = Math.max(1, Math.floor((footerTop - firstTableY - headerHeight - finalSection) / rowHeight));
  const laterGeneral = Math.max(1, Math.floor((footerTop - laterTableY - headerHeight) / rowHeight));
  const laterFinal = Math.max(1, Math.floor((footerTop - laterTableY - headerHeight - finalSection) / rowHeight));

  if (rows.length <= firstFinal) return [rows];
  const pages: MerchantStatementRow[][] = [];
  let cursor = 0;
  pages.push(rows.slice(cursor, cursor + firstGeneral));
  cursor += firstGeneral;
  while (rows.length - cursor > laterFinal) {
    const remaining = rows.length - cursor;
    const take = Math.max(1, Math.min(laterGeneral, remaining - laterFinal));
    pages.push(rows.slice(cursor, cursor + take));
    cursor += take;
  }
  pages.push(rows.slice(cursor));
  return pages;
}

function drawPage(
  payload: MerchantStatementPayload,
  logo: HTMLImageElement | null,
  rows: MerchantStatementRow[],
  page: number,
  totalPages: number,
  width: number,
  height: number,
) {
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.direction = payload.language === "ar" ? "rtl" : "ltr";

  drawHeader(ctx, payload, logo, width, page, totalPages);
  let tableY = 118;
  if (page === 1) {
    drawMerchantCard(ctx, payload, width);
    tableY = 176;
  } else {
    setFont(ctx, 13.5, "900", "#03101f");
    ctx.textAlign = payload.language === "ar" ? "right" : "left";
    ctx.direction = payload.language === "ar" ? "rtl" : "ltr";
    ctx.fillText(
      payload.language === "ar"
        ? `تكملة كشف التاجر - ${payload.merchant.tradeName}`
        : `Merchant statement continued - ${payload.merchant.tradeName}`,
      payload.language === "ar" ? width - 22 : 22,
      106,
      width - 44,
    );
  }

  const table = drawTable(ctx, payload, rows, width, tableY);
  if (page === totalPages) {
    const summaryY = table.endY + 10;
    drawBottomSummary(ctx, payload, width, summaryY);
    drawTransferNotice(ctx, payload, width, summaryY + 52);
  }
  const footerLinks = drawFooter(ctx, payload, width, height);
  return { canvas, links: [...table.links, ...footerLinks] };
}

export async function buildMerchantStatementPdfV2(input: MerchantStatementPayload) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const payload: MerchantStatementPayload = {
    ...input,
    totals: {
      ...input.totals,
      orders: input.rows.length,
      deliveryFees: input.rows.reduce((sum, row) => sum + numeric(row.deliveryFee), 0),
      customerTotal: input.rows.reduce((sum, row) => sum + numeric(row.customerTotal), 0),
      merchantBalance: input.rows.reduce((sum, row) => sum + numeric(row.merchantDue), 0),
    },
  };
  const logo = await loadLogo(payload.logoUrl);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4", compress: true });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const pages = paginateRows(payload.rows, height);
  if (!pages.length) pages.push([]);

  pages.forEach((pageRows, index) => {
    if (index > 0) doc.addPage("a4", "landscape");
    const rendered = drawPage(payload, logo, pageRows, index + 1, pages.length, width, height);
    doc.addImage(
      rendered.canvas.toDataURL("image/jpeg", 0.95),
      "JPEG",
      0,
      0,
      width,
      height,
      undefined,
      "FAST",
    );
    rendered.links.forEach((link) => {
      doc.link(link.x, link.y, link.width, link.height, { url: link.url });
    });
  });

  doc.setProperties({
    title: `${payload.language === "ar" ? "كشف التاجر" : "Merchant statement"} - ${payload.merchant.tradeName}`,
    subject: payload.periodLabel,
    author: payload.generatedBy || "DAY NIGHT DELIVERY SERVICES",
    creator: "DAY NIGHT Admin Operations",
  });
  doc.save(`${safeFileName(payload)}.pdf`);
}
