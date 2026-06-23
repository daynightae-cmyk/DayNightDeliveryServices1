# دليل النشر - DAY NIGHT DELIVERY SERVICES

## متطلبات ما قبل النشر

### 1. متغيرات البيئة الإلزامية

يجب إعداد المتغيرات التالية في منصة الاستضافة:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 2. التحقق من البناء

قبل النشر، تأكد من نجاح البناء محليًا:

```bash
npm install
npm run lint    # يجب أن ينجح بدون أخطاء
npm run build   # يجب أن ينتج مجلد dist/
```

## النشر على Vercel

### الخطوة 1: ربط المستودع

```bash
vercel login
vercel link
```

### الخطوة 2: إضافة متغيرات البيئة

في لوحة تحكم Vercel:
1. اذهب إلى Project Settings > Environment Variables
2. أضف:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

### الخطوة 3: النشر

```bash
vercel --prod
```

### إعدادات Vercel الموصى بها

أنشئ ملف `vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    }
  ]
}
```

## النشر على Netlify

### الخطوة 1: الإعدادات الأساسية

Build Command: `npm run build`  
Publish Directory: `dist`

### الخطوة 2: متغيرات البيئة

أضف في Netlify Dashboard > Site Settings > Build & Deploy > Environment:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### الخطوة 3: إعداد ملف `_redirects`

أنشئ `public/_redirects`:

```
/*    /index.html   200
```

## النشر على استضافة ثابتة أخرى

### الخطوة 1: البناء

```bash
npm run build
```

### الخطوة 2: رفع مجلد dist

ارفع محتويات مجلد `dist/` إلى خادم الويب الخاص بك.

### الخطوة 3: إعداد إعادة التوجيه

تأكد من إعادة توجيه جميع الطلبات إلى `index.html` لتعمل React Router.

#### Apache (.htaccess)

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

#### Nginx

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

## Supabase Production Setup

راجع `SUPABASE_SETUP.md` للحصول على تفاصيل إعداد قاعدة البيانات.

### خطوات مهمة:

1. **تفعيل RLS** على جميع الجداول الحساسة
2. **إنشاء Policies** للـ anon users
3. **اختبار RPC functions** قبل النشر
4. **تخزين المفاتيح السرية** في Supabase Dashboard فقط

## التحقق بعد النشر

### قائمة التحقق:

- [ ] الصفحة الرئيسية تعمل
- [ ] تبديل اللغة يعمل (AR/EN)
- [ ] تبديل الثيم يعمل (Dark/Light/System)
- [ ] صفحة التتبع تعمل
- [ ] نموذج طلب التوصيل يرسل البيانات
- [ ] لوحة الإدارة يمكن الوصول إليها
- [ ] الصور والمعرض يحملان بشكل صحيح
- [ ] QR Code يولد بشكل صحيح
- [ ] الفواتير تعرض بشكل صحيح
- [ ] Mobile responsive يعمل
- [ ] لا توجد أخطاء في Console

### اختبار الأداء

استخدم أدوات مثل:
- Google PageSpeed Insights
- Lighthouse
- WebPageTest

## استكشاف الأخطاء

### البناء يفشل

```bash
# امسح cache وأعد البناء
rm -rf node_modules dist package-lock.json
npm install
npm run build
```

### مشاكل Supabase

تحقق من:
- صحة URL و Key
- اتصال الشبكة
- RLS Policies
- وجود الجداول المطلوبة

### مشاكل الثيم

تأكد من:
- تطبيق كلاسات `dark-theme` / `light-theme` على `document.documentElement`
- وجود CSS variables المعرفة
- عدم وجود تعارض في Tailwind config

## التحديثات

للحصول على تحديثات آمنة:

1. اختبر التغييرات محليًا أولاً
2. انشر على Preview Deployment
3. اختبر على Preview
4. انشر للإنتاج

## الدعم

للدعم الفني، تواصل عبر:
- Email: Admin@daynightae.com
- Phone: +971 56 875 7331
