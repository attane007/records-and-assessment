"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "เข้าสู่ระบบไม่สำเร็จ");
        return;
      }
      router.replace("/admin");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 dark:bg-slate-950">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">เข้าสู่ระบบผู้ดูแล</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">กรอกชื่อผู้ใช้และรหัสผ่าน</p>
        <div className="mt-4 grid gap-3">
          <label className="text-sm text-slate-700 dark:text-slate-200">
            ชื่อผู้ใช้
            <input value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 ring-cyan-300 dark:ring-cyan-800/50" />
          </label>
          <label className="text-sm text-slate-700 dark:text-slate-200">
            รหัสผ่าน
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 ring-cyan-300 dark:ring-cyan-800/50" />
          </label>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button disabled={loading} className="mt-2 inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 text-white px-4 py-2 text-sm font-medium shadow-md disabled:opacity-60">
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </div>
      </form>
    </div>
  );
}
