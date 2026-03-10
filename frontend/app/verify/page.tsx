"use client";

import { Suspense } from "react";
import VerifyClient from "./VerifyClientView";

export default function VerifyPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
                <div className="text-slate-500">กำลังโหลด...</div>
            </div>
        }>
            <VerifyClient />
        </Suspense>
    );
}
