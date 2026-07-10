import { useMemo, useState, type FormEvent, type ChangeEvent } from "react";
import { Send, Trash2 } from "lucide-react";
import type { Merchant, Order } from "../../types";
import type { FinanceSummary } from "../../lib/adminData";
import { deriveCommandMetrics } from "../../data/adminCommandExpansion";

type Props = { orders: Order[]; merchants: Merchant[]; financeSummary?: FinanceSummary | null; activeSection?: string; isArabic: boolean };
type ChatItem = { id: string; question: string; answer: string };
const money = (v: unknown) => `${Number(v || 0).toFixed(2)} AED`;
const norm = (v: unknown) => String(v || "").toLowerCase();
const revenue = (o: Order) => Number(o.delivery_price || o.price || o.base_price || 0);
const cod = (o: Order) => Number(o.cod_amount || 0);
const merchantName = (m?: Merchant) => m?.trade_name || m?.owner_name || m?.merchant_code || (m?.id ? `#${m.id}` : "—");

function answer(question: string, props: Props): string {
  const { orders, merchants, financeSummary, isArabic, activeSection } = props;
  const q = norm(question);
  const metrics = deriveCommandMetrics(orders, merchants, financeSummary);
  const delivered = orders.filter((o) => /deliver|complete/.test(norm(o.status)));
  const unassigned = orders.filter((o) => !o.driver_code && !o.driver_name && !o.driver_phone);
  const pendingCod = orders.filter((o) => cod(o) > 0 && !/deliver|complete|reconcile|collect/.test(norm(o.status))).reduce((s, o) => s + cod(o), 0);
  const collectedCod = delivered.reduce((s, o) => s + cod(o), 0);
  const byMerchant = new Map<string, number>();
  orders.forEach((o) => byMerchant.set(o.merchant_id || o.merchant_name || "unknown", (byMerchant.get(o.merchant_id || o.merchant_name || "unknown") || 0) + 1));
  const [topMerchantId = "unknown", topMerchantCount = 0] = [...byMerchant.entries()].sort((a, b) => b[1] - a[1])[0] || [];
  const topMerchant = merchants.find((m) => m.id === topMerchantId || m.trade_name === topMerchantId);
  const byCity = new Map<string, number>();
  orders.forEach((o) => byCity.set(o.receiver_city || o.sender_city || "—", (byCity.get(o.receiver_city || o.sender_city || "—") || 0) + 1));
  const [topRoute = "—", topRouteCount = 0] = [...byCity.entries()].sort((a, b) => b[1] - a[1])[0] || [];
  const expenseTotal = Number(financeSummary?.total_expenses || 0);
  const adjustmentNet = 0;
  const grossRevenue = orders.reduce((s, o) => s + revenue(o), 0);
  const net = Number(financeSummary?.net_estimate ?? (grossRevenue - expenseTotal + adjustmentNet));
  const unreconciledCod = Math.max(0, collectedCod - Number(financeSummary?.cod_reconciled || 0));
  const pendingReviewOrders = orders.filter((o) => /review|confirm|hold|pending/.test(norm(o.status))).length;
  const expensesPending = expenseTotal > 0 ? 0 : 0;
  const closingStatus = net < 0 ? (isArabic ? "خطر مالي — لا تغلق اليوم بعد" : "Financial risk — do not close yet") : (pendingCod > 0 || unreconciledCod > 0 || pendingReviewOrders > 0 || expensesPending > 0 ? (isArabic ? "يحتاج مراجعة قبل الإغلاق" : "Needs review before close") : (isArabic ? "جاهز للإغلاق" : "Ready to close"));
  const nextAction = pendingCod > 0 || unreconciledCod > 0 ? (isArabic ? "افتح التحصيل وسوِّ COD قبل الإغلاق." : "Open COD reconciliation before closing.") : pendingReviewOrders > 0 ? (isArabic ? "افتح الطلبات قيد المراجعة." : "Open pending review orders.") : net < 0 ? (isArabic ? "راجع المصروفات والدخل قبل الإغلاق." : "Review expenses and income before closing.") : (isArabic ? "صدّر تقرير الإغلاق وعلّم اليوم كمراجع." : "Export the closing report and mark the day reviewed.");

  if (/close|closing|أقفل|اغلاق|إغلاق|سبب عدم|why should/.test(q)) return isArabic ? `حالة الإغلاق: ${closingStatus}. COD المتبقي ${money(pendingCod)}، COD غير مسوى ${money(unreconciledCod)}، مصروفات بانتظار الاعتماد ${expensesPending}، وطلبات تحتاج مراجعة ${pendingReviewOrders}. الإجراء المقترح: ${nextAction}` : `Closing status: ${closingStatus}. Pending COD ${money(pendingCod)}, unreconciled COD ${money(unreconciledCod)}, expenses pending approval ${expensesPending}, and pending review orders ${pendingReviewOrders}. Recommended next action: ${nextAction}`;
  if (/pending cod|cod المتبقي|كم cod|كم التحصيل/.test(q)) return isArabic ? `COD المتبقي ${money(pendingCod)} وCOD غير مسوى ${money(unreconciledCod)}. حالة الإغلاق: ${closingStatus}. الإجراء المقترح: ${nextAction}` : `Pending COD is ${money(pendingCod)} and unreconciled COD is ${money(unreconciledCod)}. Closing status: ${closingStatus}. Recommended next action: ${nextAction}`;

  if (/unreconciled|غير مسو|غير مسوّى|معلق|pending|تحصيل/.test(q)) return isArabic ? `إجمالي COD المعلق حالياً هو ${money(pendingCod)}. الأولوية: راجع كشوفات المناديب غير المسوية قبل إغلاق اليوم.` : `Unreconciled COD is ${money(pendingCod)} across related order rows. Review driver statements and COD collection first.`;
  if (/collected|محصل|محصّل/.test(q)) return isArabic ? `COD المحصّل تقديرياً من الطلبات المسلّمة هو ${money(collectedCod)}. راجع التسوية قبل اعتماد الإقفال.` : `Estimated collected COD from delivered orders is ${money(collectedCod)}. Reconcile before closing.`;
  if (/تاجر|merchant|top/.test(q)) return isArabic ? `أكثر تاجر نشاطاً هو ${merchantName(topMerchant) || topMerchantId} بعدد ${topMerchantCount} طلب. افتح كشوفات التجار لمراجعة الرصيد.` : `Top merchant is ${merchantName(topMerchant) || topMerchantId} with ${topMerchantCount} orders. Open merchant statements to review balance.`;
  if (/مندوب|driver|unassigned|بدون/.test(q)) return isArabic ? `يوجد ${unassigned.length} طلب بدون مندوب واضح. افتح التوزيع وكشوفات المناديب قبل ذروة التسليم.` : `${unassigned.length} orders have no clear driver. Open dispatch and driver statements before the delivery peak.`;
  if (/أبوظبي|abu dhabi/.test(q)) return isArabic ? `طلبات أبوظبي/المناطق المرتبطة: ${orders.filter((o) => /abu|dhabi|أبوظبي|العين|mussafah/i.test(`${o.sender_city} ${o.receiver_city}`)).length}. راقب التأخير وCOD حسب المنطقة.` : `Abu Dhabi related orders: ${orders.filter((o) => /abu|dhabi|al ain|mussafah/i.test(`${o.sender_city} ${o.receiver_city}`)).length}. Watch delays and COD by area.`;
  if (/expense|مصروف|adjust|تسوية/.test(q)) return isArabic ? `المصروفات ${money(expenseTotal)} وصافي التسويات ${money(adjustmentNet)}. لا تعتمد أي مصروف بدون مرجع وتاريخ.` : `Expenses are ${money(expenseTotal)} and net adjustments are ${money(adjustmentNet)}. Do not approve expenses without reference and date.`;
  if (/break|net|ربح|خسارة|صافي/.test(q)) return isArabic ? `صافي التشغيل التقديري ${money(net)} من دخل ${money(grossRevenue)} ناقص مصروفات ${money(expenseTotal)} مع التسويات. الحالة: ${net >= 0 ? "فوق نقطة التعادل" : "تحت نقطة التعادل"}.` : `Estimated net is ${money(net)} from ${money(grossRevenue)} revenue minus ${money(expenseTotal)} expenses plus adjustments. Status: ${net >= 0 ? "above break-even" : "below break-even"}.`;
  if (/route|area|منطقة|مسار/.test(q)) return isArabic ? `أعلى منطقة/مسار حالياً: ${topRoute} بعدد ${topRouteCount} طلب. استخدم فلتر المنطقة لتقليل زمن الرحلات.` : `Top route/area is ${topRoute} with ${topRouteCount} orders. Use the area filter to reduce route time.`;
  if (/print|import|audit|طباعة|استيراد|تدقيق/.test(q)) return isArabic ? `الأدوات التشغيلية تعمل كمعاينات آمنة عند غياب الجداول: الاستيراد لا ينشئ طلبات قبل التأكيد، والطباعة تنشئ طابور مهام، والتدقيق يعرض أحداثاً منسقة بدون JSON خام.` : `Operational tools use safe previews when tables are unavailable: imports do not create orders before confirmation, print creates queued jobs, and audit is formatted without raw JSON.`;
  return isArabic ? `ملخص ${activeSection || "الإدارة"}: ${metrics.orders} طلب، ${metrics.active} نشط، ${metrics.delivered} مسلّم، COD معلق ${money(metrics.codPending)}، والمخاطر الأهم هي التأخير والطلبات غير المعينة.` : `${activeSection || "Admin"} summary: ${metrics.orders} orders, ${metrics.active} active, ${metrics.delivered} delivered, pending COD ${money(metrics.codPending)}, with main risks in delays and unassigned work.`;
}

