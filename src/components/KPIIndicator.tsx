import React from "react";
import { ExcelRow } from "../types";
import { 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  FileCheck,
  ShieldCheck,
  Sparkles
} from "lucide-react";

interface KPIIndicatorProps {
  rows: ExcelRow[];
}

export default function KPIIndicator({ rows }: KPIIndicatorProps) {
  const totalScans = rows.length;
  const verifiedCount = rows.filter(row => row.is_verified).length;
  const pendingCount = totalScans - verifiedCount;
  
  // Calculate average confidence score safely
  const averageConfidence = totalScans > 0 
    ? Math.round(rows.reduce((sum, row) => sum + row.confidence_score, 0) / totalScans)
    : 0;

  // Track any active character verification alerts (combos of I/1 or O/0 currently unverified)
  const alertCount = rows.filter(row => {
    if (row.is_verified) return false;
    const code = row.manifest_code;
    const hasZero = code.includes("0");
    const hasO = code.includes("O") || code.includes("o");
    const hasOne = code.includes("1");
    const hasI = code.includes("I") || code.includes("i");
    return (hasZero && hasO) || (hasOne && hasI);
  }).length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      {/* Metric 1: Total Scanned */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
        <div>
          <span className="text-[10px] md:text-xs font-semibold uppercase text-slate-500 tracking-wider">Total Dokumen</span>
          <h3 className="text-xl md:text-2xl font-bold text-slate-900 mt-1">{totalScans} <span className="text-xs font-normal text-slate-400">Pcs</span></h3>
          <p className="text-[10px] text-slate-400 mt-1.5 flex items-center">
            <Sparkles className="h-3 w-3 text-yellow-500 mr-1 shrink-0" />
            OCR Berakurasi Maksimal
          </p>
        </div>
        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
          <TrendingUp className="h-5 w-5" />
        </div>
      </div>

      {/* Metric 2: Verified Items */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
        <div>
          <span className="text-[10px] md:text-xs font-semibold uppercase text-slate-500 tracking-wider">Verifikasi Fisik</span>
          <h3 className="text-xl md:text-2xl font-bold text-slate-900 mt-1">
            {verifiedCount} <span className="text-xs font-normal text-slate-400">/ {totalScans}</span>
          </h3>
          <div className="w-20 bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${totalScans > 0 ? (verifiedCount / totalScans) * 100 : 0}%` }}
            />
          </div>
        </div>
        <div className={`p-3 rounded-xl ${verifiedCount === totalScans && totalScans > 0 ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-500"}`}>
          <FileCheck className="h-5 w-5" />
        </div>
      </div>

      {/* Metric 3: Avg OCR Confidence */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
        <div>
          <span className="text-[10px] md:text-xs font-semibold uppercase text-slate-500 tracking-wider">Keandalan Gemini API</span>
          <h3 className={`text-xl md:text-2xl font-bold mt-1 ${
            averageConfidence >= 90 ? "text-green-600" :
            averageConfidence >= 75 ? "text-amber-600" : "text-red-600"
          }`}>
            {averageConfidence}%
          </h3>
          <p className="text-[10px] text-slate-400 mt-1.5 flex items-center">
            <ShieldCheck className="h-3 w-3 text-emerald-500 mr-1 shrink-0" />
            Model gemini-3.5-flash
          </p>
        </div>
        <div className="p-3 bg-green-50 text-green-600 rounded-xl">
          <CheckCircle2 className="h-5 w-5" />
        </div>
      </div>

      {/* Metric 4: Ambiguity warnings */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
        <div>
          <span className="text-[10px] md:text-xs font-semibold uppercase text-slate-500 tracking-wider">Antisipasi Karakter Ambigu</span>
          <h3 className={`text-xl md:text-2xl font-bold mt-1 ${alertCount > 0 ? "text-amber-600" : "text-slate-900"}`}>
            {alertCount} <span className="text-xs font-normal text-slate-400">Peringatan</span>
          </h3>
          <p className="text-[10px] text-slate-400 mt-1.5 flex items-center truncate">
            {alertCount > 0 ? (
              <>
                <AlertCircle className="h-3.5 w-3.5 text-amber-500 mr-1 shrink-0" />
                <span className="text-amber-700 font-medium">Butuh pembetulan manual</span>
              </>
            ) : (
              "Semua karakter aman"
            )}
          </p>
        </div>
        <div className={`p-3 rounded-xl ${alertCount > 0 ? "bg-amber-50 text-amber-600 animate-pulse" : "bg-slate-50 text-slate-500"}`}>
          <AlertCircle className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
