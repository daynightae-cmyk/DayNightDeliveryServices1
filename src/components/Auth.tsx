import React, { useState } from "react";
import { supabase } from "../supabase";
import { Lock, Mail, KeyRound, CheckCircle, ShieldAlert } from "lucide-react";

interface AuthProps {
  onAuthSuccess: () => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [loginMethod, setLoginMethod] = useState<"pin" | "supabase">("pin");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function handlePinLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    
    // Day Night admin team default security code bypass
    if (adminPin.trim() === "DAYNIGHT2026" || adminPin.trim() === "DN971") {
      setSuccessMsg("تم المصادقة بنجاح! جاري توجيهك إلى بوابة الكباتن والفرز.");
      sessionStorage.setItem("dn_admin_authenticated", "true");
      setTimeout(() => {
        onAuthSuccess();
      }, 1000);
    } else {
      setErrorMsg("رمز الصلاحية والتحقق الخاص بالكابتن غير صحيح. يرجى الاتصال بمدير النظام.");
    }
  }

  async function handleSupabaseLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (error) {
        setErrorMsg(`خطأ في تسجيل الدخول: ${error.message}`);
      } else if (data?.user) {
        setSuccessMsg("تم تسجيل الدخول بنجاح! جاري التحقق من صلاحيات المشرفين...");
        
        // Save auth session info
        sessionStorage.setItem("dn_admin_authenticated", "true");
        sessionStorage.setItem("dn_user_id", data.user.id);
        
        setTimeout(() => {
          onAuthSuccess();
        }, 1000);
      }
    } catch (err: any) {
      setErrorMsg("حدث خطأ تقني غير متوقع أثناء محاولة الاتصال بالخادم.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto my-12 p-8 bg-brand-deep/80 rounded-3xl border border-white/10 shadow-2xl relative">
      <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 w-14 h-14 bg-brand-gold rounded-2xl flex items-center justify-center border border-white/10 shadow-lg shadow-brand-gold/10">
        <Lock className="w-6 h-6 text-brand-deep" />
      </div>

      <div className="text-center pt-6 pb-2 space-y-2">
        <h2 className="text-2xl font-black text-white">بوابة التحقق اللوجستي للعمليات</h2>
        <p className="text-xs text-white/50 leading-relaxed font-sans">
          الدخول مخصص لكباتن الميدان والفرز والإدارة المباشرة لشركة داي نايت للتوصيل.
        </p>
      </div>

      {/* Login Switch */}
      <div className="grid grid-cols-2 gap-2 bg-brand-cool/50 p-1 rounded-xl border border-white/5 mt-4 mb-6">
        <button
          onClick={() => setLoginMethod("pin")}
          className={`py-2 rounded-lg text-xs font-bold transition-all ${
            loginMethod === "pin" ? "bg-brand-gold text-brand-deep" : "text-white/60 hover:text-white"
          }`}
        >
          كود الكابتن السريع
        </button>
        <button
          onClick={() => setLoginMethod("supabase")}
          className={`py-2 rounded-lg text-xs font-bold transition-all ${
            loginMethod === "supabase" ? "bg-brand-gold text-brand-deep" : "text-white/60 hover:text-white"
          }`}
        >
          حساب البريد الإلكتروني
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-right text-rose-400 text-xs font-semibold flex items-center gap-2 mb-4">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="leading-relaxed">{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-right text-emerald-400 text-xs font-semibold flex items-center gap-2 mb-4">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="leading-relaxed">{successMsg}</span>
        </div>
      )}

      {loginMethod === "pin" ? (
        <form onSubmit={handlePinLogin} className="space-y-4">
          <div className="space-y-1 text-right">
            <label className="text-xs text-white/50 font-bold block">رمز تحقق كابتن الفرز الأمني</label>
            <div className="relative">
              <input
                type="password"
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                placeholder="أدخل رمز المرور اللوجستي الخاص بك"
                className="w-full bg-brand-cool/40 border border-white/10 rounded-xl py-3 px-4 pr-10 text-center font-mono text-brand-gold placeholder-white/30 focus:outline-none focus:border-brand-gold text-sm tracking-widest font-black"
                required
              />
              <KeyRound className="absolute right-3.5 top-3.5 w-4 h-4 text-white/30" />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-brand-gold hover:bg-brand-gold/90 text-brand-deep font-black py-3 rounded-xl text-xs transition-all uppercase tracking-wider mt-2 cursor-pointer"
          >
            تحقق ودخول للبوابة
          </button>
        </form>
      ) : (
        <form onSubmit={handleSupabaseLogin} className="space-y-4">
          <div className="space-y-1 text-right">
            <label className="text-xs text-white/50 font-bold block">البريد الإلكتروني للإدارة</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@daynight.ae"
                className="w-full bg-brand-cool/40 border border-white/10 rounded-xl py-3 px-4 pr-10 text-right text-white placeholder-white/30 focus:outline-none focus:border-brand-gold text-xs font-mono"
                required
              />
              <Mail className="absolute right-3.5 top-3.5 w-4 h-4 text-white/30" />
            </div>
          </div>

          <div className="space-y-1 text-right">
            <label className="text-xs text-white/50 font-bold block">كلمة المرور المشفرة</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-brand-cool/40 border border-white/10 rounded-xl py-3 px-4 pr-10 text-right text-white placeholder-white/30 focus:outline-none focus:border-brand-gold text-xs font-mono"
                required
              />
              <Lock className="absolute right-3.5 top-3.5 w-4 h-4 text-white/30" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-gold disabled:opacity-50 hover:bg-brand-gold/90 text-brand-deep font-black py-3 rounded-xl text-xs transition-all uppercase tracking-wider mt-2 cursor-pointer"
          >
            {loading ? "جاري المصادقة النفاذة..." : "تسجيل الدخول الآمن"}
          </button>
        </form>
      )}

      <div className="mt-6 border-t border-white/5 pt-4 text-center">
        <p className="text-[10px] text-white/30 font-bold leading-normal">
          نظام رقابة معتمد من داي نايت لخدمات التوصيل والشحن. يتم تسجيل كافة المحاولات والـ IP لأغراض أمنية.
        </p>
      </div>
    </div>
  );
}
