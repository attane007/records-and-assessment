"use client";

import { useState } from "react";

interface FormLinkManagerProps {
  initialFormUrl: string;
}

export default function FormLinkManager({ initialFormUrl }: FormLinkManagerProps) {
  const [formUrl, setFormUrl] = useState(initialFormUrl);
  const [isRotating, setIsRotating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rotated, setRotated] = useState(false);

  const handleCopy = async () => {
    if (!formUrl) return;
    try {
      await navigator.clipboard.writeText(formUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for browsers that block clipboard API
      const el = document.createElement("textarea");
      el.value = formUrl;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRotateConfirm = async () => {
    setShowConfirm(false);
    setIsRotating(true);
    setError(null);
    try {
      const res = await fetch("/api/form-links/current", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data && typeof data === "object" && "error" in data && typeof (data as { error?: unknown }).error === "string"
          ? (data as { error: string }).error
          : `เกิดข้อผิดพลาด (${res.status})`;
        setError(msg);
        return;
      }
      if (data && typeof data === "object" && "form_url" in data && typeof (data as { form_url?: unknown }).form_url === "string") {
        setFormUrl((data as { form_url: string }).form_url);
        setRotated(true);
        setTimeout(() => setRotated(false), 4000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "ไม่สามารถเชื่อมต่อได้");
    } finally {
      setIsRotating(false);
    }
  };

  return (
    <>
      {/* Confirm Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm p-4">
          <div className="flex min-h-full items-center justify-center py-8">
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 p-6 w-full max-w-md mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">เปลี่ยน URL แบบฟอร์ม?</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">การดำเนินการนี้ไม่สามารถยกเลิกได้</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                URL เก่า <strong>จะหมดอายุทันที</strong> นักเรียนที่มี URL เก่าจะไม่สามารถส่งคำร้องได้ คุณต้องแจ้ง URL ใหม่ให้นักเรียนทราบ
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleRotateConfirm}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 transition-colors shadow-md shadow-amber-500/20"
                >
                  ยืนยัน เปลี่ยน URL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">URL แบบฟอร์มสาธารณะ</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">ลิงก์สำหรับให้นักเรียนกรอกข้อมูลยื่นคำร้อง</p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* URL Display + Copy */}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm font-mono text-slate-700 dark:text-slate-300 truncate select-all">
              {formUrl || <span className="text-slate-400 dark:text-slate-500 italic">กำลังโหลด…</span>}
            </div>
            <button
              onClick={handleCopy}
              disabled={!formUrl}
              title="คัดลอก URL"
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                copied
                  ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              } shadow-sm disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>คัดลอกแล้ว</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>คัดลอก</span>
                </>
              )}
            </button>
          </div>

          {/* Rotated success notice */}
          {rotated && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              URL ถูกเปลี่ยนแล้ว — กรุณาแจ้ง URL ใหม่ให้นักเรียน
            </div>
          )}

          {/* Error notice */}
          {error && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 text-xs font-medium">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              {error}
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-0.5">เปลี่ยน URL แบบฟอร์ม</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  หาก URL รั่วไหลหรือต้องการยกเลิกลิงก์เก่า ใช้ปุ่มนี้เพื่อสร้าง URL ใหม่ทันที URL เก่าจะหยุดทำงานทันที
                </p>
              </div>
              <button
                onClick={() => { setError(null); setShowConfirm(true); }}
                disabled={isRotating}
                className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRotating ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                    </svg>
                    <span>กำลังเปลี่ยน…</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>เปลี่ยน URL</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
