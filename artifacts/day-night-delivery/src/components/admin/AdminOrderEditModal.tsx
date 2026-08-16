import { lazy, Suspense, useEffect, useState, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import type { Order } from "../../types";
import "../../styles/dn-admin-render-containment.css";

const AdminOrderEditModalComplete = lazy(() => import("./AdminOrderEditModalComplete"));

type Props = ComponentProps<typeof AdminOrderEditModalComplete>;

function EditorWarmup({ isArabic }: { isArabic: boolean }) {
  return (
    <div
      className="dn-admin-modal-backdrop dn-admin-edit-warmup"
      role="status"
      aria-live="polite"
      dir={isArabic ? "rtl" : "ltr"}
    >
      <div className="dn-admin-edit-warmup__panel">
        <span className="dn-admin-edit-warmup__pulse" aria-hidden="true" />
        <strong>{isArabic ? "فتح بيانات الطلب…" : "Opening order details…"}</strong>
        <small>{isArabic ? "تجهيز المحرر دون إيقاف لوحة الإدارة" : "Preparing the editor without blocking Admin"}</small>
      </div>
    </div>
  );
}

/**
 * Keep the editor mounted after every verified save and close it only when the
 * operator explicitly exits. The complete editor publishes the saved row through
 * `dn-admin-orders-updated`; calling the legacy parent `onSaved` callback would
 * trigger a global refresh and destroy the current workspace state.
 *
 * The heavy editor is loaded one presentation frame after the click. This lets
 * the browser paint immediate feedback first and isolates the editor in a body
 * portal so opening it does not participate in the large Admin workspace layout.
 */
export default function AdminOrderEditModal(props: Props) {
  const { open, order, onClose, onSaved: _legacyParentRefresh, ...modalProps } = props;
  const [editorReady, setEditorReady] = useState(false);

  useEffect(() => {
    if (!open || !order) {
      setEditorReady(false);
      return;
    }

    let firstFrame = 0;
    let secondFrame = 0;
    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => setEditorReady(true));
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [open, order?.id]);

  async function handleSaved(_savedOrder: Order) {
    // Intentionally no parent callback. The verified row event updates every open
    // admin list in place while this editor remains mounted for further edits.
  }

  async function handleExplicitClose() {
    // Explicit close is the only operation that exits the editor. It must not
    // reload orders or invoke the legacy parent refresh callback.
    onClose();
  }

  if (!open || !order || typeof document === "undefined") return null;

  return createPortal(
    editorReady ? (
      <Suspense fallback={<EditorWarmup isArabic={props.isArabic} />}>
        <AdminOrderEditModalComplete
          {...modalProps}
          order={order}
          open={open}
          onSaved={handleSaved}
          onClose={() => void handleExplicitClose()}
        />
      </Suspense>
    ) : (
      <EditorWarmup isArabic={props.isArabic} />
    ),
    document.body,
  );
}
