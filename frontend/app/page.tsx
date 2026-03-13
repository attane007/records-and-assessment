import Link from "next/link";
import Image from "next/image";
import { LogIn } from "lucide-react";
import { getSessionFromCookies } from "@/lib/session";

export default async function LandingPage() {
  const session = await getSessionFromCookies();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 relative overflow-hidden selection:bg-cyan-100 dark:selection:bg-cyan-900/40">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-400/20 dark:bg-cyan-900/20 rounded-full blur-[120px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-400/20 dark:bg-indigo-900/20 rounded-full blur-[120px] animate-pulse pointer-events-none" style={{ animationDelay: '2s' }} />

      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full border-b border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-indigo-600 rounded-xl flex items-center justify-center p-2 shadow-lg shadow-cyan-500/20">
                 <Image src="/logo-ppk-512x512-1.ico" alt="Logo" width={24} height={24} className="brightness-0 invert" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 dark:from-white dark:via-slate-200 dark:to-white">
                ระบบขอ ปพ.1/ปพ.7
              </span>
            </div>
            <div className="flex gap-4">
              <Link
                href="/admin"
                className="group relative inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-100 dark:to-white dark:text-slate-900 rounded-xl shadow-lg shadow-slate-200/50 dark:shadow-none hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
              >
                <LogIn className="w-4 h-4 transition-transform group-hover:rotate-12" />
                <span>{session ? "แดชบอร์ด" : "เข้าสู่ระบบ"}</span>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
          <div className="text-center">
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              จัดการคำร้องเอกสารการศึกษา <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-500 to-indigo-600">
                ได้ง่ายขึ้นกว่าเดิม
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
              บริการจัดการคำร้อง ปพ.1 และ ปพ.7 ออนไลน์ พร้อมดาวน์โหลดเป็นไฟล์ PDF คุณภาพสูง และระบบติดตามสถานะคำร้องที่โปร่งใสและรวดเร็ว
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/admin"
                className="group relative w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-200 bg-gradient-to-r from-cyan-600 to-indigo-600 rounded-2xl shadow-xl shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
              >
                <span className="relative z-10 flex items-center gap-2">
                  {session ? "ไปที่แดชบอร์ด" : "เข้าสู่ระบบเพื่อสร้างฟอร์ม"}
                  <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </Link>
              <Link
                href="/verify"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 font-bold text-slate-900 dark:text-white transition-all duration-200 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95"
              >
                ตรวจสอบสถานะคำร้อง
              </Link>
            </div>
          </div>

          {/* Features Grid */}
          <div className="mt-24 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {[
              {
                title: "รวดเร็ว ปลอดภัย",
                desc: "ยื่นคำร้องออนไลน์ได้ทุกที่ทุกเวลา ผ่านระบบที่ได้รับมาตรฐานความปลอดภัย",
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                color: "from-amber-400 to-orange-500"
              },
              {
                title: "PDF คุณภาพสูง",
                desc: "ออกเอกสารในรูปแบบไฟล์ PDF ที่พร้อมใช้งานและมีรูปแบบที่ถูกต้องตามมาตรฐาน",
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                ),
                color: "from-cyan-400 to-blue-500"
              },
              {
                title: "ติดตามได้ง่าย",
                desc: "ตรวจสอบขั้นตอนการดำเนินงานของเจ้าหน้าที่ได้ทันทีผ่านระบบออนไลน์",
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                ),
                color: "from-indigo-400 to-purple-500"
              }
            ].map((feature, i) => (
              <div key={i} className="group p-8 rounded-3xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-white/20 dark:border-slate-800/50 hover:border-cyan-500/50 transition-all duration-300">
                <div className={`w-12 h-12 mb-6 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-white shadow-lg`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-xs">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-200 dark:border-slate-800 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-sm text-slate-500 dark:text-slate-400 font-xs">
              © {new Date().getFullYear()} Records & Assessment System. All rights reserved.
            </div>
            <div className="flex gap-8 text-sm text-slate-500 dark:text-slate-400 font-xs">
              <Link href="#" className="hover:text-cyan-500 transition-colors">ความเป็นส่วนตัว</Link>
              <Link href="#" className="hover:text-cyan-500 transition-colors">เงื่อนไขการใช้งาน</Link>
              <Link href="#" className="hover:text-cyan-500 transition-colors">ติดต่อสอบถาม</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
