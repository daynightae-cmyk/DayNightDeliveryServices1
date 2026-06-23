DAY NIGHT DELIVERY SERVICES - Deployment Guide

Project Type:
React / Vite static frontend.

Local Commands:
npm install
npm run dev
npm run build
npm run preview

Production Output:
dist

Vercel Settings:
Framework Preset: Vite
Install Command: npm install
Build Command: npm run build
Output Directory: dist

Environment Variables:
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

Never expose:
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_SECRET_KEY
sb_secret

Domain Plan:
daynightae.com -> Vercel
www.daynightae.com -> Vercel
blog.daynightae.com -> EasyWP optional

Namecheap DNS:
Use the exact DNS records shown by Vercel.
Common records:
A Record @ 76.76.21.21
CNAME www cname.vercel-dns.com

SPA Routing:
vercel.json and public/_redirects are included to prevent refresh errors on internal pages.
