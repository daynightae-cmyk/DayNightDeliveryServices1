import { jsPDF } from "jspdf";

export type MerchantStatementLanguage = "ar" | "en";

export type MerchantStatementMerchant = {
  tradeName: string;
  ownerName?: string;
  code?: string;
  phone?: string;
  email?: string;
  location?: string;
  address?: string;
};

export type MerchantStatementTotals = {
  orders: number;
  goodsValue: number;
  deliveryFees: number;
  customerTotal: number;
  merchantBalance: number;
};

export type MerchantStatementRow = {
  index: number;
  reference: string;
  coupon?: string;
  customer: string;
  phone: string;
  destination: string;
  date: string;
  goodsValue?: number;
  customerTotal: number;
  deliveryFee: number;
  merchantDue: number;
  status?: string;
  trackingUrl: string;
};

export type MerchantStatementPayload = {
  language: MerchantStatementLanguage;
  merchant: MerchantStatementMerchant;
  rows: MerchantStatementRow[];
  totals: MerchantStatementTotals;
  periodLabel: string;
  logoUrl?: string;
  generatedBy?: string;
};

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
const EPSILON = 0.005;

const columns: Column[] = [
  { key: "index", ar: "#", en: "#", weight: 0.38, ltr: true },
  {
    key: "order",
    ar: "الطلب / الكوبون",
    en: "Order / Coupon",
    weight: 1.35,
    ltr: true,
    lines: 2,
  },
  { key: "customer", ar: "العميل", en: "Customer", weight: 1.12, lines: 2 },
  { key: "phone", ar: "الهاتف", en: "Phone", weight: 1.02, ltr: true },
  {
    key: "destination",
    ar: "عنوان التسليم",
    en: "Destination",
    weight: 2.05,
    lines: 2,
  },
  { key: "date", ar: "التاريخ", en: "Date", weight: 0.92, ltr: true },
  {
    key: "customerTotal",
    ar: "إجمالي العميل",
    en: "Customer total",
    weight: 1.02,
    ltr: true,
  },
  { key: "deliveryFee", ar: "التوصيل", en: "Delivery", weight: 0.95, ltr: true },
  {
    key: "merchantDue",
    ar: "تسوية التاجر",
    en: "Merchant settlement",
    weight: 1.22,
    ltr: true,
    lines: 2,
  },
  { key: "tracking", ar: "متابعة الطلبية", en: "Track order", weight: 1.18, lines: 2 },
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

function safeFileName(payload: MerchantStatementPayload) {
  const merchant = clean(payload.merchant.tradeName)
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 55);
  return `DAY_NIGHT_Merchant_Statement_${merchant}_${new Date().toISOString().slice(0, 10)}`;
}

function downloadBlob(blob: Blob, filename: string) {
  if (typeof document === "undefined" || typeof URL === "undefined") return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2500);
}

