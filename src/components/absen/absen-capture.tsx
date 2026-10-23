"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkIn, checkOut } from "@/server/actions/attendance";

type Geo = { lat: number; lng: number; accuracy: number };

export function AbsenCapture({ mode }: { mode: "in" | "out" }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [camReady, setCamReady] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    async function startCam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCamReady(true);
      } catch {
        setError("Kamera tidak bisa diakses. Izinkan kamera lalu muat ulang.");
      }
    }
    if (!photo) startCam();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [photo]);

  function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const maxDim = 1280;
    const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setPhoto({ blob, url: URL.createObjectURL(blob) });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        getLocation();
      },
      "image/jpeg",
      0.7,
    );
  }

  function getLocation() {
    setError(null);
    if (!navigator.geolocation) {
      setError("Perangkat tidak mendukung lokasi.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setGeo({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () =>
        setError("Izin lokasi ditolak. Aktifkan lokasi di browser lalu ambil ulang."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function retake() {
    if (photo) URL.revokeObjectURL(photo.url);
    setPhoto(null);
    setGeo(null);
    setError(null);
  }

  function submit() {
    if (!photo || !geo) return;
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("photo", photo.blob, "absen.jpg");
      fd.set("lat", String(geo.lat));
      fd.set("lng", String(geo.lng));
      fd.set("accuracy", String(geo.accuracy));
      const r = mode === "in" ? await checkIn(fd) : await checkOut(fd);
      if (r.ok) router.refresh();
      else setError(r.message ?? "Gagal.");
    });
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg bg-black">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt="Foto absen" className="aspect-[3/4] w-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className="aspect-[3/4] w-full scale-x-[-1] object-cover"
          />
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      {geo && (
        <p className="flex items-center gap-1 text-14 text-muted-foreground">
          <MapPin className="h-4 w-4" /> Lokasi terekam (±{Math.round(geo.accuracy)}m)
        </p>
      )}
      {error && <p className="text-14 text-destructive">{error}</p>}

      {!photo ? (
        <Button className="w-full" onClick={capture} disabled={!camReady}>
          <Camera className="h-4 w-4" /> Ambil Foto
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={retake} disabled={pending}>
            <RefreshCw className="h-4 w-4" /> Ulangi
          </Button>
          <Button
            className="flex-1"
            onClick={submit}
            disabled={pending || !geo}
          >
            {pending ? "Mengirim…" : mode === "in" ? "Kirim Absen Masuk" : "Kirim Absen Pulang"}
          </Button>
        </div>
      )}
      <p className="text-12 text-muted-foreground">
        Foto diambil langsung dari kamera & lokasi wajib aktif.
      </p>
    </div>
  );
}
