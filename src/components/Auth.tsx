import React, { useState } from "react";
import { supabase, isAdminUser } from "../supabase";
import { Lock, Mail, KeyRound, CheckCircle, ShieldAlert } from "lucide-react";

interface AuthProps {
  onAuthSuccess: () => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

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
        setErrorMsg(`Ø®Ø·Ø£ ÙÙŠ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„: ${error.message}`);
      } else if (data?.user) {
        const id = data.user.id;
        
        setSuccessMsg("ØªÙ… ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø¨Ù†Ø¬Ø§Ø­! Ø¬Ø§Ø±ÙŠ Ø§Ù„ØªØ­Ù‚Ù‚ Ù…Ù† ØµÙ„Ø§Ø­ÙŠØ§Øª Ø§Ù„Ù…Ø´Ø±ÙÙŠÙ†...");
        
        // Check admin role
        const isAdmin = await isAdminUser(id);
        
        if (!isAdmin) {
          setErrorMsg("Ù„ÙŠØ³ Ù„Ø¯ÙŠÙƒ ØµÙ„Ø§Ø­ÙŠØ© Ø§Ù„Ø¯Ø®ÙˆÙ„ ÙƒÙ…Ø³Ø¤ÙˆÙ„.");
          await supabase.auth.signOut();
          setSuccessMsg("");
          setLoading(false);
          return;
        }

        // Save auth session info securely
        sessionStorage.setItem("dn_admin_authenticated", "true");
        sessionStorage.setItem("dn_user_id", id);
        
        setTimeout(() => {
          onAuthSuccess();
        }, 1000);
      }
    } catch (err: any) {
      setErrorMsg("Ø­Ø¯Ø« Ø®Ø·Ø£ ØªÙ‚Ù†ÙŠ ØºÙŠØ± Ù…ØªÙˆÙ‚Ø¹ Ø£Ø«Ù†Ø§Ø¡ Ù…Ø­Ø§ÙˆÙ„Ø© Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù….");
    } finally {
      if (!successMsg) {
        setLoading(false);
      }
    }
  }

  return (
    <div className="max-w-md mx-auto my-12 p-8 bg-brand-deep/80 rounded-3xl border border-white/10 shadow-2xl relative text-right">
      <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 w-14 h-14 bg-brand-gold rounded-2xl flex items-center justify-center border border-white/10 shadow-lg shadow-brand-gold/10">
        <Lock className="w-6 h-6 text-brand-deep" />
      </div>

      <div className="text-center pt-6 pb-2 space-y-2">
        <h2 className="text-2xl font-black text-white">Ø¨ÙˆØ§Ø¨Ø© Ø§Ù„Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…Ø±ÙƒØ²ÙŠØ© (Supabase)</h2>
        <p className="text-xs text-white/50 leading-relaxed font-sans">
          Ø§Ù„Ø¯Ø®ÙˆÙ„ Ù…Ø®ØµØµ Ù„Ù„Ù…Ø³Ø¤ÙˆÙ„ÙŠÙ† Ø¨ØµÙ„Ø§Ø­ÙŠØ© Admin ÙÙ‚Ø· Ø¨Ù†Ø§Ø¡ Ø¹Ù„Ù‰ Ù‚ÙŠÙˆØ¯ Supabase RLS.
        </p>
      </div>

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-4 rounded-xl flex items-start gap-2 mt-4 text-right">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="font-bold">{errorMsg}</p>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-4 rounded-xl flex items-start gap-2 mt-4 text-right">
          <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="font-bold">{successMsg}</p>
        </div>
      )}

      <form onSubmit={handleSupabaseLogin} className="space-y-4 text-right mt-6">
        <div className="space-y-1.5 pt-2">
          <label className="text-white/80 text-xs font-bold font-sans">Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ Ù„Ù„Ø¥Ø¯Ø§Ø±Ø©</label>
          <div className="relative">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Admin@daynightae.com"
              className="w-full bg-brand-cool/50 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-cool transition-all placeholder:text-white/20 text-right font-sans"
              dir="rtl"
            />
            <Mail className="absolute right-3 top-3.5 w-5 h-5 text-white/30" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-white/80 text-xs font-bold font-sans">ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø§Ù„Ù…Ø´ÙØ±Ø©</label>
          <div className="relative">
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
              className="w-full bg-brand-cool/50 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-cool transition-all placeholder:text-white/20 text-left font-sans tracking-widest"
              dir="ltr"
            />
            <KeyRound className="absolute right-3 top-3.5 w-5 h-5 text-white/30" />
          </div>
        </div>
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-brand-gold hover:bg-white text-brand-deep font-black rounded-xl text-sm transition-all disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer"
          >
            {loading ? (
               <span>Ø¬Ø§Ø±ÙŠ Ø§Ù„Ù…ØµØ§Ø¯Ù‚Ø© Ø§Ù„Ø£Ù…Ù†ÙŠØ©...</span>
            ) : (
               <span>ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ù„Ù„Ù†Ø¸Ø§Ù… Ø§Ù„Ø£Ø³Ø§Ø³ÙŠ</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

