/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Phone, 
  Mail, 
  MapPin, 
  Facebook, 
  Instagram, 
  MessageSquare, 
  ExternalLink,
  CheckCircle,
  Clock
} from "lucide-react";
import companyMeta from '../data/companyMeta';
import { useLanguage } from '../context/LanguageContext';

export default function ContactUs() {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    subject: "general",
    message: ""
  });
  const [submitted, setSubmitted] = useState(false);

  const { lang } = useLanguage();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Simulate beautiful submission adding to local list or simply notifying the client
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({
        name: "",
        phone: "",
        email: "",
        subject: "general",
        message: ""
      });
    }, 4000);
  }

  const socialLinks = [
    {
      name: "فيسبوك Facebook",
      url: companyMeta.socials.facebook,
      icon: <Facebook className="w-5 h-5 text-blue-600" />
    },
    {
      name: "إنستغرام Instagram",
      url: companyMeta.socials.instagram,
      icon: <Instagram className="w-5 h-5 text-pink-600" />
    },
    {
      name: "تيك توك TikTok",
      url: companyMeta.socials.tiktok,
      icon: <MessageSquare className="w-5 h-5 text-slate-800" />
    }
  ];

  return (
    <div className="space-y-12">
      {/* Header */}
      <section className="text-center max-w-2xl mx-auto space-y-4">
        <span className="bg-brand-gold/10 text-brand-gold text-xs px-3.5 py-1 rounded-full font-bold uppercase font-sans tracking-widest inline-block">
          Get In Touch • تواصل معنا مباشرة
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
          نحن هنا لخدمتك والرد على استفسارك
        </h2>
        <p className="text-white/60 text-sm">
          نعمل طوال ساعات الليل والنهار لتلبية طلبات التوصيل والشحن للأفراد والمتاجر والشركات. اختر القناة المناسبة وسيصلك ردنا الفوري بلمح البصر.
        </p>
      </section>

      {/* Main Grid splitting info and form */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Contact Info Block */}
        <div className="lg:col-span-12 xl:col-span-5 space-y-6">
          <div className="bg-brand-cool/30 rounded-3xl p-6 sm:p-8 border border-white/10 space-y-6">
            <h3 className="text-xl font-bold text-white border-b border-white/10 pb-3">قنوات الاتصال المباشرة</h3>
            
            <div className="space-y-5">
              {/* Phone */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5 text-brand-gold" />
                </div>
                <div>
                  <p className="text-white/40 text-xs font-bold font-sans">رقم الهاتف الرسمي والطلب</p>
                  <a href={`tel:${companyMeta.phone}`} className="text-white font-extrabold text-base hover:text-brand-gold mt-0.5 inline-block font-sans">
                    {companyMeta.phone}
                  </a>
                </div>
              </div>

              {/* Whatsapp */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-white/40 text-xs font-bold font-sans">تواصل سريع عبر واتساب</p>
                  <a 
                    href={companyMeta.whatsapp} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    referrerPolicy="no-referrer"
                    className="text-emerald-400 font-extrabold text-base hover:underline mt-0.5 inline-block font-sans"
                  >
                    {companyMeta.whatsapp}
                  </a>
                </div>
              </div>

              {/* Whatsapp Catalog */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center shrink-0">
                  <ExternalLink className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-white/40 text-xs font-bold font-sans">عرض كتالوج الخدمات والأسعار</p>
                  <a 
                    href={companyMeta.whatsappCatalog} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    referrerPolicy="no-referrer"
                    className="text-amber-400 font-extrabold text-base hover:underline mt-0.5 inline-block font-sans"
                  >
                    عرض كتالوج واتساب / View WhatsApp Catalog
                  </a>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-brand-gold" />
                </div>
                <div>
                  <p className="text-white/40 text-xs font-bold font-sans">البريد الإلكتروني المعتمد</p>
                  <a href={`mailto:${companyMeta.email}`} className="text-white font-bold text-sm hover:text-brand-gold mt-0.5 inline-block font-sans leading-none">
                    {companyMeta.email}
                  </a>
                </div>
              </div>

              {/* Address */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-brand-gold" />
                </div>
                <div>
                  <p className="text-white/40 text-xs font-bold font-sans">العنوان الرسمي للمقر</p>
                  <p className="text-white/80 font-bold text-sm leading-relaxed mt-0.5">
                    {companyMeta.addressEn} <br />
                    {companyMeta.addressAr}
                  </p>
                  <a
                    href={companyMeta.mapUrl}
                    target="_blank"
                    referrerPolicy="no-referrer"
                    className="text-brand-gold font-bold text-xs mt-1.5 inline-flex items-center gap-1 hover:underline"
                  >
                    <span>{lang === 'ar' ? 'افتح مقرنا على خرائط جوجل' : 'Open our location on Google Maps'}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Social Profiles Card */}
          <div className="bg-brand-cool/30 rounded-3xl p-6 border border-white/10 space-y-4">
            <h4 className="font-bold text-white text-md">حسابات التواصل الاجتماعي</h4>
            <div className="flex flex-col gap-2.5">
              {socialLinks.map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  referrerPolicy="no-referrer"
                  className="flex items-center justify-between p-3.5 bg-brand-deep/60 hover:bg-white/5 rounded-xl border border-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {s.icon}
                    <span className="text-sm font-semibold text-white/80">{s.name}</span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-white/40" />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Contact Form Block */}
        <div className="lg:col-span-12 xl:col-span-7 bg-brand-cool/30 rounded-3xl p-6 sm:p-8 border border-white/10 space-y-6">
          <div className="border-b border-white/10 pb-3">
            <h3 className="text-xl font-bold text-white">أرسل استفسارك إلينا مباشرة</h3>
            <p className="text-white/40 text-xs mt-0.5 leading-normal">املأ الاستمارة وسنقوم بدراسة استفسارك والتواصل معك هاتفياً في غضون وقت قصير.</p>
          </div>

          {submitted ? (
            <div className="p-8 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-center space-y-3">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
              <h4 className="text-emerald-300 font-bold text-lg">شكرًا لتواصلك معنا!</h4>
              <p className="text-white/80 text-sm">تم استلام استفسارك بنجاح. سيقوم فريق داي نايت للتوصيل بمراجعته والرد عليك قريباً.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-right">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-white/75 text-xs font-bold font-sans">الاسم الكامل *</label>
                  <input
                    id="contact_input_name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="مثال: محمد المرزوقي"
                    className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep text-right"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-white/75 text-xs font-bold font-sans">رقم الهاتف *</label>
                  <input
                    id="contact_input_phone"
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="مثال: +971 56 875 7331"
                    className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-white/75 text-xs font-bold font-sans">البريد الإلكتروني (اختياري)</label>
                  <input
                    id="contact_input_email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="example@mail.com"
                    className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep text-right"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-white/75 text-xs font-bold font-sans">نوع الاستفسار</label>
                  <select
                    id="contact_input_subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep [color-scheme:dark] select-none text-right"
                  >
                    <option value="general">استفسار عام / أسعار الأسئلة</option>
                    <option value="merchant">حساب تاجر أو متجر إلكتروني</option>
                    <option value="corporate">خدمات وعقود الشركات والمؤسسات</option>
                    <option value="international">شحن دولي خارجي</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-white/75 text-xs font-bold font-sans">نص الرسالة والاستفسار بالتفصيل *</label>
                <textarea
                  id="contact_input_message"
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="اكتب هنا كافة تفاصيل استفسارك أو طرودك..."
                  className="w-full bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-deep text-right"
                ></textarea>
              </div>

              <div className="pt-2 text-left">
                <button
                  id="contact_submit_btn"
                  type="submit"
                  className="px-8 py-3.5 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white font-extrabold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  إرسال الرسالة للمراجعة
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
