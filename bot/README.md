# Agemera Messenger Bot

مشروع بوت شات بيشتغل على ماسنجر باستخدام ChatGPT و Training جاهز باللهجة المصرية.
بيرد على العملاء من ملف `training.json`، ويرسل صور تلقائيًا من `assets/`.

## المجلدات
- `index.js` → الكود الرئيسي للردود
- `features.js` → الخواص زي كتم العملاء والمتابعة
- `training.json` → النوايا الجاهزة والردود باللهجة المصرية
- `assets/` → صور المنتجات والريفيوهات

## التشغيل على Vercel
ارفع المشروع كامل على GitHub، ثم اربطه بـ Vercel.
تأكد إن `PAGE_ACCESS_TOKEN` و `OPENAI_API_KEY` موجودين في إعدادات البيئة (Environment Variables).
