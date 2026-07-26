import type { Plugin } from "vite";

function replaceRequired(
  source: string,
  pattern: string | RegExp,
  replacement: string,
  label: string,
) {
  const next = source.replace(pattern, replacement);
  if (next === source) {
    throw new Error(`DAY NIGHT merchant statement layout could not apply: ${label}`);
  }
  return next;
}

const statementSummaryFunctions = `function drawStatementSummary(
  ctx: CanvasRenderingContext2D,
  payload: MerchantStatementPayload,
  width: number,
  y: number,
) {
  const isArabic = payload.language === "ar";
  const margin = 22;
  const gap = 10;
  const totals = [
    [
      isArabic ? "قيمة البضاعة" : "Goods value",
      money(payload.totals.goodsValue, payload.language),
    ],
    [
      isArabic ? "رسوم التوصيل" : "Delivery fees",
      money(payload.totals.deliveryFees, payload.language),
    ],
    [
      isArabic ? "الصافي" : "Net",
      money(payload.totals.merchantBalance, payload.language),
    ],
  ];

  const cardWidth = (width - margin * 2 - gap * 2) / 3;
  totals.forEach(([label, value], index) => {
    const x = isArabic
      ? width - margin - cardWidth - index * (cardWidth + gap)
      : margin + index * (cardWidth + gap);

    roundedRect(ctx, x, y, cardWidth, 46, 11);
    ctx.fillStyle = index === 2 ? "#fff9df" : "#ffffff";
    ctx.fill();
    ctx.strokeStyle = index === 2 ? "#d4af37" : "#dce3ec";
    ctx.lineWidth = index === 2 ? 1.5 : 1;
    ctx.stroke();

    setFont(ctx, 8, "900", "#926f00");
    ctx.textAlign = "center";
    ctx.direction = isArabic ? "rtl" : "ltr";
    ctx.fillText(label, x + cardWidth / 2, y + 14, cardWidth - 14);

    setFont(
      ctx,
      11,
      "900",
      index === 2 && payload.totals.merchantBalance < 0 ? "#b42318" : "#0b172a",
    );
    ctx.direction = isArabic ? "rtl" : "ltr";
    ctx.fillText(
      fitSingleLine(ctx, value, cardWidth - 16),
      x + cardWidth / 2,
      y + 32,
      cardWidth - 16,
    );
  });

  return 46;
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

  roundedRect(ctx, margin, y, width - margin * 2, 30, 9);
  ctx.fillStyle = "#fff9df";
  ctx.fill();
  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  setFont(ctx, 8.5, "900", "#6f5200");
  ctx.textAlign = "center";
  ctx.direction = isArabic ? "rtl" : "ltr";
  ctx.fillText(notice, width / 2, y + 15, width - margin * 2 - 18);

  return 30;
}`;

export function merchantStatementLayoutPlugin(): Plugin {
  return {
    name: "day-night-merchant-statement-bottom-summary-v1",
    enforce: "pre",
    transform(source, id) {
      const normalized = id.replace(/\\/g, "/").split("?")[0];

      if (normalized.endsWith("/src/components/admin/AdminMerchantStatementsCenter.tsx")) {
        const code = replaceRequired(
          source,
          '        date: clean(order.delivery_date || order.created_at).slice(0, 10) || "—",\n        customerTotal: customerValue(order),',
          '        date: clean(order.delivery_date || order.created_at).slice(0, 10) || "—",\n        goodsValue: goodsValue(order),\n        customerTotal: customerValue(order),',
          "database goods value included in exported statement rows",
        );
        return { code, map: null };
      }

      if (normalized.endsWith("/src/lib/merchantStatementExport.ts")) {
        let code = source;

        code = replaceRequired(
          code,
          /function drawTotals\([\s\S]*?\n\}\n\nfunction drawTable\(/,
          `${statementSummaryFunctions}\n\nfunction drawTable(`,
          "replace five top totals with three bottom summary cards",
        );

        code = replaceRequired(
          code,
          /  return links;\n\}\n\nfunction drawFooter\(/,
          `  return { links, endY: y };\n}\n\nfunction drawFooter(`,
          "return table ending position",
        );

        code = replaceRequired(
          code,
          `    drawMerchantCard(ctx, payload, width);\n    drawTotals(ctx, payload, width);\n    tableY = 252;`,
          `    drawMerchantCard(ctx, payload, width);\n    tableY = 202;`,
          "move table upward after removing top summary",
        );

        code = replaceRequired(
          code,
          `  const tableLinks = drawTable(ctx, payload, rows, width, tableY);\n  const footerLinks = drawFooter(ctx, payload, width, height);\n  return { canvas, links: [...tableLinks, ...footerLinks] };`,
          `  const table = drawTable(ctx, payload, rows, width, tableY);\n\n  if (page === totalPages) {\n    const summaryY = table.endY + 12;\n    const summaryHeight = drawStatementSummary(ctx, payload, width, summaryY);\n    drawTransferNotice(ctx, payload, width, summaryY + summaryHeight + 10);\n  }\n\n  const footerLinks = drawFooter(ctx, payload, width, height);\n  return { canvas, links: [...table.links, ...footerLinks] };`,
          "render summary and transfer notice below final table",
        );

        code = replaceRequired(
          code,
          `  const rowHeight = 48;\n  const firstPageCapacity = Math.max(\n    3,\n    Math.floor((height - 58 - 252 - 30) / rowHeight),\n  );\n  const laterPageCapacity = Math.max(\n    5,\n    Math.floor((height - 58 - 132 - 30) / rowHeight),\n  );`,
          `  const rowHeight = 48;\n  const finalSectionHeight = 112;\n  const firstPageCapacity = Math.max(\n    3,\n    Math.floor((height - 58 - 202 - 30 - finalSectionHeight) / rowHeight),\n  );\n  const laterPageCapacity = Math.max(\n    4,\n    Math.floor((height - 58 - 132 - 30 - finalSectionHeight) / rowHeight),\n  );`,
          "reserve final-page space below rows for summary and notice",
        );

        return { code, map: null };
      }

      return null;
    },
  };
}
