import React from "react";
import { Bell, ChevronDown, Grid2X2, Headphones, Home, MapPin, MessageCircle, Package, Star, Truck } from "lucide-react";
import "../../styles/dn-admin-dashboard-v3.css";

const LOGO_SRC = "/assets/daynight/admin-auth-v3/logo-glass.png";
const KHALIFA_SRC = "/assets/daynight/admin-auth-v3/khalifa-card-reference.png";
const MAP_SRC = "/assets/daynight/admin-auth-v3/admin-map.png";

function LeftPanel() {
  return <aside className="dn-admin-dashboard-v3__left-panel"><div className="dn-admin-dashboard-v3__user-row"><img src={KHALIFA_SRC} alt="أبو خليفة" /><div><strong>أبو خليفة</strong><span>مدير النظام</span></div><ChevronDown /><Bell /></div><section className="dn-admin-dashboard-v3__khalifa-card"><div className="dn-admin-dashboard-v3__speech-bubble">أهلاً يا أبو خليفة</div><img src={KHALIFA_SRC} alt="خليفة" className="dn-admin-dashboard-v3__khalifa-image" /><h2>خليفة</h2><p>مساعدك الذكي</p><span>تحت أمرك يا أبو خليفة، كيف أقدر أساعدك اليوم؟</span><button type="button">اسألني أي شيء</button></section><section className="dn-admin-dashboard-v3__help-card"><Headphones /><h3>مساعدة</h3><strong>سيظهر المحتوى هنا</strong></section></aside>;
}

function HomeMap() {
  return <section className="dn-admin-dashboard-v3__map-card"><div className="dn-admin-dashboard-v3__map-head"><div><h2>تتبع الشحنة</h2><p>تابع شحنتك لحظة بلحظة</p></div><Truck /></div><div className="dn-admin-dashboard-v3__map-viewport"><img src={MAP_SRC} alt="خريطة تتبع الشحنة" /><div className="dn-admin-dashboard-v3__status dn-admin-dashboard-v3__status--pickup"><strong>نقطة الاستلام</strong><span>تم استلام الشحنة</span><MapPin /></div><div className="dn-admin-dashboard-v3__status dn-admin-dashboard-v3__status--moving"><strong>جاري التوصيل</strong><span>الشحنة في الطريق إليك</span><Star /></div><div className="dn-admin-dashboard-v3__status dn-admin-dashboard-v3__status--dropoff"><strong>نقطة التسليم</strong><span>الشحنة في طريقها إليك</span><Star /></div><div className="dn-admin-dashboard-v3__van"><Truck /></div></div></section>;
}

function Sidebar() {
  const items = ["لوحة التحكم", "إضافة طلب جديد", "إضافة تاجر", "التجار", "كافة الطلبات", "الطلبات الملغية", "الطلبات قيد المراجعة", "الطلبات المؤجلة", "الطلبات الراجعة", "طلبات أبوظبي", "التقارير", "الإعدادات", "الدعم الفني"];
  return <aside className="dn-admin-dashboard-v3__sidebar"><img src={LOGO_SRC} alt="DAY NIGHT" /><nav>{items.map((item, index) => <button type="button" className={index === 0 ? "is-active" : ""} key={item}><Home /><span>{item}</span></button>)}</nav></aside>;
}

export default function AdminDashboardHomeV3() {
  return <section className="dn-admin-dashboard-v3" dir="rtl"><div className="dn-admin-dashboard-v3__layout"><LeftPanel /><main className="dn-admin-dashboard-v3__main"><header className="dn-admin-dashboard-v3__header"><div><h1>مرحباً بك في مركز القيادة</h1><p>تحكم كامل بشحناتك من نقطة إلى نقطة</p></div><Grid2X2 /></header><HomeMap /><section className="dn-admin-dashboard-v3__bottom-cards">{["آخر التحديثات", "معلومات الشحنة", "تفاصيل الشحنة", "مساعدة سريعة"].map((title) => <article key={title}><MessageCircle /><h3>{title}</h3><strong>لا توجد بيانات حالياً</strong><span>سيظهر المحتوى هنا</span></article>)}</section></main><Sidebar /></div></section>;
}
