/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Building2, 
  FileText, 
  CheckCircle2, 
  Truck, 
  UserCheck, 
  TrendingDown, 
  Clock, 
  BadgeCheck,
  Send,
  MessageSquare,
  PhoneCall
} from "lucide-react";

export default function CorporateSolutions() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    companyName: "",
    contactPerson: "",
    phone: "",
    email: "",
    volume: "medium",
    notes: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName || !formData.phone) return;
    setSubmitted(true);
  };

  const benefits = [
    {
      icon: <FileText className="w-6 h-6 text-brand-gold" />,
      title_ar: "توصيل المستندات القانونية والعقود",
      title_en: "Legal & Corporate Documents",
      desc_ar: "نقل آمن وعاجل للمستندات الرسمية والأوراق الثبوتية والملفات الحكومية بين الفروع والوزارات بأعلى درجات السرية والتوقيع المعتمد.",
      desc_en: "Super secure & swift transport of legal files and government paperwork with proof of delivery."
    },
    {
      icon: <TrendingDown className="w-6 h-6 text-brand-gold" />,
      title_ar: "أسعار تفضيلية وعقود شهرية",
      title_en: "Corporate Rates & Monthly Billing",
      desc_ar: "خصومات حصرية للشركات ذات الأحجام الكبيرة من الطرود مع فوترة شهرية مرنة ونظام دفع آجل مع تزويدكم بتقارير تسليم مفصلة.",
      desc_en: "Competitive pricing tailored for scale, complete with periodic invoices and volume discounts."
    },
    {
      icon: <UserCheck className="w-6 h-6 text-brand-gold" />,
      title_ar: "مندوب مخصص وحصري لمؤسستك",
      title_en: "Dedicated Courier Agent",
      desc_ar: "نوفر لشركتك سائقاً ومندوباً خاصاً مدرباً على طبيعة عملك يتردد عليكم يومياً لاستلام وتسليم المعاملات دون تأخير.",
      desc_en: "A fully dedicated delivery representative stationed for your daily pick-up patterns."
    },
    {
      icon: <Clock className="w-6 h-6 text-brand-gold" />,
      title_ar: "أولوية استثنائية ودعم على مدار الساعة",
      title_en: "24/7 Priority Assistance",
      desc_ar: "فريق دعم مخصص للشركات المتعاقدة لمعالجة أي شحنة طارئة أو خاصة في أي وقت من الليل والنهار.",
      desc_en: "Round-the-clock professional coordination specifically for corporate contracts."
    }
  ];

  return (
    <div className="space-y-16 text-right">
      {/* Header */}
      <section className="text-center max-w-2xl mx-auto space-y-4">
        <span className="bg-brand-gold/10 text-brand-gold text-xs px-3.5 py-1 rounded-full font-bold uppercase font-sans tracking-widest inline-block">
          Corporate & Government Solutions • الشركات والعقود
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
          الحلول اللوجستية المتكاملة للشركات والجهات الحكومية
        </h2>
        <p className="text-white/60 text-sm">
          شريكك اللوجستي الموثوق في دولة الإمارات العربية المتحدة. نقدم عقوداً شهرية مرنة وأسطولاً مجهزاً لتلبية متطلبات أعمالكم بدقة فائقة.
        </p>
      </section>

      {/* Main Grid Content */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Benefits Block */}
        <div className="lg:col-span-12 xl:col-span-7 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {benefits.map((b, idx) => (
              <div id={`corp_benefit_${idx}`} key={idx} className="bg-brand-cool/30 p-6 rounded-2xl border border-white/10 space-y-4 hover:border-brand-gold/50 transition-all duration-300">
                <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center shrink-0">
                  {b.icon}
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white">{b.title_ar}</h3>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-wide font-mono">{b.title_en}</p>
                  <p className="text-white/70 text-sm leading-relaxed">{b.desc_ar}</p>
                  <p className="text-white/40 text-xs leading-relaxed italic">{b.desc_en}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Slogan strip */}
          <div className="bg-brand-cool/20 border border-white/10 p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-right">
              <h4 className="text-md font-bold text-white flex items-center justify-end gap-1.5">
                <span>متواجدون بمقرنا في أبوظبي لخدمة مكاتبكم</span>
                <Building2 className="w-5 h-5 text-brand-gold" />
              </h4>
              <p className="text-xs text-white/50">سجل معتمد، سيارات Toyota Rush بيضاء حديثة ومندوبين بالزي الرسمي.</p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <a 
                href="https://wa.me/971568757331" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-5 py-2.5 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white font-extrabold rounded-xl text-xs transition-colors shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <MessageSquare className="w-4 h-4" />
                <span>طلب مباشر عبر واتساب</span>
              </a>
              <a 
                id="corporate_whatsapp_catalog"
                href="https://wa.me/c/971568757331" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-xl text-xs transition-colors shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>عرض كتالوج واتساب</span>
              </a>
            </div>
          </div>
        </div>

        {/* Corporate Form Block */}
        <div className="lg:col-span-12 xl:col-span-5 bg-brand-cool/30 rounded-3xl p-6 sm:p-8 border border-white/10 space-y-6">
          <div className="border-b border-white/10 pb-3">
            <h3 className="text-xl font-bold text-white">طلب استشارة وعقد تجاري</h3>
            <p className="text-white/40 text-xs mt-0.5 leading-normal">املأ الاستمارة وسيجيبك أحد مسؤولي الحسابات التجارية بعرض مالي ملائم.</p>
          </div>

          {submitted ? (
            <div className="p-8 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-center space-y-3">
              <BadgeCheck className="w-12 h-12 text-emerald-400 mx-auto" />
              <h4 className="text-emerald-300 font-bold text-lg">وصلنا طلبك بنجاح!</h4>
              <p className="text-white/80 text-sm">سيتم مراجعة استفسارك وقدر الطرود الخاص بجهتكم وإرسال مسودة تسعير وعقد في أقرب وقت.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-right">
              <div className="space-y-1.5">
                <label className="text-white/75 text-xs font-bold">اسم الشركة أو الجهة الحكومية *</label>
                <input
                  id="corp_input_company"
                  type="text"
                  required
                  placeholder="مثال: شركة أبوظبي للاستثمار"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep text-right"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-white/75 text-xs font-bold">مسؤول التواصل والتعاقد</label>
                <input
                  id="corp_input_person"
                  type="text"
                  placeholder="الاسم الكامل"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep text-right"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-white/75 text-xs font-bold">رقم الهاتف للاتصال المباشر *</label>
                  <input
                    id="corp_input_phone"
                    type="tel"
                    required
                    placeholder="+971 50 XXXXXXX"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep text-right"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-white/75 text-xs font-bold">البريد الإلكتروني للجهة</label>
                  <input
                    id="corp_input_email"
                    type="email"
                    placeholder="example@domain.ae"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep text-right"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-white/75 text-xs font-bold">الحجم التقريبي للطرود / المستندات شهرياً</label>
                <select
                  id="corp_input_volume"
                  value={formData.volume}
                  onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep [color-scheme:dark] select-none text-right"
                >
                  <option value="low">أقل من 100 طرد شهرياً</option>
                  <option value="medium">من 100 إلى 500 طرد شهرياً</option>
                  <option value="high">أكثر من 500 طرد شهرياً</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-white/75 text-xs font-bold">متطلبات طرودكم الخاصة</label>
                <textarea
                  id="corp_input_notes"
                  placeholder="مثال: خدمات استلام الأوراق الحكومية والتوقيع المعتمد، شحنات ليلية عاجلة..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep text-right min-h-[80px]"
                ></textarea>
              </div>

              <button
                id="corp_submit_btn"
                type="submit"
                className="w-full sm:w-auto px-8 py-3.5 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white font-black rounded-xl text-xs transition-colors cursor-pointer text-center"
              >
                إرسال عرض التعاقد
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
