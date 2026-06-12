import React, { useRef, useState, useEffect } from "react";
import { Camera, RefreshCw, AlertCircle, Video, Play, StopCircle, Check } from "lucide-react";

interface CameraCaptureProps {
  onCapture: (base64Image: string, mimeType: string, filename: string) => void;
  isScanning: boolean;
}

export default function CameraCapture({ onCapture, isScanning }: CameraCaptureProps) {
  const [isActive, setIsActive] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Initialize camera streams and list available webcams
  useEffect(() => {
    if (isActive) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isActive, selectedDeviceId]);

  const startCamera = async () => {
    setError(null);
    try {
      // If we don't have video devices listed yet, discover them
      if (devices.length === 0) {
        try {
          const initialStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: { ideal: "user" } } 
          });
          initialStream.getTracks().forEach(track => track.stop()); // release setup stream
          
          const allDevices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = allDevices.filter(device => device.kind === "videoinput");
          setDevices(videoDevices);
          
          if (videoDevices.length > 0 && !selectedDeviceId) {
            // Find a device that is likely a front/integrated webcam or first available on desktop
            const frontCam = videoDevices.find(device => 
              device.label.toLowerCase().includes("front") || 
              device.label.toLowerCase().includes("webcam") || 
              device.label.toLowerCase().includes("integrated") ||
              device.label.toLowerCase().includes("camera")
            );
            
            setSelectedDeviceId(frontCam ? frontCam.deviceId : videoDevices[0].deviceId);
          }
        } catch (e) {
          console.warn("Enumeration failed, continuing directly with default video input:", e);
        }
      }

      // Build safe video constraints with faceMode user for webcams / desktop
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: selectedDeviceId ? { ideal: selectedDeviceId } : undefined,
          facingMode: { ideal: "user" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (innerErr) {
        console.warn("Failed with configured constraints, falling back to basic user stream...", innerErr);
        // Fallback with facingMode preferred
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: { ideal: "user" } } 
          });
        } catch (e) {
          // Absolute fallback
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(err => console.log("Video play interrupted", err));
      }
    } catch (err: any) {
      console.error("Camera setup failed:", err);
      setError("Gagal mengakses kamera. Silakan periksa izin kamera atau coba tutup tab/aplikasi lain yang sedang menggunakan kamera.");
      setIsActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const toggleCamera = () => {
    setIsActive(!isActive);
  };

  // Capture current video frame and output base64
  const captureSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    try {
      const canvas = document.createElement("canvas");
      // Read original feed resolutions
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setError("Gagal menyiapkan canvas pengambilan gambar.");
        return;
      }

      // Draw active webcam image on standard canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Get base64 string
      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      const cleanBase64 = dataUrl.replace(/^data:image\/jpeg;base64,/, "");
      
      const sessionFilename = `kamera_scan_${new Date().getTime()}.jpg`;
      onCapture(cleanBase64, "image/jpeg", sessionFilename);
    } catch (err: any) {
      console.error(err);
      setError("Gagal mengambil snapshot dari kamera.");
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col h-full">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center space-x-2">
          <Camera className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-slate-800 text-sm">Ambil Gambar via Kamera</h3>
        </div>
        {isActive && devices.length > 1 && (
          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="text-[11px] bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 max-w-[150px] truncate cursor-pointer"
            id="camera-device-select"
          >
            {devices.map((device, i) => (
              <option key={device.deviceId || i} value={device.deviceId}>
                {device.label || `Kamera ${i + 1}`}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div className="mb-3 p-2.5 bg-red-50 border border-red-100 rounded-lg flex items-start space-x-1.5 text-xs text-red-700 shrink-0">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Camera Live View Box / Toggle Shell */}
      <div className="flex-1 bg-slate-900 rounded-lg min-h-[220px] md:min-h-[260px] relative overflow-hidden flex items-center justify-center">
        {isActive ? (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover transform"
            />
            {/* Holographic scanning overlay laser laser beam */}
            <div className="absolute left-0 right-0 w-full h-[2px] bg-green-400 opacity-90 shadow-[0_0_8px_#4ade80] animate-laser" />
            
            {/* Subtle camera crosshair box guides */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[80%] h-[40%] border border-dashed border-white/60 rounded flex items-center justify-center">
                <span className="text-[10px] text-white/40 tracking-widest font-mono bg-slate-950/50 px-2 py-0.5 rounded uppercase">
                  Posisikan Barcode & Kode Surat Jalan
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center p-6 flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mb-3 shadow-inner">
              <Video className="h-6 w-6" />
            </div>
            <p className="text-xs text-slate-400 font-medium max-w-[200px]">
              Kamera belum aktif. Klik tombol di bawah untuk mengaktifkan kamera pemindaian logistik Anda.
            </p>
          </div>
        )}
      </div>

      {/* Capture Actions Button Box */}
      <div className="mt-4 flex gap-3 shrink-0">
        <button
          onClick={toggleCamera}
          className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 text-xs font-semibold rounded-lg border transition active:scale-95 cursor-pointer ${
            isActive 
              ? "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200" 
              : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
          }`}
          id="btn-toggle-camera"
        >
          {isActive ? (
            <>
              <StopCircle className="h-4 w-4 text-red-600" />
              <span>Matikan Kamera</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              <span>Aktifkan Kamera</span>
            </>
          )}
        </button>

        {isActive && (
          <button
            onClick={captureSnapshot}
            disabled={isScanning}
            className="flex-1 flex items-center justify-center space-x-2 py-2 px-3 text-xs font-semibold rounded-lg bg-green-600 hover:bg-green-700 text-white transform active:scale-95 transition disabled:opacity-55 disabled:cursor-not-allowed shadow-md cursor-pointer"
            id="btn-capture-camera"
          >
            {isScanning ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Memindai...</span>
              </>
            ) : (
              <>
                <Camera className="h-4 w-4" />
                <span>Ambil & Pindai Resi</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
