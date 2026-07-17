import { Component, type ErrorInfo, type ReactNode } from "react";
import { isRecoverableRouteLoadError, recoverRouteLoadFailure } from "../../lib/routeLoadRecovery";

type DNRouteErrorBoundaryProps = {
  children: ReactNode;
  resetKey: string;
};

type DNRouteErrorBoundaryState = {
  error: unknown;
  recoverable: boolean;
  reloading: boolean;
};

export class DNRouteErrorBoundary extends Component<DNRouteErrorBoundaryProps, DNRouteErrorBoundaryState> {
  state: DNRouteErrorBoundaryState = {
    error: null,
    recoverable: false,
    reloading: false,
  };

  static getDerivedStateFromError(error: unknown): Partial<DNRouteErrorBoundaryState> {
    return {
      error,
      recoverable: isRecoverableRouteLoadError(error),
      reloading: false,
    };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    if (isRecoverableRouteLoadError(error) && recoverRouteLoadFailure()) {
      this.setState({ reloading: true });
      return;
    }

    console.error("[DAY NIGHT] Route render failed", error, errorInfo);
  }

  componentDidUpdate(previousProps: DNRouteErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, recoverable: false, reloading: false });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <section className="dn-finish-surface mx-auto max-w-3xl rounded-[2rem] p-6 text-center sm:p-8" dir="rtl">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-brand-gold/35 bg-brand-gold/10 text-2xl font-black text-brand-gold">
          !
        </div>
        <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-brand-gold">DAY NIGHT</p>
        <h1 className="mt-3 text-2xl font-black text-white sm:text-3xl">
          {this.state.reloading ? "جاري تحديث الصفحة" : "تعذر فتح الصفحة"}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm font-bold leading-7 text-white/62">
          {this.state.recoverable
            ? "تم تحديث الموقع، وسنحاول فتح الصفحة بنسخة جديدة. إذا استمرت الرسالة اضغط تحديث الصفحة."
            : "حدث خطأ أثناء عرض الصفحة. اضغط تحديث الصفحة للعودة إلى نسخة نظيفة."}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="dn-btn dn-btn-primary dn-btn-lg mt-6"
        >
          تحديث الصفحة
        </button>
      </section>
    );
  }
}
