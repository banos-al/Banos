import React, { useState } from "react";
import { ExcelRow } from "../types";
import { 
  CheckCircle2, 
  X, 
  Trash2, 
  Download, 
  FileSpreadsheet, 
  Search, 
  AlertCircle, 
  Eye, 
  FileText,
  Trash
} from "lucide-react";

interface ExcelGridProps {
  rows: ExcelRow[];
  selectedRowId: string | null;
  onSelectRow: (id: string | null) => void;
  onUpdateRow: (id: string, updatedFields: Partial<ExcelRow>) => void;
  onDeleteRow: (id: string) => void;
  onClearSheet: () => void;
  onAddRow: () => void;
  onExportCSV: () => void;
}

export default function ExcelGrid({
  rows,
  selectedRowId,
  onSelectRow,
  onUpdateRow,
  onDeleteRow,
  onClearSheet,
  onAddRow,
  onExportCSV,
}: ExcelGridProps) {
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: keyof ExcelRow } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Start cell editing
  const handleDoubleClick = (rowId: string, field: keyof ExcelRow, currentValue: any) => {
    // Prevent editing non-editable metadata fields
    if (field === "id" || field === "scan_timestamp" || field === "image_base64" || field === "confidence_score") return;
    setEditingCell({ rowId, field });
    setEditValue(String(currentValue || ""));
  };

  // Commit editing changes
  const handleCellBlur = () => {
    if (editingCell) {
      onUpdateRow(editingCell.rowId, { [editingCell.field]: editValue });
      setEditingCell(null);
    }
  };

  const handleCellKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCellBlur();
    } else if (e.key === "Escape") {
      setEditingCell(null);
    }
  };

  // Filter rows based on search input
  const filteredRows = rows.filter(row => {
    const q = searchQuery.toLowerCase();
    return (
      row.manifest_code.toLowerCase().includes(q) ||
      row.hosp_invoice.toLowerCase().includes(q) ||
      row.sender.toLowerCase().includes(q) ||
      row.recipient.toLowerCase().includes(q) ||
      row.logistics_courier.toLowerCase().includes(q) ||
      row.filename.toLowerCase().includes(q)
    );
  });

  // Highlight ambiguous characters with friendly colors
  const renderHighlitCode = (code: string) => {
    if (!code) return <span className="text-gray-400">-</span>;
    return (
      <span className="font-mono tracking-wider font-semibold inline-flex flex-wrap gap-0">
        {code.split("").map((char, index) => {
          let bgStyle = "";
          let tooltip = "";
          if (char === "0") {
            bgStyle = "bg-amber-100 text-amber-800 border-b border-amber-400 font-bold px-0.5 rounded";
            tooltip = "Digit ANGKA '0' (Nol)";
          } else if (char === "O" || char === "o") {
            bgStyle = "bg-sky-100 text-sky-800 border-b border-sky-400 font-bold px-0.5 rounded";
            tooltip = "Huruf ALFABET 'O'";
          } else if (char === "1") {
            bgStyle = "bg-emerald-100 text-emerald-800 border-b border-emerald-400 font-bold px-0.5 rounded";
            tooltip = "Digit ANGKA '1' (Satu)";
          } else if (char === "I" || char === "i") {
            bgStyle = "bg-indigo-100 text-indigo-700 border-b border-indigo-400 font-bold px-0.5 rounded";
            tooltip = "Huruf ALFABET 'I'";
          } else if (char === "5") {
            bgStyle = "bg-purple-100 text-purple-800 border-b border-purple-400 font-bold px-0.5 rounded";
            tooltip = "Digit ANGKA '5'";
          } else if (char === "S" || char === "s") {
            bgStyle = "bg-pink-100 text-pink-700 border-b border-pink-400 font-bold px-0.5 rounded";
            tooltip = "Huruf ALFABET 'S'";
          }
          return (
            <span key={index} className={bgStyle} title={tooltip}>
              {char}
            </span>
          );
        })}
      </span>
    );
  };

  // Check if string contains any ambiguous character pairings
  const checkAmbiguities = (code: string) => {
    const hasZero = code.includes("0");
    const hasO = code.includes("O") || code.includes("o");
    const hasOne = code.includes("1");
    const hasI = code.includes("I") || code.includes("i");
    const hasFive = code.includes("5");
    const hasS = code.includes("S") || code.includes("s");

    const issues: string[] = [];
    if (hasZero && hasO) issues.push("Mengandung O & 0");
    if (hasOne && hasI) issues.push("Mengandung I & 1");
    if (hasFive && hasS) issues.push("Mengandung S & 5");
    return issues;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
      {/* Spreadsheet Title & Actions bar */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 text-sm md:text-base">Lembar Kerja Excel Surat Jalan / Resi</h2>
            <p className="text-xs text-slate-500">Klik ganda pada sel untuk mengedit data secara langsung layaknya MS Excel.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Real-time search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Cari dalam sheet..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none w-44 md:w-56"
              id="sheet-search-input"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <button
            onClick={onAddRow}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition active:scale-95 cursor-pointer"
            id="btn-add-excel-row"
          >
            <span>+ Baris</span>
          </button>

          <button
            onClick={onExportCSV}
            disabled={rows.length === 0}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition active:scale-95 disabled:opacity-55 disabled:cursor-not-allowed cursor-pointer shadow-sm"
            id="btn-export-excel"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="font-medium">Ekspor XLSX / CSV</span>
          </button>

          <button
            onClick={onClearSheet}
            disabled={rows.length === 0}
            className="flex items-center space-x-1 px-2.5 py-1.5 text-xs text-red-600 border border-red-100 bg-red-50 rounded-lg hover:bg-red-100 hover:border-red-200 transition active:scale-95 disabled:opacity-55 disabled:cursor-not-allowed cursor-pointer"
            id="btn-clear-excel"
            title="Kosongkan seluruh data sheet"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Spreadsheet Layout Container */}
      <div className="flex-1 overflow-auto">
        {filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center h-full bg-slate-50/20">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shadow-inner mb-4">
              <FileText className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="font-semibold text-slate-700 text-sm md:text-base">Belum Ada Baris Data</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              {searchQuery 
                ? "Pencarian Anda tidak menemukan hasil. Kosongkan filter pencarian."
                : "Unggah gambar dokumen logistik atau aktifkan kamera pengiriman untuk mendeteksi Nomor Hosp. Invoice secara langsung."}
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse table-fixed select-none" id="excel-data-table">
            {/* Sheet Column Headers */}
            <thead>
              <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase font-semibold text-center border-b border-slate-200 sticky top-0 z-10">
                <th className="w-12 border-r border-slate-200 bg-slate-200 p-1 select-none"></th>
                <th className="w-16 border-r border-slate-200 p-1 md:p-2">A<br/><span className="text-[9px] text-slate-500 capitalize">Verifik</span></th>
                <th className="w-24 border-r border-slate-200 p-1 md:p-2">B<br/><span className="text-[9px] text-slate-500 capitalize">Tanggal Scan</span></th>
                <th className="w-32 border-r border-slate-200 p-1 md:p-2">C<br/><span className="text-[9px] text-slate-500 capitalize">Nama File</span></th>
                <th className="w-44 border-r border-slate-200 p-1 md:p-2 bg-emerald-50/60 text-emerald-900 border-b-2 border-b-emerald-300">D<br/><span className="text-[9px] text-emerald-700 font-semibold capitalize">Nomor Hosp. Invoice</span></th>
                <th className="w-56 border-r border-slate-200 p-1 md:p-2 bg-blue-50/60 text-blue-900 border-b-2 border-b-blue-300">E<br/><span className="text-[9px] text-blue-700 font-semibold capitalize">Kode Surat Jalan</span></th>
                <th className="w-28 border-r border-slate-200 p-1 md:p-2">F<br/><span className="text-[9px] text-slate-500 capitalize">Tgl Dokumen</span></th>
                <th className="w-36 border-r border-slate-200 p-1 md:p-2">G<br/><span className="text-[9px] text-slate-500 capitalize">Pengirim</span></th>
                <th className="w-36 border-r border-slate-200 p-1 md:p-2">H<br/><span className="text-[9px] text-slate-500 capitalize">Penerima</span></th>
                <th className="w-32 border-r border-slate-200 p-1 md:p-2">I<br/><span className="text-[9px] text-slate-500 capitalize">Kurir Logistik</span></th>
                <th className="w-20 border-r border-slate-200 p-1 md:p-2">J<br/><span className="text-[9px] text-slate-500 capitalize">Akurasi %</span></th>
                <th className="w-48 border-r border-slate-200 p-1 md:p-2">K<br/><span className="text-[9px] text-slate-500 capitalize">Catatan / Analisa</span></th>
                <th className="w-24 p-1 md:p-2 bg-red-50/20">L<br/><span className="text-[9px] text-red-500 capitalize">Aksi</span></th>
              </tr>
            </thead>

            {/* Grid Rows */}
            <tbody className="divide-y divide-slate-200">
              {filteredRows.map((row, index) => {
                const ambiguities = checkAmbiguities(row.manifest_code);
                const hasAmbiguityIssue = ambiguities.length > 0;
                
                return (
                  <tr
                    key={row.id}
                    className={`text-xs text-slate-700 hover:bg-blue-50/30 transition cursor-pointer select-text ${
                      selectedRowId === row.id ? "bg-blue-50/80 border-l-2 border-l-blue-600" : ""
                    } ${row.is_verified ? "bg-emerald-50/60" : ""}`}
                    onClick={() => onSelectRow(row.id)}
                    id={`row-${row.id}`}
                  >
                    {/* Row Number Column */}
                    <td className="border-r border-slate-200 bg-slate-50 text-[10px] text-slate-500 font-mono text-center select-none font-semibold sticky left-0 z-[2]">
                      {index + 1}
                    </td>

                    {/* Col A: Verifik Checkbox */}
                    <td className="border-r border-slate-200 text-center p-1.5">
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={row.is_verified}
                          onChange={(e) => {
                            e.stopPropagation();
                            onUpdateRow(row.id, { is_verified: e.target.checked });
                          }}
                          className="h-4.5 w-4.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                          id={`chk-verify-${row.id}`}
                          title={row.is_verified ? "Terverifikasi" : "Tandai sudah diverifikasi fisik"}
                        />
                      </div>
                    </td>

                    {/* Col B: Tanggal Scan */}
                    <td className="border-r border-slate-200 p-1.5 text-[10px] text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis">
                      {row.scan_timestamp}
                    </td>

                    {/* Col C: Nama File */}
                    <td 
                      className="border-r border-slate-200 p-1.5 font-mono text-[10px] text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap"
                      onDoubleClick={() => handleDoubleClick(row.id, "filename", row.filename)}
                      title="Klik ganda untuk edit nama file"
                    >
                      {editingCell?.rowId === row.id && editingCell?.field === "filename" ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleCellKeyDown}
                          autoFocus
                          className="excel-cell-input text-[10px] font-mono"
                        />
                      ) : (
                        row.filename
                      )}
                    </td>

                     {/* Col D: Nomor Hosp. Invoice */}
                    <td
                      className="border-r border-slate-200 p-1.5 font-mono text-slate-800 overflow-hidden text-ellipsis whitespace-nowrap"
                      onDoubleClick={() => handleDoubleClick(row.id, "hosp_invoice", row.hosp_invoice)}
                      title="Klik ganda untuk edit Nomor Hosp. Invoice"
                    >
                      {editingCell?.rowId === row.id && editingCell?.field === "hosp_invoice" ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleCellKeyDown}
                          autoFocus
                          className="excel-cell-input text-xs font-mono font-semibold"
                        />
                      ) : (
                        row.hosp_invoice ? renderHighlitCode(row.hosp_invoice) : <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Col E: Kode Surat Jalan (VITAL TARGET) */}
                    <td
                      className={`border-r border-slate-200 p-1.5 font-mono font-medium overflow-hidden text-ellipsis whitespace-nowrap relative ${
                        hasAmbiguityIssue ? "bg-amber-50/40" : ""
                      }`}
                      onDoubleClick={() => handleDoubleClick(row.id, "manifest_code", row.manifest_code)}
                      title="SANGAT PENTING: Klik ganda untuk membetulkan karakter typo O/0/I/1"
                    >
                      {editingCell?.rowId === row.id && editingCell?.field === "manifest_code" ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleCellKeyDown}
                          autoFocus
                          className="excel-cell-input text-xs font-mono font-semibold"
                        />
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="truncate">
                            {renderHighlitCode(row.manifest_code)}
                          </div>
                          {hasAmbiguityIssue && !row.is_verified && (
                            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 ml-1" title={`Karakter ambigu terdeteksi: ${ambiguities.join(", ")}`} />
                          )}
                        </div>
                      )}
                    </td>

                    {/* Col F: Tanggal Dokumen */}
                    <td
                      className="border-r border-slate-200 p-1.5 overflow-hidden text-ellipsis whitespace-nowrap"
                      onDoubleClick={() => handleDoubleClick(row.id, "date", row.date)}
                    >
                      {editingCell?.rowId === row.id && editingCell?.field === "date" ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleCellKeyDown}
                          autoFocus
                          className="excel-cell-input text-xs"
                        />
                      ) : (
                        row.date || <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Col G: Nama Pengirim */}
                    <td
                      className="border-r border-slate-200 p-1.5 overflow-hidden text-ellipsis whitespace-nowrap text-slate-600"
                      onDoubleClick={() => handleDoubleClick(row.id, "sender", row.sender)}
                    >
                      {editingCell?.rowId === row.id && editingCell?.field === "sender" ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleCellKeyDown}
                          autoFocus
                          className="excel-cell-input text-xs"
                        />
                      ) : (
                        row.sender || <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Col H: Nama Penerima */}
                    <td
                      className="border-r border-slate-200 p-1.5 overflow-hidden text-ellipsis whitespace-nowrap text-slate-600"
                      onDoubleClick={() => handleDoubleClick(row.id, "recipient", row.recipient)}
                    >
                      {editingCell?.rowId === row.id && editingCell?.field === "recipient" ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleCellKeyDown}
                          autoFocus
                          className="excel-cell-input text-xs"
                        />
                      ) : (
                        row.recipient || <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Col I: Kurir Ekspedisi */}
                    <td
                      className="border-r border-slate-200 p-1.5 overflow-hidden text-ellipsis whitespace-nowrap"
                      onDoubleClick={() => handleDoubleClick(row.id, "logistics_courier", row.logistics_courier)}
                    >
                      {editingCell?.rowId === row.id && editingCell?.field === "logistics_courier" ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleCellKeyDown}
                          autoFocus
                          className="excel-cell-input text-xs"
                        />
                      ) : (
                        row.logistics_courier ? (
                          <span className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                            {row.logistics_courier}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )
                      )}
                    </td>

                    {/* Col J: Akurasi % */}
                    <td className="border-r border-slate-200 p-1.5 text-center font-mono">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        row.confidence_score >= 90 ? "bg-green-100 text-green-800" :
                        row.confidence_score >= 70 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
                      }`}>
                        {row.confidence_score}%
                      </span>
                    </td>

                    {/* Col K: Catatan / Analisa */}
                    <td
                      className="border-r border-slate-200 p-1.5 overflow-hidden text-ellipsis whitespace-nowrap text-slate-500 font-mono text-[10px]"
                      onDoubleClick={() => handleDoubleClick(row.id, "notes", row.notes)}
                    >
                      {editingCell?.rowId === row.id && editingCell?.field === "notes" ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleCellKeyDown}
                          autoFocus
                          className="excel-cell-input text-[10px]"
                        />
                      ) : (
                        row.notes || "-"
                      )}
                    </td>

                    {/* Col L: Aksi */}
                    <td className="p-1.5 text-center bg-slate-50/10">
                      <div className="flex items-center justify-center space-x-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectRow(row.id);
                          }}
                          className="p-1 text-slate-500 hover:text-blue-600 hover:bg-white rounded transition border border-transparent hover:border-slate-200 cursor-pointer"
                          title="Lihat Foto Surat Jalan Asli"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteRow(row.id);
                          }}
                          className="p-1 text-red-400 hover:text-red-600 hover:bg-white rounded transition border border-transparent hover:border-red-100 cursor-pointer"
                          title="Hapus baris"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Spreadsheet Status Footer */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center space-x-2">
          <span>Total: <strong>{filteredRows.length} baris terfilter</strong> (dari {rows.length} total baris)</span>
          <span className="text-slate-300">|</span>
          <span className="flex items-center text-amber-700">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block mr-1"></span>
            Mode Verifikasi Karakter Pelacak Aktif
          </span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="flex items-center gap-1.5">
            <span className="px-1 py-0.5 rounded font-mono font-bold bg-amber-100 text-amber-800">0</span> / <span className="px-1 py-0.5 rounded font-mono font-bold bg-sky-100 text-sky-800">O</span> : Koreksi Alfanumerik
          </span>
          <span className="flex items-center gap-1.5">
            <span className="px-1 py-0.5 rounded font-mono font-bold bg-emerald-100 text-emerald-800">1</span> / <span className="px-1 py-0.5 rounded font-mono font-bold bg-indigo-100 text-indigo-800">I</span> : Koreksi Identitas
          </span>
        </div>
      </div>
    </div>
  );
}
