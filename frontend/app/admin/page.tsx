import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/session";
import AdminNavbar from "@/components/AdminNavbar";
import "server-only";

export default async function AdminPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");

  // Fetch dashboard stats from backend
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
  let stats: { total: number; by_year: { year: number; count: number }[]; by_month: { year: number; month: number; count: number }[] } = { total: 0, by_year: [], by_month: [] };
  try {
    const res = await fetch(`${backendURL}/api/stats`, { cache: "no-store" });
    if (res.ok) stats = await res.json();
  } catch {}

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100">
      <AdminNavbar session={session} currentPage="dashboard" />
      
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Welcome Section */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
              แผงควบคุมผู้ดูแลระบบ
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              สวัสดี, {session.username} ยินดีต้อนรับสู่ระบบจัดการคำร้อง ปพ.1
            </p>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <Link
              href="/admin/requests"
              className="group relative overflow-hidden rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 dark:from-emerald-400/5 dark:to-teal-400/5"></div>
              <div className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">ดูคำร้อง</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">รายการคำร้องทั้งหมด</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <span className="text-sm font-medium">ไปดูรายการ</span>
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>

            <div className="group relative overflow-hidden rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-lg transition-all duration-300 opacity-50">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 dark:from-blue-400/5 dark:to-indigo-400/5"></div>
              <div className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">รายงาน</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">สถิติและรายงาน (เร็วๆ นี้)</p>
                  </div>
                </div>
              </div>
            </div>

            <Link
              href="/admin/settings"
              className="group relative overflow-hidden rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-purple-500/5 dark:from-violet-400/5 dark:to-purple-400/5"></div>
              <div className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">ตั้งค่า</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">จัดการข้อมูลเจ้าหน้าที่</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
                  <span className="text-sm font-medium">ไปตั้งค่า</span>
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="group relative overflow-hidden rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-lg transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 dark:from-cyan-400/5 dark:to-blue-400/5"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center shadow-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">{stats.total}</div>
                  </div>
                </div>
                <div className="text-sm font-medium text-slate-600 dark:text-slate-300">คำร้องทั้งหมด</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">ข้อมูลทั้งหมดในระบบ</div>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-lg transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-green-500/5 dark:from-emerald-400/5 dark:to-green-400/5"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">{stats.by_year.at(-1)?.year ?? "-"}</div>
                  </div>
                </div>
                <div className="text-sm font-medium text-slate-600 dark:text-slate-300">ปีล่าสุด</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">ปีการศึกษาล่าสุดที่มีข้อมูล</div>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-lg transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-purple-500/5 dark:from-violet-400/5 dark:to-purple-400/5"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {stats.by_month.length ? `${stats.by_month.at(-1)!.year}/${String(stats.by_month.at(-1)!.month).padStart(2, "0")}` : "-"}
                    </div>
                  </div>
                </div>
                <div className="text-sm font-medium text-slate-600 dark:text-slate-300">เดือนล่าสุด</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">เดือนล่าสุดที่มีข้อมูล</div>
              </div>
            </div>
          </div>

          {/* Data Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Yearly Stats */}
            <div className="rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              <div className="border-b border-slate-200/50 dark:border-slate-700/50 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">สถิติรายปี</h3>
                </div>
              </div>
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-slate-500 dark:text-slate-400 text-sm">
                        <th className="py-3 pr-4 font-medium">ปี (ค.ศ.)</th>
                        <th className="py-3 pr-4 font-medium">จำนวน</th>
                        <th className="py-3 font-medium">แนวโน้ม</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/50 dark:divide-slate-700/50">
                      {stats.by_year.map((y, index) => (
                        <tr key={y.year} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-4 pr-4 font-medium text-slate-900 dark:text-slate-100">{y.year}</td>
                          <td className="py-4 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900 dark:text-slate-100">{y.count}</span>
                              <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden max-w-20">
                                <div 
                                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500"
                                  style={{ width: `${Math.min(100, (y.count / Math.max(...stats.by_year.map(x => x.count))) * 100)}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4">
                            {index > 0 && (
                              <div className="flex items-center gap-1">
                                {y.count > stats.by_year[index - 1].count ? (
                                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                  </svg>
                                ) : y.count < stats.by_year[index - 1].count ? (
                                  <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 112 0v11.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                      {!stats.by_year.length && (
                        <tr>
                          <td colSpan={3} className="py-8 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <svg className="w-12 h-12 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span className="text-slate-500 dark:text-slate-400">ไม่มีข้อมูล</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Monthly Stats */}
            <div className="rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              <div className="border-b border-slate-200/50 dark:border-slate-700/50 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">สถิติรายเดือน</h3>
                </div>
              </div>
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-slate-500 dark:text-slate-400 text-sm">
                        <th className="py-3 pr-4 font-medium">ปี</th>
                        <th className="py-3 pr-4 font-medium">เดือน</th>
                        <th className="py-3 font-medium">จำนวน</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/50 dark:divide-slate-700/50">
                      {stats.by_month.slice(-6).map((m) => (
                        <tr key={`${m.year}-${m.month}`} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-4 pr-4 font-medium text-slate-900 dark:text-slate-100">{m.year}</td>
                          <td className="py-4 pr-4">
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {String(m.month).padStart(2, "0")}
                            </span>
                          </td>
                          <td className="py-4">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900 dark:text-slate-100">{m.count}</span>
                              <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden max-w-16">
                                <div 
                                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                                  style={{ width: `${Math.min(100, (m.count / Math.max(...stats.by_month.map(x => x.count))) * 100)}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!stats.by_month.length && (
                        <tr>
                          <td colSpan={3} className="py-8 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <svg className="w-12 h-12 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="text-slate-500 dark:text-slate-400">ไม่มีข้อมูล</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
