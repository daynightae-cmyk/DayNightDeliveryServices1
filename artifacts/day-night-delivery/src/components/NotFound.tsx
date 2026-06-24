/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Link } from "react-router-dom";
import { FileQuestion, Home } from "lucide-react";

interface NotFoundProps {
  onNavigate?: (tab: string) => void;
}

export default function NotFound({ onNavigate }: NotFoundProps) {
  return (
    <div className="max-w-md mx-auto text-center py-20 space-y-6 text-right">
      <div className="w-20 h-20 bg-brand-gold/10 border border-brand-gold/20 rounded-full flex items-center justify-center mx-auto text-brand-gold shadow-[0_0_20px_rgba(235,188,4,0.2)]">
        <FileQuestion className="w-10 h-10" />
      </div>
      
      <div className="space-y-2 text-center">
        <h2 className="text-3xl font-extrabold text-white">الصفحة غير موجودة</h2>
        <p className="text-brand-gold font-mono text-xs uppercase font-bold tracking-widest">404 - Error Path Not Found</p>
        <p className="text-white/60 text-sm max-w-xs mx-auto">
          عذراً، العنوان أو الصفحة التي تحاول الوصول إليها قد تم نقلها أو أنها غير متوفرة حالياً في نظام داي نايت للتوصيل.
        </p>
      </div>

      <div className="pt-2 text-center">
        {onNavigate ? (
          <button
            onClick={() => onNavigate("home")}
            className="px-6 py-3 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white font-extrabold rounded-xl text-xs transition-colors inline-flex items-center gap-2 cursor-pointer shadow-[0_4px_12px_rgba(235,188,4,0.2)]"
          >
            <Home className="w-4 h-4" />
            <span>العودة للرئيسية</span>
          </button>
        ) : (
          <Link
            to="/"
            className="px-6 py-3 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white font-extrabold rounded-xl text-xs transition-colors inline-flex items-center gap-2 cursor-pointer shadow-[0_4px_12px_rgba(235,188,4,0.2)]"
          >
            <Home className="w-4 h-4" />
            <span>العودة للرئيسية</span>
          </Link>
        )}
      </div>
    </div>
  );
}