export default function KhalifaLiveAssistant(props: Props) {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(false);
  const latest = history[0]?.answer;
  const hint = props.isArabic ? "اسأل خليفة عن التحصيل، المناديب، المصروفات، التجار..." : "Ask Khalifa about COD, drivers, expenses, merchants...";
  const note = props.isArabic ? "الإجابة مبنية على البيانات المحملة حالياً" : "Answer is based on currently loaded data";
  const examples = useMemo(() => { const base = props.isArabic ? ["هل أقدر أقفل اليوم؟", "كم COD المتبقي؟", "ما صافي اليوم؟", "افتح التحصيل", "افتح المصروفات", "ما سبب عدم إغلاق اليوم؟"] : ["Can I close today?", "What is pending COD?", "What is today's net?", "Open COD reconciliation", "Open expenses", "Why should I not close today?"]; const section = props.activeSection || ""; return /مصروف|expense/i.test(section) ? [base[5], base[4], base[1], ...base.slice(0,3)] : /تاجر|merchant/i.test(section) ? [base[2], base[0], base[4], ...base.slice(3,5)] : /مندوب|driver|pickup|إحضار/i.test(section) ? [base[3], base[0], base[1], ...base.slice(4)] : base; }, [props.isArabic, props.activeSection]);
  function askNow(text: string) { const trimmed = text.trim(); if (!trimmed) return; setLoading(true); window.setTimeout(() => { setHistory((items) => [{ id: `${Date.now()}`, question: trimmed, answer: answer(trimmed, props) }, ...items].slice(0, 6)); setQuestion(""); setLoading(false); }, 120); }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); askNow(question); }
  return <section className="dn-khalifa-live"><form onSubmit={submit}><label>{hint}</label><textarea value={question} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setQuestion(event.target.value)} placeholder={hint} rows={3} /><div className="dn-khalifa-live-actions"><button type="submit" disabled={loading}><Send className="h-4 w-4" />{loading ? (props.isArabic ? "يفكر..." : "Thinking...") : (props.isArabic ? "إرسال" : "Send")}</button><button type="button" onClick={() => setHistory([])}><Trash2 className="h-4 w-4" />{props.isArabic ? "مسح" : "Clear"}</button></div></form><small>{note}</small><div className="dn-khalifa-examples">{examples.map((item) => <button type="button" key={item} onClick={() => askNow(item)}>{item}</button>)}</div>{latest && <article className="dn-khalifa-answer"><strong>{props.isArabic ? "إجابة خليفة" : "Khalifa answer"}</strong><p>{latest}</p></article>}<ul>{history.slice(0, 4).map((item) => <li key={item.id}><b>{item.question}</b><span>{item.answer}</span></li>)}</ul></section>;
}
