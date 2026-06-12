import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";
import { ExcelRow } from "../types";

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Configure Google OAuth Provider
const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/drive");
provider.addScope("https://www.googleapis.com/auth/spreadsheets");

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Listen to Auth State Changes and Cache/Clear Access Token
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      // Re-trigger token fetch if we don't have it cached yet
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        // Since Firebase token listener doesn't return the OAuth access token on reload,
        // we prompt standard sign in, or indicate we need re-auth on next API call.
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in via Google popup to obtain Google Access Token
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Gagal memperoleh access token dari Google authentication.");
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Popup Sign-In failed:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Log Out
export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

// Check if Access Token is Active
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

// List user's spreadsheets in Google Drive
export const listSpreadsheets = async (token: string): Promise<Array<{ id: string; name: string; webViewLink?: string }>> => {
  const query = encodeURIComponent("mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)&orderBy=modifiedTime desc&pageSize=20`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || "Gagal memuat daftar Google Sheets dari Google Drive.");
  }

  const data = await response.json();
  return data.files || [];
};

// Create a new Google Sheet
export const createGoogleSheet = async (token: string, title: string): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> => {
  const response = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      properties: {
        title: title
      }
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || "Gagal membuat spreadsheet baru di Google Sheets.");
  }

  const data = await response.json();
  return {
    spreadsheetId: data.spreadsheetId,
    spreadsheetUrl: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`
  };
};

// Write current grid rows to a specific Google Sheet spreadsheet ID
export const exportToGoogleSheet = async (
  token: string, 
  spreadsheetId: string, 
  rows: ExcelRow[]
): Promise<void> => {
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
    "Status Verifikasi",
    "Catatan Diagnostik"
  ];

  const valueRows = rows.map((row, index) => [
    index + 1,
    row.scan_timestamp,
    row.filename,
    // Add apostrophe tag to force character values in Excel/Sheets format string text to prevent exponential floating conversions
    row.hosp_invoice ? `'${row.hosp_invoice}` : "",
    row.manifest_code ? `'${row.manifest_code}` : "",
    row.date || "-",
    row.sender || "-",
    row.recipient || "-",
    row.logistics_courier || "-",
    row.confidence_score,
    row.is_verified ? "TERVERIFIKASI" : "BELUM DIVERIFIKASI",
    row.notes || "Deteksi sukses."
  ]);

  const valuesPayload = [headers, ...valueRows];
  const range = "Sheet1!A1:L";

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        range,
        majorDimension: "ROWS",
        values: valuesPayload
      })
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || "Gagal menulis baris data ke Google Sheet.");
  }
};

// Import rows from a specific Google Sheet by Spreadsheet ID
export const importFromGoogleSheet = async (token: string, spreadsheetId: string): Promise<Partial<ExcelRow>[]> => {
  const range = "Sheet1!A2:L"; // Skip headers
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || "Gagal membaca baris data dari Google Sheet.");
  }

  const data = await response.json();
  const values = data.values || [];

  return values.map((val: any[]) => {
    // Clean potential Excel text formats (e.g., removing leading single quotes)
    const cleanCell = (cell: any) => {
      if (typeof cell === "string") {
        if (cell.startsWith("'")) return cell.substring(1);
        return cell;
      }
      return String(cell || "");
    };

    return {
      scan_timestamp: cleanCell(val[1]),
      filename: cleanCell(val[2]),
      hosp_invoice: cleanCell(val[3]),
      manifest_code: cleanCell(val[4]),
      date: cleanCell(val[5]),
      sender: cleanCell(val[6]),
      recipient: cleanCell(val[7]),
      logistics_courier: cleanCell(val[8]),
      confidence_score: Number(val[9]) || 100,
      is_verified: cleanCell(val[10]) === "TERVERIFIKASI",
      notes: cleanCell(val[11])
    };
  });
};

// Backup current database history/JSON to Google Drive
export const backupToGoogleDrive = async (token: string, rows: ExcelRow[], fileName: string): Promise<string> => {
  const metadata = {
    name: fileName,
    mimeType: "application/json"
  };

  const fileContent = JSON.stringify(rows, null, 2);
  const boundary = "-------314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const body = 
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    fileContent +
    closeDelimiter;

  const url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`
    },
    body: body
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || "Gagal mengunggah cadangan JSON ke Google Drive.");
  }

  const data = await response.json();
  return data.id;
};

// List backup JSON files from Google Drive
export const listBackupsOnDrive = async (token: string): Promise<Array<{ id: string; name: string; createdTime: string }>> => {
  const query = encodeURIComponent("name contains 'ocr_hosp_invoice_backup' and trashed = false");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,createdTime)&orderBy=createdTime desc&pageSize=15`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || "Gagal memuat berkas cadangan dari Google Drive.");
  }

  const data = await response.json();
  return data.files || [];
};

// Retrieve a backup file's content
export const downloadBackupContext = async (token: string, fileId: string): Promise<any> => {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error("Gagal mengambil isi cadangan dari Google Drive.");
  }

  return response.json();
};
