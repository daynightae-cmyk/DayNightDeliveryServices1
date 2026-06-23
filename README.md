# DAY NIGHT DELIVERY SERVICES

منصة توصيل وشحن احترافية في الإمارات العربية المتحدة

## نظرة عامة

مشروع React + Vite + TypeScript لبناء موقع شركة توصيل وشحن متقدم مع:
- واجهة مستخدم فاخرة (Glassmorphism)
- دعم كامل للعربية والإنجليزية (RTL/LTR)
- أوضاع ليلية/نهارية/تلقائية
- تكامل مع Supabase للبيانات
- تتبع الشحنات
- طلب توصيل إلكتروني
- لوحة إدارة
- معرض صور
- فواتير وQR Codes

## البدء السريع

### المتطلبات

- Node.js 18+
- npm أو yarn
- حساب Supabase (اختياري للتشغيل المحلي بدون backend)

### التثبيت

```bash
npm install
```

### إعداد متغيرات البيئة

انسخ `.env.example` إلى `.env`:

```bash
cp .env.example .env
```

ثم عدل القيم في `.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### التشغيل المحلي

```bash
npm run dev
```

يفتح على: http://localhost:3000

### البناء للإنتاج

```bash
npm run build
npm run preview
```

### التحقق من الكود

```bash
npm run lint
```

## البنية

```
src/
├── components/       # مكونات React
│   ├── home/        # مكونات الصفحة الرئيسية
│   ├── tracking/    # مكونات التتبع
│   ├── ui/          # مكونات الواجهة العامة
│   └── *.tsx        # صفحات ومكونات أخرى
├── data/            # بيانات الترجمة والمحتوى
├── lib/             # دوال مساعدة وContext
├── ui/              # مكونات UI إضافية
├── App.tsx          # المكون الرئيسي والتوجيه
├── main.tsx         # نقطة الدخول
├── supabase.ts      # إعدادات Supabase
└── types.ts         # تعريفات TypeScript
```

## الميزات الرئيسية

### 🎨 الثيم والهوية
- **الوضع الليلي**: Navy/Gold/Blue مع Glassmorphism
- **الوضع النهاري**: Light Premium مع الحفاظ على الهوية
- **الوضع التلقائي**: يتبع نظام الجهاز
- شعار رسمي موحد في كل الصفحات

### 🌐 اللغة
- العربية (RTL)
- الإنجليزية (LTR)
- تبديل سلس دون إعادة تحميل

### 📦 الخدمات
- التوصيل المحلي داخل الإمارات
- الشحن الدولي (GCC و Worldwide)
- خدمات التجارة الإلكترونية
- حلول الشركات والعقود

### 🔍 التتبع
- تتبع الشحنات برقم التتبع
- عرض حالة الشحنة
- خريطة المسار
- سجل الحالات

### 📝 طلب التوصيل
- نموذج متعدد الخطوات
- حساب السعر التقريبي
- إرسال الطلب إلى Supabase
- توليد رقم تتبع

### 👤 لوحات التحكم
- لوحة الإدارة (Admin Panel)
- لوحة العميل (Customer Dashboard)
- لوحة السائق (Driver Dashboard)

## Supabase Setup

راجع ملف `SUPABASE_SETUP.md` لتفاصيل إعداد قاعدة البيانات.

## النشر

### Vercel

```bash
vercel deploy
```

تأكد من إضافة متغيرات البيئة في لوحة تحكم Vercel.

### استضافة ثابتة أخرى

استخدم مجلد `dist/` بعد البناء.

## الترخيص

Apache-2.0

---

**DAY NIGHT DELIVERY SERVICES**  
مussafah 40, Abu Dhabi, UAE  
+971 56 875 7331
