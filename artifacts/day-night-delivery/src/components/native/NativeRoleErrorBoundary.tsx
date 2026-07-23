import { Component, type ErrorInfo, type ReactNode } from "react";
import { supabase } from "../../supabase";

type NativeRole = "driver" | "merchant";

type Props = {
  role: NativeRole;
  children: ReactNode;
};

type State = {
  failed: boolean;
  message: string;
};

function isArabicDocument() {
  return typeof document !== "undefined" && document.documentElement.lang.toLowerCase().startsWith("ar");
}

export default class NativeRoleErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, message: "" };

  static getDerivedStateFromError(error: unknown): State {
    return {
      failed: true,
      message: error instanceof Error ? error.message : String(error || "Native role runtime failed"),
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("DAY_NIGHT_NATIVE_ROLE_RUNTIME", this.props.role, error, info.componentStack);
  }

  private retry = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("nativeShell", this.props.role);
    url.searchParams.set("nosplash", "1");
    url.searchParams.set("__dn_recover", String(Date.now()));
    window.location.replace(url.toString());
  };

  private resetSession = async () => {
    try {
      await supabase?.auth.signOut();
    } catch {
      // Recovery must remain available even if the backend is temporarily unreachable.
    }
    this.retry();
  };

  render() {
    if (!this.state.failed) return this.props.children;

    const isArabic = isArabicDocument();
    const roleLabel = this.props.role === "driver"
      ? (isArabic ? "المندوب" : "Driver")
      : (isArabic ? "التاجر" : "Merchant");

    return (
      <section
        data-native-role-recovery={this.props.role}
        dir={isArabic ? "rtl" : "ltr"}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 2147483646,
          display: "grid",
          placeItems: "center",
          minHeight: "100dvh",
          padding: 20,
          overflow: "auto",
          background: "linear-gradient(145deg,#071a33,#0b4db2)",
          color: "#ffffff",
          fontFamily: "Cairo,Arial,sans-serif",
        }}
      >
        <main style={{
          width: "min(100%,520px)",
          padding: 26,
          border: "1px solid rgba(255,255,255,.16)",
          borderRadius: 26,
          background: "rgba(7,26,51,.92)",
          boxShadow: "0 24px 70px rgba(0,0,0,.34)",
        }}>
          <div style={{ width: 62, height: 62, display: "grid", placeItems: "center", border: "2px solid #d4af37", borderRadius: 19, color: "#f4d96f", fontWeight: 900, fontSize: 20 }}>DN</div>
          <h1 style={{ margin: "18px 0 8px", fontSize: 24, fontWeight: 900 }}>
            {isArabic ? `تعذر فتح مساحة ${roleLabel}` : `${roleLabel} workspace could not open`}
          </h1>
          <p style={{ margin: 0, color: "#d7e2f0", lineHeight: 1.8, fontWeight: 700 }}>
            {isArabic
              ? "تم منع الصفحة البيضاء. أعد تحميل مساحة العمل، أو امسح الجلسة إذا كانت بيانات الدخول القديمة تالفة."
              : "The blank screen was intercepted. Reload the workspace, or clear the saved session if it is stale."}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10, marginTop: 22 }}>
            <button type="button" onClick={this.retry} style={{ minHeight: 50, border: 0, borderRadius: 14, background: "#d4af37", color: "#071a33", fontWeight: 900 }}>
              {isArabic ? "إعادة فتح التطبيق" : "Reload app"}
            </button>
            <button type="button" onClick={() => void this.resetSession()} style={{ minHeight: 50, border: "1px solid rgba(255,255,255,.2)", borderRadius: 14, background: "rgba(255,255,255,.08)", color: "#ffffff", fontWeight: 900 }}>
              {isArabic ? "مسح الجلسة والدخول" : "Reset session"}
            </button>
          </div>
          <small style={{ display: "block", marginTop: 16, color: "#7f9ab8", overflowWrap: "anywhere" }}>
            {this.state.message}
          </small>
        </main>
      </section>
    );
  }
}
