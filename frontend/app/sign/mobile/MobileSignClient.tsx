"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import SignatureCapturePanel from "@/components/signature/SignatureCapturePanel";
import type { ApiErrorResponse, UpdateSignatureRequestBody } from "@/lib/types/api";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return isRecord(value) && typeof value.error === "string";
}

export default function MobileSignClient() {
  const params = useSearchParams();
  const [completed, setCompleted] = useState(false);
  const sessionId = useMemo(() => params?.get("sessionId") || "", [params]);

  async function submit(payload: UpdateSignatureRequestBody) {
    if (!sessionId) {
      throw new Error("ไม่พบ sessionId สำหรับลงนาม");
    }

    const res = await fetch(`/api/sign-sessions/${sessionId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data: unknown = await res.json().catch(() => null);
      if (isApiErrorResponse(data)) {
        throw new Error(data.error);
      }
      throw new Error("ลงนามไม่สำเร็จ");
    }
  }

  if (!sessionId) {
    return (
      <main className="mx-auto min-h-screen max-w-xl px-4 py-10">
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-700">ไม่พบ sessionId สำหรับการลงนาม</div>
      </main>
    );
  }

  if (completed) {
    return (
      <main className="mx-auto min-h-screen max-w-xl px-4 py-10">
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-6 text-center">
          <div className="text-xl font-semibold text-emerald-800">ลงนามเรียบร้อยแล้ว</div>
          <div className="mt-2 text-sm text-emerald-700">สามารถกลับไปที่หน้าคอมพิวเตอร์ได้เลย</div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 py-8">
      <SignatureCapturePanel
        title="ลงนามผ่านมือถือ"
        description="วาดลายเซ็นต์หรือแนบรูปภาพ แล้วกดยืนยันเพื่อส่งกลับไปยังหน้าคอมพิวเตอร์"
        allowQr={false}
        submitLabel="ยืนยันลายเซ็นต์"
        submitSignature={submit}
        onComplete={() => setCompleted(true)}
      />
    </main>
  );
}
