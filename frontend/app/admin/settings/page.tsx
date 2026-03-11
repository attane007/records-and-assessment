import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/session";
import AdminNavbar from "@/components/AdminNavbar";
import SettingsForm from "@/components/SettingsForm";
import "server-only";

export default async function SettingsPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");

  // Fetch current officials data via Next.js API route which forwards to the Go backend
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const apiUrl = `${baseUrl}/api/backend/officials`;
  let officials = { registrar_name: "", director_name: "", registrar_email: "", director_email: "" };

  try {
    const res = await fetch(apiUrl, { cache: "no-store" });
    if (res.ok) {
      officials = await res.json();
    } else {
      console.error('Failed to fetch officials: response status', res.status);
    }
  } catch (error) {
    console.error("Failed to fetch officials:", error);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100">
      <AdminNavbar session={session} currentPage="settings" />

      <main className="max-w-6xl mx-auto px-6 py-8 md:py-10">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-1 max-w-2xl mx-auto">
            <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 dark:from-slate-100 dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent leading-normal py-1">
              ชื่อนายทะเบียนและผู้อำนวยการ
            </h1>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              จัดการข้อมูลเจ้าหน้าที่สำหรับเอกสารทางการ และตั้งค่าความปลอดภัย
            </p>
          </div>

          {/* Settings Form (2-column layout) */}
          <SettingsForm initialData={officials} />
        </div>
      </main>
    </div>
  );
}
