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
  if (!isRecord(value) || !isRecord(value.request)) {
    return false;
  }

  const request = value.request;
  return (
    typeof value.role === "string" &&
    typeof value.request_id === "string" &&
    typeof value.expires_at === "string" &&
    typeof value.revoked === "boolean" &&
    typeof value.active === "boolean" &&
    typeof request.id === "string" &&
    typeof request.prefix === "string" &&
    typeof request.name === "string" &&
    typeof request.id_card === "string" &&
    typeof request.date_of_birth === "string" &&
    typeof request.document_type === "string" &&
    typeof request.purpose === "string"
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

function formatThaiDateDisplay(value: string) {
  if (!value) return "-";

  const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 md:py-12">
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        {/* Left Column: Request Details */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              <span className="h-5 w-1 rounded-full bg-indigo-500"></span>
              ข้อมูลการขอเอกสาร
            </h2>
            <div className="grid gap-3 text-sm">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">บทบาทผู้ลงนาม</span>
                <span className="font-semibold text-slate-900">
                  {info.role === "registrar" ? "นายทะเบียน" : "ผู้อำนวยการ"}
                </span>
              </div>
              
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">ผู้ขอ</span>
                <span className="font-semibold text-slate-900">{info.request.prefix} {info.request.name}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">เลขบัตรประชาชน</span>
                  <span className="text-slate-700">{info.request.id_card || "-"}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">วันเกิด</span>
                  <span className="text-slate-700">{formatThaiDateDisplay(info.request.date_of_birth)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">ประเภทเอกสาร</span>
                  <span className="text-indigo-600 font-medium">{info.request.document_type}</span>
                </div>
                {info.request.student_id && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">รหัสนักเรียน</span>
                    <span className="text-slate-700">{info.request.student_id}</span>
                  </div>
                )}
              </div>

              {((info.request.class || info.request.room || info.request.academic_year)) && (
                <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-slate-50 rounded-xl">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">ชั้น</span>
                    <span className="text-sm text-slate-700">{info.request.class || "-"}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">ห้อง</span>
                    <span className="text-sm text-slate-700">{info.request.room || "-"}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">ปีการศึกษา</span>
                    <span className="text-sm text-slate-700">{info.request.academic_year || "-"}</span>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">วัตถุประสงค์</span>
                <span className="text-slate-700 leading-relaxed">{info.request.purpose}</span>
              </div>

              {(info.request.father_name || info.request.mother_name) && (
                <div className="mt-2 space-y-2 border-t border-slate-100 pt-3">
                  {info.request.father_name && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">ชื่อบิดา</span>
                      <span className="text-sm text-slate-700">{info.request.father_name}</span>
                    </div>
                  )}
                  {info.request.mother_name && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">ชื่อมารดา</span>
                      <span className="text-sm text-slate-700">{info.request.mother_name}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Decisions and Signature */}
        <div className="lg:col-span-7 space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">ความเห็นเจ้าหน้าที่</h2>
            <p className="mt-1 text-sm text-slate-500">กรุณาเลือกความเห็นก่อนยืนยันการลงนาม</p>
            
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label 
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 transition-all ${
                  decision === "approve" 
                    ? "border-emerald-500 bg-emerald-50 ring-4 ring-emerald-50" 
                    : "border-slate-100 bg-slate-50 hover:bg-white hover:border-slate-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="official-decision"
                    value="approve"
                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                    checked={decision === "approve"}
                    onChange={() => setDecision("approve")}
                  />
                  <span className={`font-semibold ${decision === "approve" ? "text-emerald-800" : "text-slate-600"}`}>อนุญาต</span>
                </div>
                {decision === "approve" && <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>}
              </label>

              <label 
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 transition-all ${
                  decision === "reject" 
                    ? "border-rose-500 bg-rose-50 ring-4 ring-rose-50" 
                    : "border-slate-100 bg-slate-50 hover:bg-white hover:border-slate-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="official-decision"
                    value="reject"
                    className="h-4 w-4 text-rose-600 focus:ring-rose-500"
                    checked={decision === "reject"}
                    onChange={() => setDecision("reject")}
                  />
                  <span className={`font-semibold ${decision === "reject" ? "text-rose-800" : "text-slate-600"}`}>ไม่อนุญาต</span>
                </div>
                {decision === "reject" && <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse"></div>}
              </label>
            </div>
          </section>

          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
            <SignatureCapturePanel
              title="ลงนามเอกสาร"
              description="วาดลายเซ็นต์, แนบรูปภาพ หรือสแกน QR เพื่อลงนามบนมือถือ"
              allowQr
              submitLabel="ยืนยันการลงนาม"
              submitSignature={submitSignature}
              requestQrSession={requestQrSession}
              onComplete={() => setCompleted(true)}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
