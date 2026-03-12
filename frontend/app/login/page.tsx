"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const errorMessages: Record<string, string> = {
    auth_failed: "การยืนยันตัวตนล้มเหลว",
    no_code: "ไม่พบรหัสยืนยันตัวตน",
    config_error: "ระบบยังไม่ได้ตั้งค่า OIDC",
    token_exchange_failed: "ไม่สามารถแลกเปลี่ยน Token ได้",
    profile_fetch_failed: "ไม่สามารถดึงข้อมูลโปรไฟล์ได้",
    invalid_profile: "รูปแบบข้อมูลโปรไฟล์ไม่ถูกต้อง",
    auth_exception: "เกิดข้อผิดพลาดในระบบเข้าสู่ระบบ"
  };

  const displayError = error ? (errorMessages[error] || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง") : null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-400/20 dark:bg-cyan-900/30 rounded-full blur-[100px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-400/20 dark:bg-indigo-900/30 rounded-full blur-[100px] animate-pulse pointer-events-none" style={{ animationDelay: '2s' }} />

      <div className="w-full max-w-md bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-800/50 rounded-2xl p-8 shadow-2xl relative z-10 transition-all duration-300 hover:shadow-cyan-500/10 dark:hover:shadow-cyan-500/5">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-indigo-600 mb-4 shadow-lg shadow-cyan-500/30">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
            ระบบจัดเก็บแบบฟอร์ม
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium">
            กรุณาเข้าสู่ระบบเพื่อจัดการข้อมูลของคุณ
          </p>
        </div>

        {displayError && (
          <div className="mb-6 p-4 rounded-xl bg-red-50/50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 text-sm text-red-600 dark:text-red-400 flex items-start gap-3 animate-in slide-in-from-top-2 fade-in duration-300">
            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p>{displayError}</p>
          </div>
        )}

        <div className="mt-6">
          <a
            href="/api/auth/oidc"
            className="group relative w-full flex items-center justify-center gap-3 bg-gradient-to-r from-cyan-600 to-indigo-600 text-white px-6 py-3.5 rounded-xl font-medium shadow-lg hover:shadow-xl hover:shadow-cyan-500/25 transition-all duration-300 overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
            <svg className="w-5 h-5 relative z-10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            <span className="relative z-10 tracking-wide">เข้าสู่ระบบด้วย Krufame Auth</span>
          </a>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center"><div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div></div>}>
      <LoginContent />
    </Suspense>
  );
}