function csvCell(value: unknown) {
  const text = clean(value).replace(/\r?\n/g, " ");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function merchantSettlement(value: number, language: MerchantStatementLanguage) {
  if (value < 0) {
    return language === "ar"
      ? `على التاجر ${money(Math.abs(value), language)}`
      : `Due from merchant ${money(Math.abs(value), language)}`;
  }
  return language === "ar"
    ? `للتاجر ${money(value, language)}`
    : `Due to merchant ${money(value, language)}`;
}

function isZeroGoodsOrder(row: MerchantStatementRow) {
  const deliveryFee = numeric(row.deliveryFee);
  if (deliveryFee <= EPSILON) return false;

  if (row.goodsValue !== undefined && row.goodsValue !== null) {
    return Math.abs(numeric(row.goodsValue)) <= EPSILON;
  }

  const merchantDue = numeric(row.merchantDue);
  const customerTotal = numeric(row.customerTotal);
  return (
    Math.abs(merchantDue) <= EPSILON &&
    (Math.abs(customerTotal) <= EPSILON ||
      Math.abs(customerTotal - deliveryFee) <= EPSILON)
  );
}

function normalizeStatementRow(row: MerchantStatementRow): MerchantStatementRow {
  if (!isZeroGoodsOrder(row)) return row;
  const deliveryFee = Math.max(0, numeric(row.deliveryFee));
  return {
    ...row,
    goodsValue: 0,
    customerTotal: 0,
    merchantDue: -deliveryFee,
  };
}

function normalizedPayload(payload: MerchantStatementPayload): MerchantStatementPayload {
  const rows = payload.rows.map(normalizeStatementRow);
  return {
    ...payload,
    rows,
    totals: {
      orders: rows.length,
      goodsValue: numeric(payload.totals.goodsValue),
      deliveryFees: rows.reduce((sum, row) => sum + numeric(row.deliveryFee), 0),
      customerTotal: rows.reduce((sum, row) => sum + numeric(row.customerTotal), 0),
      merchantBalance: rows.reduce((sum, row) => sum + numeric(row.merchantDue), 0),
    },
  };
}

export function buildMerchantStatementCsv(input: MerchantStatementPayload) {
  const payload = normalizedPayload(input);
  const isArabic = payload.language === "ar";
  const header = [
    isArabic ? "م" : "#",
    isArabic ? "رقم الطلب" : "Order reference",
    isArabic ? "الكوبون" : "Coupon",
    isArabic ? "العميل" : "Customer",
    isArabic ? "الهاتف" : "Phone",
    isArabic ? "عنوان التسليم" : "Destination",
    isArabic ? "التاريخ" : "Date",
    isArabic ? "إجمالي العميل" : "Customer total",
    isArabic ? "التوصيل" : "Delivery fee",
    isArabic ? "تسوية التاجر" : "Merchant settlement",
    isArabic ? "رابط المتابعة" : "Tracking link",
  ];
  const rows = payload.rows.map((row) => [
    row.index,
    row.reference,
    row.coupon || "—",
    row.customer,
    row.phone,
    row.destination,
    row.date,
    money(row.customerTotal, payload.language),
    money(row.deliveryFee, payload.language),
    merchantSettlement(row.merchantDue, payload.language),
    row.trackingUrl,
  ]);
  const csv = `\uFEFF${[header, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n")}`;
  downloadBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
    `${safeFileName(payload)}.csv`,
  );
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
  lines.forEach((line, index) =>
    ctx.fillText(line, x, startY + index * lineHeight, width - 10),
  );
}

async function loadOneLogo(url: string): Promise<HTMLImageElement | null> {
  if (typeof window === "undefined" || typeof Image === "undefined") return null;
  try {
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (contentType && !contentType.includes("image")) return null;
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

  if (image) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y, size, size);
    ctx.drawImage(image, x, y, size, size);
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y, size, size);
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

