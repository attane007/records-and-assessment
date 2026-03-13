import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getSessionFromCookies } from "@/lib/session";
import AdminNavbar from "@/components/AdminNavbar";
import SettingsForm from "@/components/SettingsForm";
import FormLinkManager from "@/components/FormLinkManager";
import type { FormLinkCurrentResponse } from "@/lib/types/api";
import "server-only";

function isFormLinkCurrentResponse(value: unknown): value is FormLinkCurrentResponse {
  if (typeof value !== "object" || value === null) return false;
  return (
    "form_url" in value &&
    typeof (value as { form_url?: unknown }).form_url === "string" &&
    "token" in value &&
    typeof (value as { token?: unknown }).token === "string"
  );
}

export default async function SettingsPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");

  // Fetch current officials data via Next.js API route which forwards to the Go backend
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const proto = requestHeaders.get("x-forwarded-proto") || (process.env.NODE_ENV === "production" ? "https" : "http");
  const baseUrl = `${proto}://${host}`;
  const apiUrl = `${baseUrl}/api/backend/officials`;
  let officials = { registrar_name: "", director_name: "", registrar_email: "", director_email: "" };
  let publicFormUrl = "";

  try {
    const cookieHeader = (await cookies()).toString();

    const [officialsRes, formLinkRes] = await Promise.all([
      fetch(apiUrl, {
        cache: "no-store",
        headers: {
          cookie: cookieHeader,
        },
      }),
      fetch(`${baseUrl}/api/form-links/current`, {
        cache: "no-store",
        headers: {
          cookie: cookieHeader,
        },
      }),
    ]);

    if (officialsRes.ok) {
      officials = await officialsRes.json();
    } else {
      console.error("Failed to fetch officials: response status", officialsRes.status);
    }

    const formLinkPayload: unknown = await formLinkRes.json().catch(() => null);
    if (formLinkRes.ok && isFormLinkCurrentResponse(formLinkPayload)) {
      publicFormUrl = formLinkPayload.form_url;
    }
  } catch (error) {
    console.error("Failed to fetch settings context:", error);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100">
      <AdminNavbar session={session} currentPage="settings" publicFormUrl={publicFormUrl} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 md:py-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-1 max-w-2xl mx-auto">
            <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 dark:from-slate-100 dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent leading-normal py-1">
              ชื่อนายทะเบียนและผู้อำนวยการ
            </h1>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              จัดการข้อมูลเจ้าหน้าที่สำหรับเอกสารทางการ
            </p>
          </div>

          {/* Grid Layout for Desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left Column: Settings Form (Main Info) */}
            <div className="lg:col-span-2">
              <SettingsForm initialData={officials} />
            </div>

            {/* Right Column: Form Link Manager */}
            <div className="lg:col-span-1">
              <FormLinkManager initialFormUrl={publicFormUrl} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
