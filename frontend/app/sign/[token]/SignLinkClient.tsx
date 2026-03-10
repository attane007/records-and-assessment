"use client";

import { useEffect, useState } from "react";
import SignatureCapturePanel from "@/components/signature/SignatureCapturePanel";
import type {
  ApiErrorResponse,
  CreateSignSessionResponse,
  SignLinkInfoResponse,
  UpdateSignatureRequestBody,
} from "@/lib/types/api";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return isRecord(value) && typeof value.error === "string";
}

function isSignLinkInfoResponse(value: unknown): value is SignLinkInfoResponse {
  return (
    isRecord(value) &&
    typeof value.role === "string" &&
    typeof value.request_id === "string" &&
    typeof value.expires_at === "string" &&
    typeof value.revoked === "boolean" &&
    typeof value.active === "boolean" &&
    isRecord(value.request)
  );
}

function isCreateSignSessionResponse(value: unknown): value is CreateSignSessionResponse {
  return (
    isRecord(value) &&
    typeof value.session_id === "string" &&
    typeof value.status === "string" &&
    typeof value.expires_at === "string" &&
    typeof value.mobile_url === "string" &&
    typeof value.request_id === "string" &&
    typeof value.role === "string"
  );
}

export default function SignLinkClient({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);
  const [info, setInfo] = useState<SignLinkInfoResponse | null>(null);

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const res = await fetch(`/api/sign-links/${encodeURIComponent(token)}`, { cache: "no-store" });
        const data: unknown = await res.json().catch(() => null);

        if (!active) return;
        if (!res.ok || !isSignLinkInfoResponse(data)) {
          if (isApiErrorResponse(data)) {
            setError(data.error);
          } else {
            setError("ไม่สามารถตรวจสอบลิงก์ลงนามได้");
          }
          return;
        }

        setInfo(data);
        if (!data.active) {
          setError(data.status_message || "ลิงก์นี้ไม่สามารถใช้งานได้แล้ว");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [token]);

  async function submitSignature(payload: UpdateSignatureRequestBody) {
    const res = await fetch(`/api/sign-links/${encodeURIComponent(token)}/sign`, {
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

  async function requestQrSession() {
    const res = await fetch("/api/sign-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const data: unknown = await res.json().catch(() => null);
    if (!res.ok || !isCreateSignSessionResponse(data)) {
      if (isApiErrorResponse(data)) {
        throw new Error(data.error);
      }
      throw new Error("สร้าง QR ไม่สำเร็จ");
    }
    return data;
  }

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-2xl px-4 py-10">
        <div className="text-center text-slate-500">กำลังตรวจสอบลิงก์ลงนาม...</div>
      </main>
    );
  }

  if (completed) {
    return (
      <main className="mx-auto min-h-screen max-w-2xl px-4 py-10">
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-6 text-center">
          <div className="text-xl font-semibold text-emerald-800">ลงนามเรียบร้อยแล้ว</div>
          <div className="mt-2 text-sm text-emerald-700">ระบบบันทึกลายเซ็นต์ของคุณเรียบร้อย</div>
        </div>
      </main>
    );
  }

  if (error || !info) {
    return (
      <main className="mx-auto min-h-screen max-w-2xl px-4 py-10">
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-700">{error || "ลิงก์ไม่ถูกต้อง"}</div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-8">
      <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <div>บทบาทผู้ลงนาม: {info.role === "registrar" ? "นายทะเบียน" : "ผู้อำนวยการ"}</div>
        <div>คำร้อง: {info.request.prefix} {info.request.name} ({info.request.document_type})</div>
      </div>

      <SignatureCapturePanel
        title="ลงนามเอกสาร"
        description="สามารถวาดลายเซ็นต์, แนบรูปภาพ หรือสแกน QR เพื่อลงนามบนมือถือ"
        allowQr
        submitLabel="ยืนยันการลงนาม"
        submitSignature={submitSignature}
        requestQrSession={requestQrSession}
        onComplete={() => setCompleted(true)}
      />
    </main>
  );
}