function columnRects(
  width: number,
  margin: number,
  language: MerchantStatementLanguage,
) {
  const tableWidth = width - margin * 2;
  const totalWeight = columns.reduce((sum, column) => sum + column.weight, 0);
  const rects: Array<Column & { x: number; width: number }> = [];

  if (language === "ar") {
    let cursor = width - margin;
    columns.forEach((column) => {
      const columnWidth = tableWidth * (column.weight / totalWeight);
      cursor -= columnWidth;
      rects.push({ ...column, x: cursor, width: columnWidth });
    });
  } else {
    let cursor = margin;
    columns.forEach((column) => {
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
  if (key === "order") {
    return `${row.reference}\n${language === "ar" ? "كوبون" : "Coupon"}: ${row.coupon || "—"}`;
  }
  if (key === "customer") return row.customer;
  if (key === "phone") return row.phone;
  if (key === "destination") return row.destination;
  if (key === "date") return row.date;
  if (key === "customerTotal") return money(row.customerTotal, language);
  if (key === "deliveryFee") return money(row.deliveryFee, language);
  if (key === "merchantDue") return merchantSettlement(row.merchantDue, language);
  return language === "ar" ? "متابعة الطلبية" : "Track order";
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
  roundedRect(ctx, margin, 16, width - margin * 2, 84, 16);
  ctx.fillStyle = "#03101f";
  ctx.fill();
  ctx.fillStyle = "#d4af37";
  ctx.fillRect(margin, 95, width - margin * 2, 5);

  const logoSize = 62;
  const logoX = isArabic ? width - margin - logoSize - 10 : margin + 10;
  drawCircularLogo(ctx, logo, logoX, 27, logoSize);

  const brandX = isArabic ? logoX - 14 : logoX + logoSize + 14;
  const brandAlign: CanvasTextAlign = isArabic ? "right" : "left";
  setFont(ctx, 19, "900", "#d4af37");
  ctx.textAlign = brandAlign;
  ctx.direction = isArabic ? "rtl" : "ltr";
  ctx.fillText("DAY NIGHT", brandX, 47, 250);
  setFont(ctx, 9.5, "700", "#ffffff");
  ctx.fillText(
    isArabic
      ? "داي نايت لخدمات التوصيل والشحن"
      : "DAY NIGHT DELIVERY SERVICES",
    brandX,
    70,
    285,
  );

  const metaX = isArabic ? margin + 12 : width - margin - 12;
  const metaAlign: CanvasTextAlign = isArabic ? "left" : "right";
  setFont(ctx, 8.5, "600", "#ffffff");
  ctx.textAlign = metaAlign;
  ctx.direction = isArabic ? "rtl" : "ltr";
  ctx.fillText(
    `${isArabic ? "تاريخ الإصدار" : "Issued"}: ${new Date().toLocaleString(
      isArabic ? "ar-AE" : "en-AE",
    )}`,
    metaX,
    47,
    260,
  );
  setFont(ctx, 9, "800", "#d4af37");
  ctx.fillText(
    `${isArabic ? "صفحة" : "Page"} ${page} / ${totalPages}`,
    metaX,
    70,
    170,
  );
}

function drawMerchantCard(
  ctx: CanvasRenderingContext2D,
  payload: MerchantStatementPayload,
  width: number,
) {
  const isArabic = payload.language === "ar";
  const margin = 22;
  const titleY = 118;

  setFont(ctx, 18, "900", "#03101f");
  ctx.textAlign = isArabic ? "right" : "left";
  ctx.direction = isArabic ? "rtl" : "ltr";
  ctx.fillText(
    isArabic
      ? `كشف حساب وطلبات التاجر - ${payload.merchant.tradeName}`
      : `Merchant orders and account statement - ${payload.merchant.tradeName}`,
    isArabic ? width - margin : margin,
    titleY,
    width - margin * 2,
  );

  roundedRect(ctx, margin, 136, width - margin * 2, 54, 11);
  ctx.fillStyle = "#f7f9fc";
  ctx.fill();
  ctx.strokeStyle = "#d8dee8";
  ctx.stroke();

  const details = [
    [isArabic ? "التاجر" : "Merchant", payload.merchant.tradeName],
    [isArabic ? "المالك" : "Owner", payload.merchant.ownerName || "—"],
    [isArabic ? "الكود" : "Code", payload.merchant.code || "—"],
    [isArabic ? "الهاتف" : "Phone", payload.merchant.phone || "—"],
    [
      isArabic ? "الموقع" : "Location",
      payload.merchant.location || payload.merchant.address || "—",
    ],
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
    const itemY = 144 + row * 21;
    setFont(ctx, 7.5, "800", "#926f00");
    ctx.textAlign = isArabic ? "right" : "left";
    ctx.direction = isArabic ? "rtl" : "ltr";
    ctx.fillText(label, isArabic ? x + itemWidth : x, itemY, itemWidth);
    setFont(ctx, 8.5, "600", "#0b172a");
    ctx.fillText(
      fitSingleLine(ctx, value, itemWidth - 48),
      isArabic ? x + itemWidth - 43 : x + 43,
      itemY,
      itemWidth - 43,
    );
  });
}

function drawTotals(
  ctx: CanvasRenderingContext2D,
  payload: MerchantStatementPayload,
  width: number,
) {
  const isArabic = payload.language === "ar";
  const margin = 22;
  const y = 200;
  const gap = 7;
  const totals = [
    [isArabic ? "عدد الطلبات" : "Orders", String(payload.totals.orders)],
    [
      isArabic ? "قيمة البضاعة" : "Goods value",
      money(payload.totals.goodsValue, payload.language),
    ],
    [
      isArabic ? "رسوم التوصيل" : "Delivery fees",
      money(payload.totals.deliveryFees, payload.language),
    ],
    [
      isArabic ? "إجمالي العميل" : "Customer total",
      money(payload.totals.customerTotal, payload.language),
    ],
    [
      isArabic ? "الرصيد النهائي" : "Final balance",
      merchantSettlement(payload.totals.merchantBalance, payload.language),
    ],
  ];

  const cardWidth =
    (width - margin * 2 - gap * (totals.length - 1)) / totals.length;
  totals.forEach(([label, value], index) => {
    const x = isArabic
      ? width - margin - cardWidth - index * (cardWidth + gap)
      : margin + index * (cardWidth + gap);
    roundedRect(ctx, x, y, cardWidth, 42, 10);
    ctx.fillStyle = index === totals.length - 1 ? "#fff9df" : "#ffffff";
    ctx.fill();
    ctx.strokeStyle = index === totals.length - 1 ? "#d4af37" : "#e2e8f0";
    ctx.stroke();

    setFont(ctx, 7.5, "800", "#926f00");
    ctx.textAlign = "center";
    ctx.direction = isArabic ? "rtl" : "ltr";
    ctx.fillText(label, x + cardWidth / 2, y + 13, cardWidth - 10);

    setFont(
      ctx,
      9,
      "800",
      index === totals.length - 1 && payload.totals.merchantBalance < 0
        ? "#b42318"
        : "#0b172a",
    );
    ctx.fillText(
      fitSingleLine(ctx, value, cardWidth - 10),
      x + cardWidth / 2,
      y + 29,
      cardWidth - 10,
    );
  });
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
  const headerHeight = 30;
  const rowHeight = 48;
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
      {
        size: 7.7,
        weight: "900",
        color: "#03101f",
        maxLines: 2,
        direction: isArabic ? "rtl" : "ltr",
      },
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
        roundedRect(ctx, column.x + 5, y + 10, column.width - 10, rowHeight - 20, 7);
        ctx.fillStyle = "#eaf3ff";
        ctx.fill();
        ctx.strokeStyle = "#8bbcff";
        ctx.stroke();
        drawWrappedText(
          ctx,
          value,
          column.x + column.width / 2,
          y + 10,
          column.width - 10,
          rowHeight - 20,
          "center",
          {
            size: 7.6,
            weight: "900",
            color: "#0057b8",
            maxLines: 2,
            direction: isArabic ? "rtl" : "ltr",
          },
        );
        links.push({
          x: column.x + 3,
          y: y + 7,
          width: column.width - 6,
          height: rowHeight - 14,
          url: row.trackingUrl,
        });
        return;
      }

      drawWrappedText(
        ctx,
        value,
        column.x + column.width / 2,
        y,
        column.width,
        rowHeight,
        "center",
        {
          size: column.key === "destination" ? 7.7 : 8,
          weight: column.key === "merchantDue" ? "800" : "600",
          color:
            column.key === "merchantDue"
              ? row.merchantDue < 0
                ? "#b42318"
                : "#16794b"
              : "#0b172a",
          maxLines: column.lines ?? 1,
          direction: column.ltr ? "ltr" : isArabic ? "rtl" : "ltr",
        },
      );
    });
    y += rowHeight;
  });

  return links;
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
  const lineY = height - 53;

  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(margin, lineY);
  ctx.lineTo(width - margin, lineY);
  ctx.stroke();

  const thankYou = isArabic
    ? `شكراً لشريكنا ${payload.merchant.tradeName} على ثقتكم وتعاونكم مع DAY NIGHT.`
    : `Thank you ${payload.merchant.tradeName} for your trust and partnership with DAY NIGHT.`;
  setFont(ctx, 8.5, "800", "#03101f");
  ctx.textAlign = isArabic ? "right" : "left";
  ctx.direction = isArabic ? "rtl" : "ltr";
  ctx.fillText(
    thankYou,
    isArabic ? width - margin : margin,
    height - 39,
    width - margin * 2,
  );

  const footerLinks = [
    { label: "www.daynightae.com", url: WEBSITE_URL },
    { label: isArabic ? "تتبع الطلبات" : "Order tracking", url: TRACKING_URL },
    { label: "+971 56 875 7331", url: WHATSAPP_URL },
    { label: "Admin@daynightae.com", url: EMAIL_URL },
  ];
  const gap = 8;
  const itemWidth =
    (width - margin * 2 - gap * (footerLinks.length - 1)) / footerLinks.length;

  footerLinks.forEach((item, index) => {
    const x = isArabic
      ? width - margin - itemWidth - index * (itemWidth + gap)
      : margin + index * (itemWidth + gap);
    roundedRect(ctx, x, height - 28, itemWidth, 17, 6);
    ctx.fillStyle = "#f0f5fb";
    ctx.fill();
    ctx.strokeStyle = "#cad7e7";
    ctx.stroke();

    setFont(ctx, 7.2, "800", "#0057b8");
    ctx.textAlign = "center";
    ctx.direction = "ltr";
    ctx.fillText(
      fitSingleLine(ctx, item.label, itemWidth - 8),
      x + itemWidth / 2,
      height - 19.5,
      itemWidth - 8,
    );
    links.push({
      x,
      y: height - 30,
      width: itemWidth,
      height: 20,
      url: item.url,
    });
  });

  return links;
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
  let tableY = 124;
  if (page === 1) {
    drawMerchantCard(ctx, payload, width);
    drawTotals(ctx, payload, width);
    tableY = 252;
  } else {
    setFont(ctx, 14, "900", "#03101f");
    ctx.textAlign = payload.language === "ar" ? "right" : "left";
    ctx.direction = payload.language === "ar" ? "rtl" : "ltr";
    ctx.fillText(
      payload.language === "ar"
        ? `تكملة كشف التاجر - ${payload.merchant.tradeName}`
        : `Merchant statement continued - ${payload.merchant.tradeName}`,
      payload.language === "ar" ? width - 22 : 22,
      114,
      width - 44,
    );
    tableY = 132;
  }

  const tableLinks = drawTable(ctx, payload, rows, width, tableY);
  const footerLinks = drawFooter(ctx, payload, width, height);
  return { canvas, links: [...tableLinks, ...footerLinks] };
}

