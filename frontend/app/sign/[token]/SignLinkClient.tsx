"use client";

import { useEffect, useState } from "react";
import SignatureCapturePanel from "@/components/signature/SignatureCapturePanel";
import type {
  ApiErrorResponse,
  CreateSignSessionResponse,
  OfficialDecision,
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
  const [decision, setDecision] = useState<OfficialDecision | "">("");

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
    if (!decision) {
      throw new Error("กรุณาเลือกความเห็น (อนุญาต/ไม่อนุญาต) ก่อนลงนาม");
    }

    const res = await fetch(`/api/sign-links/${encodeURIComponent(token)}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, decision }),
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
    if (!decision) {
      throw new Error("กรุณาเลือกความเห็นก่อนสร้าง QR");
    }

    const res = await fetch("/api/sign-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, decision }),
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

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">ความเห็นเจ้าหน้าที่</h2>
        <p className="mt-1 text-xs text-slate-600">กรุณาเลือกความเห็นก่อนยืนยันลายเซ็นต์</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <input
              type="radio"
              name="official-decision"
              value="approve"
              checked={decision === "approve"}
              onChange={() => setDecision("approve")}
            />
            อนุญาต
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            <input
              type="radio"
              name="official-decision"
              value="reject"
              checked={decision === "reject"}
              onChange={() => setDecision("reject")}
            />
            ไม่อนุญาต
          </label>
        </div>
      </section>

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
