import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

// Load environment variables
dotenv.config();

// Lazy initialization of Gemini client to prevent crash on startup if API key is missing
let aiClient: GoogleGenAI | null = null;
function getAIClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing. Please set it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser with a larger limit to handle high-resolution image uploads
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ limit: "25mb", extended: true }));

  // API Route: Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // API Route: Scan Document
  app.post("/api/scan", async (req, res) => {
    try {
      const { image, mimeType, filename } = req.body;

      if (!image || !mimeType) {
        return res.status(400).json({
          success: false,
          error: "Missing image data or mimeType in request body."
        });
      }

      // Check if API key is present (use header override if available)
      const customApiKey = req.headers["x-gemini-api-key"];
      let ai: GoogleGenAI;
      if (customApiKey && typeof customApiKey === "string" && customApiKey.trim() !== "") {
        ai = new GoogleGenAI({
          apiKey: customApiKey.trim(),
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            }
          }
        });
      } else {
        ai = getAIClient();
      }

      // Configure system instruction for OCR matching the user prompt strictly
      const systemInstruction = 
        "Kamu adalah sistem OCR (Optical Character Recognition) berakurasi sangat tinggi khusus untuk mendeteksi dan mengekstrak \"Nomor Hosp. Invoice\" dari dokumen surat jalan, kuitansi, manifest rumah sakit, atau dokumen logistik lainnya.\n\n" +
        "ATURAN UTAMA:\n" +
        "1. Temukan label teks \"Nomor Hosp. Invoice :\" atau variannya seperti \"No. Hosp Invoice\" atau \"Hosp. Invoice :\" pada dokumen.\n" +
        "2. Ekstrak kode nomor lengkap yang tertulis tepat setelah label tersebut. Contoh: \"75260458-BI\".\n" +
        "3. ABAIKAN semua nomor-nomor lainnya (seperti nomor barcode biasa, ID kontainer, total biaya, atau nomor telepon) agar tidak tertukar.\n" +
        "4. LAKUKAN VERIFIKASI KARAKTER DENGAN SANGAT CERMAT! Jangan salah membedakan huruf 'O' dengan angka '0' (nol), " +
        "huruf 'I' dengan angka '1' (satu), huruf 'S' dengan angka '5', atau huruf 'Z' dengan angka '2'. Perhatikan pola " +
        "nomor Hosp. Invoice yang biasanya diakhiri kode seperti '-BI' atau pola alfabetik/numerik tertentu.\n" +
        "5. Cari juga metadata lain jika terlihat dengan jelas: tanggal dokumen, kode surat jalan (jika ada), nama pengirim, nama penerima/rumah sakit tujuan, " +
        "dan nama kurir/perusahaan logistik.\n" +
        "6. Berikan hasil pembacaan dalam format JSON terstruktur yang representatif sesuai schema.";

      const textPrompt = `Analisis file gambar ini (${filename || "dokumen_invoice.jpg"}). Lakukan deteksi label "Nomor Hosp. Invoice :" dan ekstrak nomor invoice di dekatnya (misal: 75260458-BI) secara akurat. Abaikan nomor-nomor lain yang tidak berkaitan dengan Hosp. Invoice. Lakukan cross-reference karakter O/0 dan I/1 untuk menjamin validitas.`;

      const imagePart = {
        inlineData: {
          mimeType: mimeType,
          data: image, // base64 string
        },
      };

      let response = null;
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: [imagePart, { text: textPrompt }],
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                success: {
                  type: Type.BOOLEAN,
                  description: "True jika Nomor Hosp. Invoice berhasil dideteksi."
                },
                hosp_invoice: {
                  type: Type.STRING,
                  description: "Isi/nilai hasil pembacaan Nomor Hosp. Invoice (contoh: 75260458-BI). Abaikan spasi di awal/akhir."
                },
                manifest_code: {
                  type: Type.STRING,
                  description: "Kode surat jalan, nomor resi, atau kode pelacak utama lainnya jika tertera di dokumen. Jika tidak ada, kosongkan."
                },
                date: {
                  type: Type.STRING,
                  description: "Tanggal yang tertera pada dokumen ( format bebas, misal: 22-05-2026 ). Kosongkan jika tidak ada."
                },
                sender: {
                  type: Type.STRING,
                  description: "Nama pengirim atau perusahaan pengirim yang tertera di dokumen. Kosongkan jika tidak ada."
                },
                recipient: {
                  type: Type.STRING,
                  description: "Nama penerima atau rumah sakit tujuan yang tertera di dokumen. Kosongkan jika tidak ada."
                },
                logistics_courier: {
                  type: Type.STRING,
                  description: "Nama perusahaan kurir / logistik / ekspedisi pelaksana jika tertera. Kosongkan jika tidak ada."
                },
                confidence_score: {
                  type: Type.INTEGER,
                  description: "Estimasi tingkat keyakinan (confidence level) pembacaan karakter dari 0 (sangat ragu) sampai 100 (sangat yakin)."
                },
                notes: {
                  type: Type.STRING,
                  description: "Catatan hasil verifikasi atau penemuan spesifik pada dokumen."
                }
              },
              required: ["success", "hosp_invoice", "manifest_code"]
            }
          },
        });
      } catch (err: any) {
        const is429 =
          err?.status === 429 ||
          err?.statusCode === 429 ||
          err?.code === 429 ||
          (err?.message && (
            err.message.includes("429") ||
            err.message.toLowerCase().includes("quota") ||
            err.message.toLowerCase().includes("resourceexhausted") ||
            err.message.toLowerCase().includes("rate limit")
          ));

        if (is429) {
          // Calculate requested delay
          let parsedSpecificDelay = 0;

          // 1. Try to parse JSON from err.message if it has a JSON error object
          if (err.message) {
            try {
              const jsonStr = err.message.replace(/^ApiError:\s*/i, "").trim();
              const parsedErr = JSON.parse(jsonStr);
              const details = parsedErr?.error?.details || parsedErr?.details;
              if (Array.isArray(details)) {
                for (const detail of details) {
                  if (detail?.retryDelay) {
                    const rDelay = parseFloat(detail.retryDelay);
                    if (!isNaN(rDelay)) {
                      parsedSpecificDelay = rDelay * 1000;
                      break;
                    }
                  }
                }
              }
            } catch (_) {
              // Ignore JSON parsing errors
            }
          }

          // 2. Try to look at err?.error?.details directly
          if (parsedSpecificDelay === 0 && err?.error?.details) {
            const details = err.error.details;
            if (Array.isArray(details)) {
              for (const detail of details) {
                if (detail?.retryDelay) {
                  const rDelay = parseFloat(detail.retryDelay);
                  if (!isNaN(rDelay)) {
                    parsedSpecificDelay = rDelay * 1000;
                    break;
                  }
                }
              }
            }
          }

          // 3. Fallback to robust regex parsing of error text
          if (parsedSpecificDelay === 0 && err.message) {
            // Match phrases like "retry in 50.61s" precisely
            const secMatch = err.message.match(/(?:retry\s+in|retry\s+after|wait)\s*(\d+(?:\.\d+)?)\s*(s|sec|second)/i);
            if (secMatch) {
              parsedSpecificDelay = parseFloat(secMatch[1]) * 1000;
            } else {
              // General fallback regex matching a float/int followed by s / sec / second
              const genMatch = err.message.match(/(\d+(?:\.\d+)?)\s*(s|sec|second|sekon)/i);
              if (genMatch) {
                parsedSpecificDelay = parseFloat(genMatch[1]) * 1000;
              }
            }
          }

          // Safety limit: never wait more than 90 seconds (90000ms) to prevent freezing for too long
          if (parsedSpecificDelay > 90000) {
            parsedSpecificDelay = 90000;
          }

          const baseDelay = 15000; // 15 seconds default
          const finalDelay = parsedSpecificDelay > 0 ? parsedSpecificDelay + 1500 : baseDelay;

          console.warn(`[OCR Quota 429] Batas kuota terdeteksi, memberi tahu client untuk menunggu ${Math.round(finalDelay)}ms.`);
          return res.status(429).json({
            success: false,
            rateLimit: true,
            retryAfterMs: finalDelay,
            error: `Batas kuota Gemini API terdeteksi (429 RESOURCE_EXHAUSTED). Sistem mengantri secara otomatis. Silakan tunggu ${Math.ceil(finalDelay / 1000)} detik.`
          });
        } else {
          // Propagate other errors
          throw err;
        }
      }

      if (!response) {
        throw new Error("Gagal mendapatkan respons dari Gemini API.");
      }

      const responseText = response.text || "{}";
      const resultData = JSON.parse(responseText.trim());

      res.json({
        success: true,
        data: resultData
      });

    } catch (error: any) {
      console.error("Error/Scan fail:", error);
      const is403 =
        error?.status === 403 ||
        error?.statusCode === 403 ||
        error?.code === 403 ||
        (error?.message && (
          error.message.includes("403") ||
          error.message.toLowerCase().includes("permission") ||
          error.message.toLowerCase().includes("denied") ||
          error.message.toUpperCase().includes("PERMISSION_DENIED")
        ));
      
      if (is403) {
        return res.status(403).json({
          success: false,
          error: "Akses Project ditolak (403 PERMISSION_DENIED). Kunci API Gemini server bawaan diblokir atau tidak dapat diakses. Silakan masukkan kunci API kustom Anda sendiri (Custom Gemini API Key) di panel samping aplikasi untuk menggunakan akun/kuota Anda sendiri."
        });
      }

      res.status(500).json({
        success: false,
        error: error.message || "Gagal memproses gambar menggunakan OCR."
      });
    }
  });

  // Vite development integration or static serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[FULLSTACK] Server up and running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
