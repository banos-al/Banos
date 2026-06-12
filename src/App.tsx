/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  UploadCloud, 
  Camera, 
  FileCheck, 
  RefreshCw, 
  Plus, 
  Download, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Info,
  Layers,
  ArrowRight,
  Sparkles,
  Search,
  BookOpen,
  Image as ImageIcon,
  Check,
  X
} from "lucide-react";
import { ExcelRow } from "./types";
import ExcelGrid from "./components/ExcelGrid";
import CameraCapture from "./components/CameraCapture";
import KPIIndicator from "./components/KPIIndicator";
import { 
  initAuth, 
  googleSignIn, 
  logout, 
  listSpreadsheets, 
  createGoogleSheet, 
  exportToGoogleSheet, 
  importFromGoogleSheet, 
  backupToGoogleDrive, 
  listBackupsOnDrive, 
  downloadBackupContext 
} from "./lib/googleApi";
import { Cloud, Database, HardDrive, Link as LinkIcon, FileSpreadsheet as SheetIcon } from "lucide-react";

// Sample logistics presets for seamless testing!
const DOCUMENT_PRESETS = [
  {
    title: "Kuitansi Hosp. Invoice (Akurasi Tinggi)",
    filename: "hosp_invoice_75260458_BI.png",
    hosp_invoice: "75260458-BI",
    manifest_code: "MS-016/APT/2026",
    date: "11-06-2026",
    sender: "RUMAH SAKIT UTAMA KENCANA",
    recipient: "DEPARTEMEN FARMASI APOTEK",
    logistics_courier: "Internal Hospital Dispatch",
    confidence_score: 100,
    notes: "Hasil deteksi 'Nomor Hosp. Invoice: 75260458-BI' sukses diekstrak sempurna.",
    demo_image_placeholder: "srm_cargo_placeholder"
  },
  {
    title: "Nota Hosp. Invoice (Ambigu O vs 0)",
    filename: "hosp_invoice_9042O15.png",
    hosp_invoice: "9042O154-BI", // contains O instead of 0
    manifest_code: "MS-089/APT/2026",
    date: "09-06-2026",
    sender: "LABORATORIUM KLINIK AMANAH",
    recipient: "APOTEK MEDIKA SEJAHTERA",
    logistics_courier: "Bio-Logistics Courier",
    confidence_score: 93,
    notes: "PERINGATAN: Karakter O (alphabet) terdeteksi menggantikan angka 0 pada nomor invoice. Mohon verifikasi ulang.",
    demo_image_placeholder: "jnt_resi_placeholder"
  },
  {
    title: "Invoice Hosp. Sentosa Internasional",
    filename: "sentosa_invoice_109282.png",
    hosp_invoice: "10928237-BI",
    manifest_code: "MS-104/APT/2026",
    date: "22-05-2026",
    sender: "SENTOSA MEDICAL GROUP JKT",
    recipient: "TOKO OBAT RAHAYU INDAH",
    logistics_courier: "Sentosa Internal Logistics",
    confidence_score: 98,
    notes: "Pencocokan label invoice 'Nomor Hosp. Invoice : 10928237-BI' terdeteksi valid.",
    demo_image_placeholder: "dhl_invoice_placeholder"
  }
];

