"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, ShieldAlert, Clock, User, Globe, FileText, ArrowLeft, Search } from "lucide-react";
import Link from "next/link";

type AuditLog = {
    id: string;
    request_id: string;
    role: string;
    action: string;
    document_hash: string;
    ip_address: string;
    user_agent: string;
    timestamp: string;
};

type VerifyResponse = {
    hash: string;
    logs: AuditLog[];
    request?: {
        prefix: string;
        name: string;
        document_type: string;
        purpose: string;
        created_at: string;
    };
};

export default function VerifyClient() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [hashInput, setHashInput] = useState("");
    const [data, setData] = useState<VerifyResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const urlHash = searchParams?.get("hash");

    useEffect(() => {
        if (urlHash) {
            setHashInput(urlHash);
            void performVerify(urlHash);
        }
    }, [urlHash]);

    async function performVerify(hash: string) {
        if (!hash) return;
        setLoading(true);
        setError("");
        setData(null);
        try {
            const res = await fetch(`/api/verify?hash=${encodeURIComponent(hash)}`);
            if (!res.ok) {
                if (res.status === 404) {
                    throw new Error("ไม่พบข้อมูลบันทึกสำหรับรหัสอ้างอิงนี้");
                }
                throw new Error("เกิดข้อผิดพลาดในการตรวจสอบ");
            }
            const result = await res.json();
            setData(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : "ล้มเหลว");
        } finally {
            setLoading(false);
        }
    }

    const roleName = (role: string) => {
        switch (role) {
            case "student": return "ผู้ยื่นคำร้อง";
            case "registrar": return "นายทะเบียน";
            case "director": return "ผู้อำนวยการ";
            default: return role;
        }
    };

    const actionName = (action: string) => {
        switch (action) {
            case "sign": return "ลงนามอิเล็กทรอนิกส์";
            case "approve": return "อนุมัติคำร้อง";
            case "reject": return "ปฏิเสธคำร้อง";
            default: return action;
        }
    };

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-12 dark:bg-slate-950">
            <div className="mx-auto max-w-2xl">
                <button 
                    onClick={() => router.back()}
                    className="mb-8 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-cyan-600 transition-colors cursor-pointer"
                >
                    <ArrowLeft className="h-4 w-4" />
                    ย้อนกลับ
                </button>

                <div className="mb-8 overflow-hidden rounded-3xl bg-white shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="bg-gradient-to-r from-cyan-600 to-blue-700 p-8 text-center text-white">
                        <ShieldCheck className="mx-auto mb-4 h-16 w-16 opacity-90" />
                        <h1 className="text-2xl font-bold">ระบบตรวจสอบความน่าเชื่อถือเอกสาร</h1>
                        <p className="mt-2 text-cyan-100 opacity-80">Digital Verification Service (ETDA Standards)</p>
                    </div>

                    <div className="p-8">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="กรอกรหัสอ้างอิง (Hash) ของเอกสาร"
                                value={hashInput}
                                onChange={(e) => setHashInput(e.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 pr-12 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-800"
                            />
                            <button
                                onClick={() => void performVerify(hashInput)}
                                disabled={loading}
                                className="absolute right-3 top-2 rounded-xl bg-cyan-600 p-2.5 text-white hover:bg-cyan-700 disabled:opacity-50"
                            >
                                <Search className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {loading && (
                    <div className="py-12 text-center text-slate-500">
                        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
                        กำลังตรวจสอบความถูกต้องของข้อมูล...
                    </div>
                )}

                {error && (
                    <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-900/50 dark:bg-rose-900/20">
                        <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-rose-500" />
                        <div className="text-lg font-semibold text-rose-800 dark:text-rose-200">ไม่สามารถตรวจสอบได้</div>
                        <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>
                    </div>
                )}

                {data && (
                    <div className="space-y-6">
                        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900/50 dark:bg-emerald-900/20">
                            <div className="flex items-center gap-4 text-emerald-800 dark:text-emerald-200">
                                <ShieldCheck className="h-8 w-8" />
                                <div>
                                    <div className="text-lg font-bold">เอกสารผ่านการตรวจสอบ</div>
                                    <div className="text-sm opacity-80">รหัสอ้างอิงนี้ตรงกับบันทึกในระบบ ไม่มีการแก้ไขปลอมแปลง</div>
                                </div>
                            </div>
                        </div>

                        {data.request && (
                            <section className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                                <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100 text-lg">
                                    <FileText className="h-5 w-5 text-cyan-600" />
                                    รายละเอียดเอกสาร
                                </h2>
                                <div className="grid gap-4 sm:grid-cols-2 text-sm">
                                    <div className="space-y-1">
                                        <p className="text-slate-500 uppercase text-[10px] font-bold tracking-wider">ประเภทคำร้อง</p>
                                        <p className="font-medium">{data.request.document_type}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-slate-500 uppercase text-[10px] font-bold tracking-wider">ผู้ยื่นคำร้อง</p>
                                        <p className="font-medium">{data.request.prefix}{data.request.name}</p>
                                    </div>
                                    <div className="space-y-1 sm:col-span-2">
                                        <p className="text-slate-500 uppercase text-[10px] font-bold tracking-wider">วัตถุประสงค์</p>
                                        <p className="font-medium">{data.request.purpose}</p>
                                    </div>
                                </div>
                            </section>
                        )}

                        <section className="space-y-4">
                            <h2 className="px-2 font-semibold text-slate-900 dark:text-slate-100 text-lg">เส้นทางการตรวจสอบ (Audit Trail)</h2>
                            <div className="relative space-y-4 before:absolute before:left-8 before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-slate-200 dark:before:bg-slate-800">
                                {data.logs.map((log, idx) => (
                                    <div key={log.id} className="relative pl-16">
                                        <div className="absolute left-4 top-1 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-cyan-600 text-white shadow-lg">
                                            {idx + 1}
                                        </div>
                                        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-50 pb-3 mb-3 dark:border-slate-800">
                                                <div className="flex items-center gap-2 font-semibold text-cyan-700 dark:text-cyan-400">
                                                    <User className="h-4 w-4" />
                                                    {roleName(log.role)}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <Clock className="h-4 w-4" />
                                                    {new Date(log.timestamp).toLocaleString("th-TH")}
                                                </div>
                                            </div>

                                            <p className="mb-4 text-slate-800 dark:text-slate-200 font-medium">{actionName(log.action)}</p>

                                            <div className="grid gap-3 text-xs text-slate-500">
                                                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg dark:bg-slate-800">
                                                    <Globe className="h-3 w-3 shrink-0" />
                                                    <span className="truncate">IP: {log.ip_address}</span>
                                                </div>
                                                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg dark:bg-slate-800">
                                                    <Search className="h-3 w-3 shrink-0" />
                                                    <span className="truncate" title={log.user_agent}>Browser/Device: {log.user_agent}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <div className="pb-12 text-center text-[10px] text-slate-400">
                            * ข้อมูลชุดนี้เป็นหลักฐานอิเล็กทรอนิกส์ที่มีผลทางกฎหมายตาม มาตรา 7-9 แห่ง พ.ร.บ. ว่าด้วยธุรกรรมทางอิเล็กทรอนิกส์ฯ และได้รับการบันทึกด้วยกลไกที่แก้ไขไม่ได้ (Immutable Storage)
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
