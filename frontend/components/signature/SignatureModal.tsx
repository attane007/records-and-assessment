"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { CreateSignSessionResponse, UpdateSignatureRequestBody } from "@/lib/types/api";
import SignatureCapturePanel from "@/components/signature/SignatureCapturePanel";

type SignatureModalProps = {
  open: boolean;
  submitSignature: (payload: UpdateSignatureRequestBody) => Promise<void>;
  requestQrSession: () => Promise<CreateSignSessionResponse>;
  onComplete: () => void;
};

export default function SignatureModal({
  open,
  submitSignature,
  requestQrSession,
  onComplete,
}: SignatureModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100">
          ต้องลงลายเซ็นต์ก่อนจึงจะจบขั้นตอนการยื่นคำร้อง
        </div>

        <SignatureCapturePanel
          title="ลงลายเซ็นต์ผู้ยื่นคำร้อง"
          description="บนคอมพิวเตอร์เลือกวาดลายเซ็นต์, แนบภาพ หรือสแกน QR เพื่อไปวาดบนมือถือ"
          allowQr
          submitLabel="ยืนยันลายเซ็นต์"
          submitSignature={submitSignature}
          requestQrSession={requestQrSession}
          onComplete={onComplete}
        />
      </div>
    </div>,
    document.body
  );
}