export default function App() {
  const [rows, setRows] = useState<ExcelRow[]>([]);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [activeScanStep, setActiveScanStep] = useState<string>("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Google Auth & Workspace State Variables
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [customGeminiApiKey, setCustomGeminiApiKey] = useState<string>(() => {
    return localStorage.getItem("custom_gemini_api_key") || "";
  });
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [isKeySavedFeedback, setIsKeySavedFeedback] = useState(false);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [needsGoogleAuth, setNeedsGoogleAuth] = useState(true);
  const [googleSpreadsheets, setGoogleSpreadsheets] = useState<any[]>([]);
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState<string>("");
  const [googleBackups, setGoogleBackups] = useState<any[]>([]);
  const [selectedBackupId, setSelectedBackupId] = useState<string>("");
  const [googleStatusMsg, setGoogleStatusMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [shareableUrl, setShareableUrl] = useState<string | null>(null);

  // Load rows from client-side localStorage and configure Google Sign-in on mount
  useEffect(() => {
    const saved = localStorage.getItem("ocr_excel_rows");
    if (saved) {
      try {
        setRows(JSON.parse(saved));
      } catch (err) {
        console.error("Failed to load saved spreadsheet layers:", err);
      }
    }

    // Subscribe to Google Authentication state securely on mount
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
        setNeedsGoogleAuth(false);
        loadDriveContent(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
        setNeedsGoogleAuth(true);
      }
    );

    return () => unsubscribe();
  }, []);

  // Helper: Refresh lists of Sheets and backups located on Drive
  const loadDriveContent = async (token: string) => {
    try {
      setIsGoogleLoading(true);
      const sheets = await listSpreadsheets(token);
      setGoogleSpreadsheets(sheets);
      if (sheets.length > 0) {
        setSelectedSpreadsheetId(sheets[0].id);
      }
      const backups = await listBackupsOnDrive(token);
      setGoogleBackups(backups);
      if (backups.length > 0) {
        setSelectedBackupId(backups[0].id);
      }
    } catch (err: any) {
      console.error("Failed to refresh Google Drive content on mount/login:", err);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Google PopUp Authentication Handler
  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setGoogleStatusMsg(null);
    setShareableUrl(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setGoogleToken(result.accessToken);
        setNeedsGoogleAuth(false);
        setGoogleStatusMsg({ 
          type: "success", 
          text: `Selamat datang, ${result.user.displayName}! Login Google berhasil.` 
        });
        await loadDriveContent(result.accessToken);
      }
    } catch (err: any) {
      console.error("Google Authentication error:", err);
      setGoogleStatusMsg({ 
        type: "error", 
        text: `Gagal menghubungkan Akun Google: ${err.message || err}` 
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Google Log-Out Handler
  const handleGoogleLogout = async () => {
    setIsGoogleLoading(true);
    setShareableUrl(null);
    try {
      await logout();
      setGoogleUser(null);
      setGoogleToken(null);
      setNeedsGoogleAuth(true);
      setGoogleSpreadsheets([]);
      setGoogleBackups([]);
      setGoogleStatusMsg({ type: "info", text: "Berhasil keluar dari Akun Google." });
    } catch (err: any) {
      console.error("Google sign out error:", err);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Google Sheets: Create Spreadsheet & Write Rows
  const handleCreateAndExportSheet = async () => {
    if (!googleToken) {
      setGoogleStatusMsg({ type: "error", text: "Silakan hubungkan akun Google terlebih dahulu." });
      return;
    }
    if (rows.length === 0) {
      setGoogleStatusMsg({ type: "error", text: "Tidak ada baris data lembar kerja untuk diekspor ke Google Sheets." });
      return;
    }

    setIsGoogleLoading(true);
    setGoogleStatusMsg({ type: "info", text: "Memproses pembuatan spreadsheet Google baru..." });
    try {
      const title = `Log OCR Invoice & Surat Jalan (${new Date().toLocaleDateString("id-ID")})`;
      const { spreadsheetId, spreadsheetUrl } = await createGoogleSheet(googleToken, title);
      await exportToGoogleSheet(googleToken, spreadsheetId, rows);
      setShareableUrl(spreadsheetUrl);
      setGoogleStatusMsg({ 
        type: "success", 
        text: `Berhasil mengekspor ${rows.length} baris data ke Google Sheet baru: "${title}"!` 
      });
      await loadDriveContent(googleToken);
      setSelectedSpreadsheetId(spreadsheetId);
    } catch (err: any) {
      console.error("Google Sheet Export error:", err);
      setGoogleStatusMsg({ type: "error", text: `Pengiriman data gagat: ${err.message || err}` });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Google Sheets: Populate selected Spreadsheet
  const handleExportToExistingSheet = async () => {
    if (!googleToken) {
      setGoogleStatusMsg({ type: "error", text: "Silakan hubungkan akun Google terlebih dahulu." });
      return;
    }
    if (!selectedSpreadsheetId) {
      setGoogleStatusMsg({ type: "error", text: "Pilih file Google Sheet tujuan terlebih dahulu dari daftar." });
      return;
    }
    if (rows.length === 0) {
      setGoogleStatusMsg({ type: "error", text: "Tidak ada baris data untuk diekspor." });
      return;
    }

    const confirmed = window.confirm("Mendaur Ulang Data: Tindakan ini akan menimpa seluruh baris data di 'Sheet1' pada Google Sheet terpilih. Lanjutkan?");
    if (!confirmed) return;

    setIsGoogleLoading(true);
    setGoogleStatusMsg({ type: "info", text: "Mengunggah logs ke Google Sheet terpilih..." });
    try {
      await exportToGoogleSheet(googleToken, selectedSpreadsheetId, rows);
      const selectedObj = googleSpreadsheets.find(s => s.id === selectedSpreadsheetId);
      setShareableUrl(selectedObj?.webViewLink || `https://docs.google.com/spreadsheets/d/${selectedSpreadsheetId}/edit`);
      setGoogleStatusMsg({ 
        type: "success", 
        text: `Sukses menyimpan log data ke "${selectedObj?.name || selectedSpreadsheetId}"!` 
      });
    } catch (err: any) {
      console.error(err);
      setGoogleStatusMsg({ type: "error", text: `Gagal memperbarui sheet: ${err.message || err}` });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Google Sheets: Read Spreadsheet Values
  const handleImportSheet = async () => {
    if (!googleToken) {
      setGoogleStatusMsg({ type: "error", text: "Silakan hubungkan akun Google terlebih dahulu." });
      return;
    }
    if (!selectedSpreadsheetId) {
      setGoogleStatusMsg({ type: "error", text: "Pilih file Google Sheet sumber terlebih dahulu dari daftar." });
      return;
    }

    const confirmed = window.confirm("Unduh Data: Log data di 'Sheet1' pada Google Sheet terpilih akan digabungkan ke tabel kerja Anda. Lanjutkan?");
    if (!confirmed) return;

    setIsGoogleLoading(true);
    setGoogleStatusMsg({ type: "info", text: "Mengimpor data dari Google Sheet..." });
    try {
      const importedData = await importFromGoogleSheet(googleToken, selectedSpreadsheetId);
      if (importedData.length === 0) {
        setGoogleStatusMsg({ type: "info", text: "Google Sheet terpilih kosong atau tidak berisi log di Sheet1." });
        return;
      }

      const formatted: ExcelRow[] = importedData.map((item, idx) => ({
        id: "row_imported_" + Date.now() + "_" + idx + "_" + Math.random().toString(36).substring(2, 5),
        scan_timestamp: item.scan_timestamp || new Date().toLocaleString("id-ID"),
        filename: item.filename || "google_sheet_import.png",
        image_base64: "", // imported rows don't have images
        hosp_invoice: item.hosp_invoice || "N/A",
        manifest_code: item.manifest_code || "KODE_KOSONG",
        date: item.date || "-",
        sender: item.sender || "-",
        recipient: item.recipient || "-",
        logistics_courier: item.logistics_courier || "-",
        confidence_score: item.confidence_score || 100,
        notes: item.notes || "Diimpor dari Google Sheet.",
        is_verified: item.is_verified || false
      }));

      const merged = [...rows, ...formatted];
      updateRowsState(merged);
      if (formatted.length > 0) {
        setSelectedRowId(formatted[0].id);
      }
      setGoogleStatusMsg({ 
        type: "success", 
        text: `Berhasil mengimpor ${formatted.length} baris log data dari Google Sheet ke dalam tabel log!` 
      });
    } catch (err: any) {
      console.error(err);
      setGoogleStatusMsg({ 
        type: "error", 
        text: `Gagal membaca sheet: ${err.message || err}. Pastikan susunan kolom selaras.` 
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Google Drive: Backup current array logs as JSON
  const handleBackupToDrive = async () => {
    if (!googleToken) {
      setGoogleStatusMsg({ type: "error", text: "Silakan hubungkan akun Google terlebih dahulu." });
      return;
    }
    if (rows.length === 0) {
      setGoogleStatusMsg({ type: "error", text: "Tidak ada baris data log untuk dicadangkan." });
      return;
    }

    setIsGoogleLoading(true);
    setGoogleStatusMsg({ type: "info", text: "Membuat berkas arsip JSON di Google Drive..." });
    try {
      const fileName = `ocr_hosp_invoice_backup_${new Date().toISOString().substring(0, 10)}.json`;
      const fileId = await backupToGoogleDrive(googleToken, rows, fileName);
      setGoogleStatusMsg({ 
        type: "success", 
        text: `Berhasil mencadangkan log data ke Google Drive (File: ${fileName})!` 
      });
      await loadDriveContent(googleToken);
      setSelectedBackupId(fileId);
    } catch (err: any) {
      console.error("Google Drive Backup error:", err);
      setGoogleStatusMsg({ type: "error", text: `Gagal mencadangkan: ${err.message || err}` });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Google Drive: Restore logs from chosen Backup
  const handleRestoreFromDrive = async () => {
    if (!googleToken) {
      setGoogleStatusMsg({ type: "error", text: "Silakan hubungkan akun Google terlebih dahulu." });
      return;
    }
    if (!selectedBackupId) {
      setGoogleStatusMsg({ type: "error", text: "Pilih file cadangan terlebih dahulu dari daftar arsip." });
      return;
    }

    const confirmed = window.confirm("Ambil Cadangan: Lembar kerja saat ini akan diganti sepenuhnya oleh data logs cadangan dari Google Drive. Lanjutkan?");
    if (!confirmed) return;

    setIsGoogleLoading(true);
    setGoogleStatusMsg({ type: "info", text: "Mengunduh cadangan..." });
    try {
      const restored = await downloadBackupContext(googleToken, selectedBackupId);
      if (Array.isArray(restored)) {
        updateRowsState(restored);
        if (restored.length > 0) {
          setSelectedRowId(restored[0].id);
        }
        setGoogleStatusMsg({ 
          type: "success", 
          text: `Pemulihan selesai! Berhasil memuat ${restored.length} log dari arsip Google Drive.` 
        });
      } else {
        throw new Error("Format berkas arsip cacat.");
      }
    } catch (err: any) {
      console.error(err);
      setGoogleStatusMsg({ type: "error", text: `Pemulihan gagal: ${err.message || err}` });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Update rows function and synchronize
  const updateRowsState = (newRows: ExcelRow[]) => {
    setRows(newRows);
    localStorage.setItem("ocr_excel_rows", JSON.stringify(newRows));
  };

  // Trigger file browser click
  const triggerFileBrowser = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle image files selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processImageFile(files[0]);
    }
  };

  // Handle drag and drop support
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processImageFile(files[0]);
    }
  };

  // Process the files and convert to base64
  const processImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setScanError("File harus berupa gambar dokumen logistik (JPEG, PNG, WebP).");
      return;
    }

    setScanError(null);
    setIsScanning(true);
    setActiveScanStep("Membaca file gambar...");

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        const base64String = (reader.result as string).split(",")[1];
        const mimeType = file.type;
        triggerOcrScan(base64String, mimeType, file.name);
      } else {
        setScanError("Gagal membaca struktur file dokumen.");
        setIsScanning(false);
      }
    };
    reader.onerror = () => {
      setScanError("Gagal memuat file gambar.");
      setIsScanning(false);
    };
    reader.readAsDataURL(file);
  };

  // Perform full-stack scan using our server-side proxy
  const triggerOcrScan = async (base64Image: string, mimeType: string, filename: string) => {
    setIsScanning(true);
    setScanError(null);
    
    const maxRetries = 5;
    let attempt = 1;
    let scanSuccess = false;
    
    while (attempt <= maxRetries && !scanSuccess) {
      try {
        if (attempt === 1) {
          setActiveScanStep("Mengunggah data ke server OCR...");
        } else {
          setActiveScanStep(`Mencoba kembali secara otomatis (Percobaan ${attempt} dari ${maxRetries})...`);
        }
        
        // Simulate incremental steps for rich UI experience on first attempt
        if (attempt === 1) {
          await new Promise((resolve) => setTimeout(resolve, 800));
          setActiveScanStep("Mencari label 'Nomor Hosp. Invoice'...");
          await new Promise((resolve) => setTimeout(resolve, 800));
          setActiveScanStep("Memverifikasi karakter kritis (O vs 0, I vs 1)...");
        }

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (customGeminiApiKey && customGeminiApiKey.trim() !== "") {
          headers["x-gemini-api-key"] = customGeminiApiKey.trim();
        }

        const response = await fetch("/api/scan", {
          method: "POST",
          headers: headers,
          body: JSON.stringify({
            image: base64Image,
            mimeType: mimeType,
            filename: filename
          })
        });

        const responseText = await response.text();
        let result: any;
        try {
          result = JSON.parse(responseText);
        } catch (parseErr) {
          // If response is HTML or any invalid format, construct a helpful and descriptive error
          const cleanText = responseText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 180);
          throw new Error(
            `Respons server tidak valid (bukan format JSON). Status: ${response.status} ${response.statusText || ""}. ` +
            `Isi respons hulu: "${cleanText || "Kosong"}..."`
          );
        }
        
        if (!response.ok || !result.success) {
          // Check for 429 or rateLimit flag in JSON
          if ((response.status === 429 || result.rateLimit) && attempt < maxRetries) {
            const waitMs = result.retryAfterMs || 30000;
            let secsLeft = Math.ceil(waitMs / 1000);
            
            console.warn(`[OCR Quota] Terkena batas kuota limit. Menunggu ${secsLeft} detik sebelum mencoba kembali...`);
            
            // Loop second-by-second to update the countdown text in the UI
            while (secsLeft > 0) {
              setActiveScanStep(
                `Batas kuota terdeteksi (429). Menunggu ${secsLeft} detik sebelum mencoba kembali secara otomatis...`
              );
              await new Promise((resolve) => setTimeout(resolve, 1000));
              secsLeft--;
            }
            
            attempt++;
            continue; // Retry next attempt
          }
          
          throw new Error(result.error || "Gagal melakukan OCR dokumen.");
        }

        const ocr = result.data;

        // Prepare new row configuration
        const newRow: ExcelRow = {
          id: "row_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
          scan_timestamp: new Date().toLocaleTimeString("id-ID") + ", " + new Date().toLocaleDateString("id-ID"),
          filename: filename,
          image_base64: `data:${mimeType};base64,${base64Image}`,
          hosp_invoice: ocr.hosp_invoice || "N/A",
          manifest_code: ocr.manifest_code || "KODE_KOSONG",
          date: ocr.date || "-",
          sender: ocr.sender || "-",
          recipient: ocr.recipient || "-",
          logistics_courier: ocr.logistics_courier || "-",
          confidence_score: ocr.confidence_score || 90,
          notes: ocr.notes || "Deteksi sukses.",
          is_verified: false
        };

        const updated = [...rows, newRow];
        updateRowsState(updated);
        setSelectedRowId(newRow.id);
        scanSuccess = true;

      } catch (err: any) {
        console.error(err);
        setScanError(err.message || "Gagal memproses gambar dokumen.");
        break; // Exit loop on unexpected errors
      }
    }
    
    setIsScanning(false);
    setActiveScanStep("");
  };

  // Insert a mock preset directly to let them test instantly
  const loadPresetData = (presetIndex: number) => {
    setScanError(null);
    const preset = DOCUMENT_PRESETS[presetIndex];
    
    // Generate a beautiful placeholder graphic representing shipping receipt in base64
    let barcodeLines = "";
    for (let i = 0; i < 30; i++) {
        const width = Math.random() > 0.4 ? "4" : "1";
        const gap = Math.random() > 0.4 ? "2" : "5";
        barcodeLines += `<rect x="${i*11 + 20}" y="100" width="${width}" height="60" fill="indigo" />`;
    }

    const mockSvgXml = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 300" width="100%" height="100%">
        <rect width="450" height="300" rx="10" fill="#ffffff" stroke="#e2e8f0" stroke-width="4"/>
        <text x="30" y="40" font-family="'JetBrains Mono', monospace" font-size="14" font-weight="bold" fill="#0f172a">${preset.sender}</text>
        <line x1="30" y1="55" x2="420" y2="55" stroke="#cbd5e1" stroke-width="1" />
        
        <text x="30" y="80" font-family="'Inter', sans-serif" font-size="11" fill="#475569">Tujuan: ${preset.recipient}</text>
        <text x="30" y="95" font-family="'Inter', sans-serif" font-size="11" fill="#475569">Kurir: ${preset.logistics_courier} (${preset.date})</text>
        
        <!-- Hospital symbol decoration -->
        <rect x="340" y="65" width="40" height="15" fill="#f1f5f9" rx="3" />
        <text x="345" y="76" font-family="'Inter', sans-serif" font-size="9" font-weight="bold" fill="#059669">HOSPITAL</text>
        
        <line x1="30" y1="120" x2="420" y2="120" stroke="#f1f5f9" stroke-width="1" />
        
        <text x="30" y="150" font-family="'Inter', sans-serif" font-size="12" font-weight="bold" fill="#059669">Nomor Hosp. Invoice :</text>
        <text x="30" y="185" font-family="'JetBrains Mono', monospace" font-size="20" font-weight="extrabold" fill="#047857" letter-spacing="1">${preset.hosp_invoice}</text>
        
        <line x1="30" y1="210" x2="420" y2="210" stroke="#cbd5e1" stroke-dasharray="3" stroke-width="1" />
        
        <text x="30" y="235" font-family="'Inter', sans-serif" font-size="10" fill="#64748b">KODE TRACER SURAT JALAN:</text>
        <text x="30" y="260" font-family="'JetBrains Mono', monospace" font-size="18" font-weight="bold" fill="#2563eb" letter-spacing="2">${preset.manifest_code}</text>
        
        <rect x="330" y="215" width="90" height="45" rx="5" fill="#ecfdf5" stroke="#a7f3d0" stroke-width="1" />
        <text x="345" y="240" font-family="'Inter', sans-serif" font-size="10" font-weight="bold" fill="#059669">INVOICE</text>
      </svg>
    `;

    const svgBase64 = "data:image/svg+xml;base64," + btoa(mockSvgXml);

    const newRow: ExcelRow = {
      id: "row_preset_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      scan_timestamp: new Date().toLocaleTimeString("id-ID") + ", " + new Date().toLocaleDateString("id-ID"),
      filename: preset.filename,
      image_base64: svgBase64,
      hosp_invoice: preset.hosp_invoice,
      manifest_code: preset.manifest_code,
      date: preset.date,
      sender: preset.sender,
      recipient: preset.recipient,
      logistics_courier: preset.logistics_courier,
      confidence_score: preset.confidence_score,
      notes: preset.notes,
      is_verified: false
    };

    const updated = [...rows, newRow];
    updateRowsState(updated);
    setSelectedRowId(newRow.id);
  };

  // Quick manually inserted blank row
  const handleAddBlankRow = () => {
    const blankRow: ExcelRow = {
      id: "row_manual_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      scan_timestamp: new Date().toLocaleTimeString("id-ID") + ", " + new Date().toLocaleDateString("id-ID"),
      filename: "input_manual.png",
      image_base64: "", // No image
      hosp_invoice: "",
      manifest_code: "MS-BARU-RESI-O01",
      date: new Date().toLocaleDateString("id-ID"),
      sender: "",
      recipient: "",
      logistics_courier: "",
      confidence_score: 100,
      notes: "Diinput secara manual.",
      is_verified: true
    };

    updateRowsState([...rows, blankRow]);
    setSelectedRowId(blankRow.id);
  };

  // Handle cell updating
  const handleUpdateRow = (id: string, updatedFields: Partial<ExcelRow>) => {
    const updated = rows.map(row => {
      if (row.id === id) {
        return { ...row, ...updatedFields };
      }
      return row;
    });
    updateRowsState(updated);
  };

  // Delete row
  const handleDeleteRow = (id: string) => {
    const updated = rows.filter(row => row.id !== id);
    updateRowsState(updated);
    if (selectedRowId === id) {
      setSelectedRowId(updated.length > 0 ? updated[updated.length - 1].id : null);
    }
  };

  // Clear sheet fully
  const handleClearSheet = () => {
    setShowClearConfirm(true);
  };

  const confirmClearSheet = () => {
    updateRowsState([]);
    setSelectedRowId(null);
    setShowClearConfirm(false);
  };

  // Export spreadsheet rows as real Excel-compatible CSV file
  const handleExportCSV = () => {
    if (rows.length === 0) return;

    // Indonesian compatible: we use semicolon to cleanly segregate columns without breaking formatting
    const headers = [
      "No",
      "Tanggal Scan",
      "Nama File",
      "Nomor Hosp. Invoice",
      "Kode Surat Jalan / Resi",
      "Tanggal Dokumen",
      "Nama Pengirim",
      "Nama Penerima",
      "Kurir Logistik",
      "Skor Akurasi (Confidence %)",
      "Status Verifikasi Operator",
      "Catatan Diagnostik"
    ];

    const fileRows = rows.map((row, index) => [
      index + 1,
      row.scan_timestamp,
      row.filename,
      `'${row.hosp_invoice}`, // Apostrophe prefix ensures Excel treats it as Text instead of Scientific notation! Critical!
      `'${row.manifest_code}`, // Treat manifest code as text strictly
      row.date,
      row.sender,
      row.recipient,
      row.logistics_courier,
      row.confidence_score,
      row.is_verified ? "TERVERIFIKASI" : "BELUM DIVERIFIKASI",
      row.notes
    ]);

    // Build standard CSV string
    const csvContent = [
      headers.join(";"),
      ...fileRows.map(e => e.map(val => {
        const strVal = String(val).replace(/"/g, '""');
        return `"${strVal}"`;
      }).join(";"))
    ].join("\n");

    // Add UTF-8 BOM byte sequence so Excel opens it automatically with correct encodings
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Data_OCR_Hosp_Invoice_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedRow = rows.find(r => r.id === selectedRowId);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top Professional Header Navigation */}
      <header className="bg-slate-900 text-white shadow-md border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="h-10 w-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white">
              <FileCheck className="h-6 w-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-bold tracking-tight">OCR Hosp. Invoice & Surat Jalan</h1>
                <span className="bg-emerald-400/20 text-emerald-400 text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider">High Accuracy</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Sistem OCR canggih untuk memindai manifest pengiriman dan mendeteksi Nomor Hosp. Invoice</p>
            </div>
          </div>

          {/* Quick status bar */}
          <div className="flex items-center space-x-3 text-xs text-slate-300">
            <div className="flex items-center text-emerald-400 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 block mr-1.5 animate-pulse"></span>
              Sistem Logistik Online
            </div>
            <span className="text-slate-700">|</span>
            <div className="text-slate-400 font-mono">
              SDK @google/genai &bull; Gemini 3.5
            </div>
          </div>
        </div>
      </header>

      {/* Main Core View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col space-y-6">
        
        {/* KPI Dashboard Analytics Summary */}
        <KPIIndicator rows={rows} />

        {/* Two Column Layout: Scanners & Controls on Left, Spreadsheet Grid on Right */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: UPLOADER & CAPTURE CONTROLS (span 4/12) */}
          <div className="xl:col-span-4 flex flex-col gap-6">
            
            {/* Input Selection Center (File Upload & Camera Switch) */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 text-sm flex items-center">
                  <Layers className="h-4.5 w-4.5 text-blue-600 mr-2" />
                  Sumber Pemindai Gambar
                </h3>
                <button
                  onClick={() => setShowCamera(!showCamera)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg border transition active:scale-95 flex items-center cursor-pointer ${
                    showCamera 
                      ? "bg-slate-100 text-slate-700 border-slate-200" 
                      : "bg-blue-600 text-white border-transparent hover:bg-blue-700"
                  }`}
                  id="btn-toggle-view"
                >
                  {showCamera ? (
                    <>
                      <UploadCloud className="h-3.5 w-3.5 mr-1" />
                      <span>Ganti ke Upload</span>
                    </>
                  ) : (
                    <>
                      <Camera className="h-3.5 w-3.5 mr-1" />
                      <span>Ganti ke Kamera</span>
                    </>
                  )}
                </button>
              </div>

              {/* Loader UI for Scanning Process */}
              {isScanning && (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex flex-col items-center justify-center text-center animate-pulse" id="scan-loading-indicator">
                  <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mb-3" />
                  <h4 className="font-semibold text-blue-900 text-xs">Sedang Menganalisis Dokumen...</h4>
                  <p className="text-[10px] text-blue-600 font-mono mt-1">{activeScanStep}</p>
                </div>
              )}

              {/* Error Box feedback */}
              {scanError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-start space-x-2 text-xs text-red-700 font-medium" id="scan-error-log">
                  <AlertTriangle className="h-4.5 w-4.5 shrink-0 mt-0.5 text-red-500" />
                  <div>
                    <h4 className="font-bold">Error Terjadi:</h4>
                    <p className="text-[11px] mt-0.5">{scanError}</p>
                  </div>
                </div>
              )}

              {/* 1. Camera live view capture mode */}
              {showCamera ? (
                <CameraCapture 
                  onCapture={triggerOcrScan}
                  isScanning={isScanning}
                />
              ) : (
                /* 2. Drag & Drop file upload mode */
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={triggerFileBrowser}
                  className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    dragOver 
                      ? "border-emerald-500 bg-emerald-50/40" 
                      : "border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50"
                  }`}
                  id="drop-zone-uploader"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-element-uploader"
                  />
                  <div className="w-12 h-12 bg-white rounded-xl border border-slate-200 flex items-center justify-center shadow-sm text-slate-500 mb-3 hover:text-emerald-600 transition">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <h4 className="font-semibold text-slate-700 text-xs">Tarik & Lepas Gambar ke Sini</h4>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-[210px]">Atau klik untuk menelusuri folder kuitansi logistik di komputer Anda (JPEG/PNG)</p>
                </div>
              )}
            </div>

            {/* GOOGLE WORKSPACE SYNC CENTER CARD */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="font-bold text-slate-800 text-sm flex items-center">
                  <Cloud className="h-5 w-5 text-blue-500 mr-2" />
                  Sinkronisasi Google Workspace
                </h3>
                <span className="bg-blue-50 text-blue-600 text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider">Drive & Sheets</span>
              </div>

              {/* Status Message Badge */}
              {googleStatusMsg && (
                <div className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                  googleStatusMsg.type === "success" 
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-100" 
                    : googleStatusMsg.type === "error"
                    ? "bg-red-50 text-red-800 border border-red-100"
                    : "bg-blue-50 text-blue-800 border border-blue-100"
                }`}>
                  <div className="flex-1 text-[11px] font-medium leading-relaxed">
                    {googleStatusMsg.text}
                  </div>
                  <button 
                    onClick={() => setGoogleStatusMsg(null)}
                    className="text-slate-400 hover:text-slate-600 font-bold px-1 text-[11px]"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Shareable Link Indicator if available */}
              {shareableUrl && (
                <a 
                  href={shareableUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 p-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition"
                >
                  <span className="flex items-center">
                    <LinkIcon className="h-4 w-4 mr-1.5 shrink-0" />
                    Buka Google Sheet Hasil Ekspor
                  </span>
                  <span className="text-[10px] font-mono underline">Buka Lembar Kerja ↗</span>
                </a>
              )}

              {/* 1. If user needs Google authentication */}
              {needsGoogleAuth ? (
                <div className="flex flex-col gap-3">
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Hubungkan akun Google Anda untuk mengekspor log data langsung ke Google Sheets, mengimpor secara langsung, dan mencadangkan data Excel di Google Drive.
                  </p>
                  <button
                    onClick={handleGoogleLogin}
                    disabled={isGoogleLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition active:scale-95 disabled:opacity-55 cursor-pointer"
                    id="btn-google-login"
                  >
                    {isGoogleLoading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <svg className="h-4 w-4 fill-current shrink-0" viewBox="0 0 24 24">
                          <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.51 0-6.377-2.87-6.377-6.38s2.87-6.38 6.377-6.38c1.5 0 2.89.51 3.99 1.455l3.24-3.24C19.12 1.635 15.84 0 12.24 0 5.58 0 0 5.58 0 12.24s5.58 12.24 12.24 12.24c6.8 0 12.24-5.44 12.24-12.24 0-.765-.085-1.53-.255-2.215H12.24z" />
                        </svg>
                        Hubungkan Google Workspace
                      </>
                    )}
                  </button>
                </div>
              ) : (
                /* 2. Logged In Content: Sheets & Drive Sync controls */
                <div className="flex flex-col gap-4">
                  {/* Logged in User Profile Info */}
                  <div className="flex items-center justify-between bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                    <div className="flex items-center space-x-2">
                      {googleUser?.photoURL ? (
                        <img 
                          src={googleUser.photoURL} 
                          alt="Google Avatar" 
                          className="h-7 w-7 rounded-full border border-slate-200" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center text-xs">
                          {googleUser?.displayName?.charAt(0) || "G"}
                        </div>
                      )}
                      <div className="leading-tight">
                        <h4 className="text-xs font-bold text-slate-800 truncate max-w-[140px]">{googleUser?.displayName}</h4>
                        <p className="text-[10px] text-slate-400 truncate max-w-[140px]">{googleUser?.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleGoogleLogout}
                      className="px-2 py-1 text-[10px] font-semibold hover:bg-red-50 text-red-600 border border-slate-200 hover:border-red-100 rounded-lg transition active:scale-95 cursor-pointer flex items-center gap-1"
                      id="btn-google-logout"
                    >
                      Putus
                    </button>
                  </div>

                  {/* SECTION A: GOOGLE SHEETS */}
                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Aksi Google Sheets</span>
                      <SheetIcon className="h-3.5 w-3.5 text-emerald-600" />
                    </h4>
                    
                    {/* Choose active spreadsheet Dropdown */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-500 block">Pilih Spreadsheet Aktif:</label>
                      {googleSpreadsheets.length > 0 ? (
                        <select
                          value={selectedSpreadsheetId}
                          onChange={(e) => setSelectedSpreadsheetId(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        >
                          {googleSpreadsheets.map((sheet) => (
                            <option key={sheet.id} value={sheet.id}>
                              {sheet.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-[10px] text-slate-400 italic bg-slate-50 p-1.5 rounded">Belum ada file spreadsheet. Buat spreadsheet baru lewat tombol dibawah.</p>
                      )}
                    </div>

                    {/* Integrated Sheets Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={handleCreateAndExportSheet}
                        disabled={isGoogleLoading}
                        className="col-span-2 py-1.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                        title="Buat Google Sheet baru dan ekspor semua baris data"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Buat & Ekspor Sheet Baru
                      </button>

                      <button
                        onClick={handleExportToExistingSheet}
                        disabled={isGoogleLoading || !selectedSpreadsheetId}
                        className="py-1.5 bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-55"
                        title="Tulis dan timpa spreadsheet terpilih di Google Sheets"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Ekspor ke Terpilih
                      </button>

                      <button
                        onClick={handleImportSheet}
                        disabled={isGoogleLoading || !selectedSpreadsheetId}
                        className="py-1.5 bg-slate-50 text-slate-800 hover:bg-slate-100 border border-slate-200 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-55"
                        title="Impor / unduh lembar kerja data dari Google Sheets terpilih"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Impor Log Sheet
                      </button>
                    </div>
                  </div>

                  {/* SECTION B: GOOGLE DRIVE BACKUPS */}
                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Arsip Cadangan (Google Drive)</span>
                      <HardDrive className="h-3.5 w-3.5 text-blue-600" />
                    </h4>

                    {/* Select Backup File */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-500 block">Pilih Arsip Cadangan:</label>
                      {googleBackups.length > 0 ? (
                        <select
                          value={selectedBackupId}
                          onChange={(e) => setSelectedBackupId(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        >
                          {googleBackups.map((backup) => (
                            <option key={backup.id} value={backup.id}>
                              {backup.name} ({new Date(backup.createdTime).toLocaleDateString("id-ID")})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-[10px] text-slate-400 italic bg-slate-50 p-1.5 rounded">Belum ada file cadangan di Google Drive.</p>
                      )}
                    </div>

                    {/* Drive Backup Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={handleBackupToDrive}
                        disabled={isGoogleLoading}
                        className="py-1.5 bg-slate-100 border border-slate-200 text-slate-800 hover:bg-slate-200 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                        title="Simpan cadangan baru JSON ke Google Drive"
                      >
                        <Database className="h-3.5 w-3.5 mr-0.5 text-blue-500" />
                        Buat Cadangan
                      </button>

                      <button
                        onClick={handleRestoreFromDrive}
                        disabled={isGoogleLoading || !selectedBackupId}
                        className="py-1.5 bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-55"
                        title="Pulihkan data logs lokal dari file cadangan terpilih di Google Drive"
                      >
                        <RefreshCw className="h-3.5 w-3.5 text-amber-600 mr-0.5" />
                        Pulihkan
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* GEMINI CUSTOM API KEY CONFIGURATION CARD */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="font-bold text-slate-800 text-sm flex items-center">
                  <Database className="h-5 w-5 text-indigo-500 mr-2" />
                  Kunci API Gemini Kustom
                </h3>
                {customGeminiApiKey ? (
                  <span className="bg-indigo-50 text-indigo-600 text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider">Kustom Aktif</span>
                ) : (
                  <span className="bg-slate-100 text-slate-500 text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider">Default Server</span>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Jika Anda mengalami limit kuota (429) atau error akses ditolak (403 PERMISSION_DENIED) dari server bawaan, masukkan kunci API Gemini kustom Anda sendiri (dari akun standard subscription Anda) di bawah ini.
                </p>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-semibold text-slate-500 block">GEMINI_API_KEY:</label>
                    <button 
                      onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                      className="text-[10px] text-blue-600 hover:underline font-medium focus:outline-none"
                    >
                      {showApiKeyInput ? "Sembunyikan" : "Tampilkan"}
                    </button>
                  </div>
                  <input
                    type={showApiKeyInput ? "text" : "password"}
                    value={customGeminiApiKey}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomGeminiApiKey(val);
                      localStorage.setItem("custom_gemini_api_key", val);
                    }}
                    placeholder="Masukkan AI_KEY kustom Anda (AIzaSy...)"
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      localStorage.setItem("custom_gemini_api_key", customGeminiApiKey);
                      setIsKeySavedFeedback(true);
                      setTimeout(() => setIsKeySavedFeedback(false), 2500);
                    }}
                    className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-600 text-xs font-bold rounded-lg transition text-center whitespace-nowrap active:scale-95 cursor-pointer"
                  >
                    {isKeySavedFeedback ? "Tersimpan! ✓" : "Simpan Kunci"}
                  </button>
                  
                  {customGeminiApiKey && (
                    <button
                      onClick={() => {
                        setCustomGeminiApiKey("");
                        localStorage.removeItem("custom_gemini_api_key");
                      }}
                      className="px-2 py-1.5 bg-slate-100 border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-100 text-slate-600 text-xs font-bold rounded-lg transition active:scale-95 cursor-pointer"
                      title="Kembali menggunakan API Key Bawaan Server"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Testing presets (Extremely handy for immediate showcase!) */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col gap-3">
              <h3 className="font-semibold text-slate-800 text-xs flex items-center">
                <BookOpen className="h-4 w-4 text-emerald-600 mr-1.5" />
                Uji Coba Cepat dengan Preset Contoh
              </h3>
              <p className="text-[11px] text-slate-500">Belum memiliki berkas fisik surat jalan? Klik contoh di bawah untuk mensimulasikan OCR berakurasi tinggi dengan verifikasi biner:</p>
              
              <div className="flex flex-col gap-2">
                {DOCUMENT_PRESETS.map((doc, idx) => (
                  <button
                    key={idx}
                    onClick={() => loadPresetData(idx)}
                    className="w-full text-left py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-900 transition flex items-center justify-between text-slate-700 font-medium active:scale-95 group cursor-pointer"
                    id={`btn-preset-${idx}`}
                  >
                    <span className="truncate mr-2">{doc.title}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-600 transition shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            {/* Split Screen Image Inspector Area */}
            <div className="bg-slate-900 rounded-xl p-4 text-white shadow-xl flex flex-col">
              <h3 className="font-semibold text-xs text-slate-300 flex items-center mb-3">
                <ImageIcon className="h-4 w-4 text-emerald-400 mr-1.5" />
                Pemeriksa Visual Dokumen (Pembacaan Berkas)
              </h3>

              {selectedRow ? (
                <div className="flex flex-col gap-3" id="inspection-view-details">
                  <div className="bg-slate-950 rounded-lg border border-slate-800 aspect-[4/3] relative overflow-hidden flex items-center justify-center p-2 group">
                    {selectedRow.image_base64 ? (
                      <img 
                        src={selectedRow.image_base64} 
                        alt="Scanned original shipping document" 
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="text-center p-4">
                        <FileText className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                        <p className="text-[11px] text-slate-500">Row diinput manual tanpa data foto asli.</p>
                      </div>
                    )}
                    <div className="absolute top-2 right-2 bg-slate-900/80 px-2 py-0.5 rounded text-[9px] font-mono border border-slate-700/50 text-emerald-400">
                      S/N: {selectedRow.id.split("_")[2] || "Manual"}
                    </div>
                  </div>

                  {/* Inspector Metadata table for cross check */}
                  <div className="bg-slate-800/40 rounded-lg p-3 text-[11px] space-y-2 border border-slate-800 font-mono">
                    <div className="flex justify-between border-b border-slate-800 pb-1.5">
                      <span className="text-slate-400">KODE TRACER (OCR):</span>
                      <span className="text-emerald-400 font-bold tracking-wider">{selectedRow.manifest_code}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800 pb-1.5">
                      <span className="text-slate-400">NO. HOSP. INVOICE:</span>
                      <span className="text-emerald-300 font-bold tracking-wider">{selectedRow.hosp_invoice || "N/A"}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800 pb-1.5">
                      <span className="text-slate-400">PENGIRIM:</span>
                      <span className="text-slate-300 truncate max-w-[150px]">{selectedRow.sender}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800 pb-1.5">
                      <span className="text-slate-400">PENERIMA:</span>
                      <span className="text-slate-300 truncate max-w-[150px]">{selectedRow.recipient}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-semibold">TGL SCAN:</span>
                      <span className="text-slate-400">{selectedRow.scan_timestamp}</span>
                    </div>
                  </div>

                  {/* Intelligent verification tip */}
                  <div className="bg-blue-950/40 text-blue-300 border border-blue-900/40 p-2.5 rounded-lg text-[10px] space-y-1">
                    <div className="flex items-center font-bold text-blue-200">
                      <Info className="h-3.5 w-3.5 mr-1 text-blue-400 shrink-0" />
                      Tips Verifikasi Biner:
                    </div>
                    <p className="text-slate-300">
                      Bandingkan kode biru pada visual dengan data yang tertulis di grid. Jika terjadi kesalahan karakter 
                      (angka <strong>0</strong> larping sebagai alphabet <strong>O</strong>), Anda dapat membetulkannya langsung 
                      di sel grid sebelah kanan.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 px-4 bg-slate-950/40 border border-slate-800/40 rounded-lg">
                  <ImageIcon className="h-6 w-6 text-slate-700 mx-auto mb-2" />
                  <p className="text-[11px] text-slate-500">Pilih salah satu baris di lembar kerja sebelah kanan untuk menginspeksi salinan dokumen asli.</p>
                </div>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN: THE INTERACTIVE EXCEL GRID (span 8/12) */}
          <div className="xl:col-span-8 h-[650px] md:h-[750px]">
            <ExcelGrid 
              rows={rows}
              selectedRowId={selectedRowId}
              onSelectRow={setSelectedRowId}
              onUpdateRow={handleUpdateRow}
              onDeleteRow={handleDeleteRow}
              onClearSheet={handleClearSheet}
              onAddRow={handleAddBlankRow}
              onExportCSV={handleExportCSV}
            />
          </div>

        </div>

        {/* Dynamic Verification Alert Panel at Bottom edge */}
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-slate-900 text-xs md:text-sm">Panduan Pencocokan Karakter Khusus (O, 0, I, 1, S, 5)</h3>
              <p className="text-xs text-slate-600 mt-1">
                Karakter tertentu sering disalahpahami oleh sensor pemindai standar. Sistem kami telah menandai item-item ini dengan indikator berbeda dalam tabel Excel:
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pl-7 pt-1 text-[11px] font-mono">
            <div className="bg-amber-100/55 text-amber-900 border border-amber-200/50 p-2 rounded-lg">
              <span className="font-bold bg-amber-200 px-1.5 py-0.5 rounded text-amber-800 mr-2">0</span>
              Adalah angka <strong>NOL</strong>. Mengandung lubang tipis dan lebih lonjong. Polanya biasa ada di sebelah digit angka resi logistik.
            </div>
            <div className="bg-sky-100/55 text-sky-900 border border-sky-200/50 p-2 rounded-lg">
              <span className="font-bold bg-sky-200 px-1.5 py-0.5 rounded text-sky-800 mr-2">O</span>
              Adalah huruf vokal <strong>O</strong>. Lebih lebar dan bulat. Digunakan dalam singkatan nama wilayah cargo atau singkatan koli barang.
            </div>
            <div className="bg-emerald-100/55 text-emerald-950 border border-emerald-200/50 p-2 rounded-lg">
              <span className="font-bold bg-emerald-200 px-1.5 py-0.5 rounded text-emerald-800 mr-2">1</span> / <span className="font-bold bg-indigo-200 px-1.5 py-0.5 rounded text-indigo-800">I</span>
              Angka <strong>Satu</strong> versus huruf <strong>I</strong>. Perhatikan struktur surat jalan untuk memverifikasi.
            </div>
          </div>
        </div>

      </main>

      {/* Corporate log footer info */}
      <footer className="bg-slate-100 border-t border-slate-200 mt-auto py-4">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <span>&copy; 2026 Admin Logistik Scanner System. Dikembangkan untuk efisiensi kearsipan pergudangan PT. Sinar Sentosa.</span>
          <span className="font-mono text-[11px] text-slate-400">Device ID: {appletID ? appletID.slice(0, 13) : "1dbeebc2-a2bc"} &bull; Standby Region: Cloud Run Southeast Asia</span>
        </div>
      </footer>

      {/* Custom Confirmation Dialog Modal for Clear Sheet */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-100 max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-4 animate-bounce">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-950">Kosongkan Seluruh Data Sheet?</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Tindakan ini akan menghapus **seluruh data ({rows.length} baris)** pada lembar kerja saat ini secara permanen. Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="bg-slate-50 px-5 py-3.5 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 active:scale-95 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmClearSheet}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 active:scale-95 transition rounded-lg shadow-sm cursor-pointer"
              >
                Ya, Kosongkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline fallback handle for Applet identity context
const appletID = "1dbeebc2-a2bc-4721-a355-e520c59f69b3";
