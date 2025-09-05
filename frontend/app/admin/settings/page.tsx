import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/session";
import AdminNavbar from "@/components/AdminNavbar";
import SettingsForm from "@/components/SettingsForm";
import "server-only";

export default async function SettingsPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");

  // Fetch current officials data from backend
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
  let officials = { registrar_name: "", director_name: "" };
  
  try {
    const res = await fetch(`${backendURL}/api/officials`, { cache: "no-store" });
    if (res.ok) {
      officials = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch officials:", error);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100">
      <AdminNavbar session={session} currentPage="settings" />
      
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
              ตั้งค่าระบบ
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              จัดการข้อมูลเจ้าหน้าที่และการตั้งค่าต่างๆ ของระบบ
            </p>
          </div>

          {/* Settings Form */}
          <div className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm p-8">
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    ข้อมูลเจ้าหน้าที่
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    ข้อมูลเหล่านี้จะปรากฏในเอกสาร PDF ที่สร้างโดยระบบ
                  </p>
                </div>

                <SettingsForm initialData={officials} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