export async function buildMerchantStatementPdf(input: MerchantStatementPayload) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const payload = normalizedPayload(input);
  const logo = await loadLogo(payload.logoUrl);
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
    compress: true,
  });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const rowHeight = 48;
  const firstPageCapacity = Math.max(
    3,
    Math.floor((height - 58 - 252 - 30) / rowHeight),
  );
  const laterPageCapacity = Math.max(
    5,
    Math.floor((height - 58 - 132 - 30) / rowHeight),
  );

  const pages: MerchantStatementRow[][] = [];
  pages.push(payload.rows.slice(0, firstPageCapacity));
  for (
    let index = firstPageCapacity;
    index < payload.rows.length;
    index += laterPageCapacity
  ) {
    pages.push(payload.rows.slice(index, index + laterPageCapacity));
  }
  if (!pages.length) pages.push([]);

  pages.forEach((pageRows, index) => {
    if (index > 0) doc.addPage("a4", "landscape");
    const rendered = drawPage(
      payload,
      logo,
      pageRows,
      index + 1,
      pages.length,
      width,
      height,
    );
    doc.addImage(
      rendered.canvas.toDataURL("image/jpeg", 0.94),
      "JPEG",
      0,
      0,
      width,
      height,
      undefined,
      "FAST",
    );
    rendered.links.forEach((link) =>
      doc.link(link.x, link.y, link.width, link.height, { url: link.url }),
    );
  });

  doc.setProperties({
    title: `${payload.language === "ar" ? "كشف التاجر" : "Merchant statement"} - ${payload.merchant.tradeName}`,
    subject: payload.periodLabel,
    author: payload.generatedBy || "DAY NIGHT DELIVERY SERVICES",
    creator: "DAY NIGHT Admin Operations",
  });
  doc.save(`${safeFileName(payload)}.pdf`);
}
