import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/session";

export default async function AdminPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="w-full border-b border-cyan-300 dark:border-cyan-900 bg-white/70 dark:bg-slate-900/60 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <h1 className="text-base sm:text-lg font-semibold tracking-tight">แผงควบคุมผู้ดูแล</h1>
          <span className="ml-auto text-sm opacity-80">สวัสดี, {session.username}</span>
          <form action="/api/logout" method="post">
            <button className="ml-3 inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm">ออกจากระบบ</button>
          </form>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="font-semibold">ยินดีต้อนรับ</div>
            <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">หน้านี้ถูกป้องกัน ต้องเข้าสู่ระบบก่อน</div>
            <div className="mt-4 text-sm">
              <Link href="/" className="text-cyan-700 hover:underline">กลับหน้าหลัก</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
