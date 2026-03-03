'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ScanResponse = {
  status: 'check-in' | 'check-out';
  dateKey: string;
  message: string;
  scanAt: number;
  policy?: {
    cooldownSeconds: number;
  };
};

type LocationPayload = {
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
};

function getLocationPayload(): Promise<LocationPayload> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({});
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        });
      },
      () => resolve({}),
      {
        timeout: 7000,
        enableHighAccuracy: true,
      },
    );
  });
}

export function ScanPanel() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanRef = useRef<{ token: string; at: number } | null>(null);
  const loadingRef = useRef(false);
  const [token, setToken] = useState('');
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [scannerState, setScannerState] = useState<
    'idle' | 'ready' | 'unsupported' | 'blocked'
  >('idle');
  const [scannerEngine, setScannerEngine] = useState<
    'none' | 'native-barcode-detector' | 'zxing'
  >('none');
  const [runtimeInfo, setRuntimeInfo] = useState({
    secureContext: false,
    hasMediaDevices: false,
    hasGetUserMedia: false,
    hasBarcodeDetector: false,
  });
  const [cameraPermission, setCameraPermission] = useState<
    'unknown' | 'granted' | 'denied' | 'prompt' | 'unavailable'
  >('unknown');
  const [cameraError, setCameraError] = useState('none');

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    setRuntimeInfo({
      secureContext:
        window.isSecureContext || window.location.hostname === 'localhost',
      hasMediaDevices: !!navigator.mediaDevices,
      hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
      hasBarcodeDetector: 'BarcodeDetector' in window,
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    const checkPermission = async () => {
      if (
        typeof navigator === 'undefined' ||
        !navigator.permissions?.query
      ) {
        if (mounted) setCameraPermission('unavailable');
        return;
      }

      try {
        const status = await navigator.permissions.query({
          name: 'camera' as PermissionName,
        });
        if (mounted) {
          const state = status.state;
          if (state === 'granted' || state === 'denied' || state === 'prompt') {
            setCameraPermission(state);
          } else {
            setCameraPermission('unknown');
          }
        }
      } catch {
        if (mounted) setCameraPermission('unavailable');
      }
    };

    void checkPermission();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    let detectorTimer: ReturnType<typeof setInterval> | null = null;
    let stopControls: { stop: () => void } | null = null;

    const stopStream = () => {
      if (stopControls) {
        stopControls.stop();
        stopControls = null;
      }
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
        streamRef.current = null;
      }
    };

    const start = async () => {
      if (typeof window === 'undefined') {
        return;
      }

      const video = videoRef.current;
      if (!video) {
        setScannerState('unsupported');
        setCameraError('video-element-missing');
        return;
      }

      // Native path: fast on modern Chromium with BarcodeDetector support.
      if ('BarcodeDetector' in window) {
        try {
          const detector = new BarcodeDetector({ formats: ['qr_code'] });
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false,
          });
          if (!mounted) {
            stopStream();
            return;
          }

          streamRef.current = stream;
          video.srcObject = stream;
          await video.play();
          setScannerState('ready');
          setScannerEngine('native-barcode-detector');
          setCameraError('none');

          detectorTimer = setInterval(async () => {
            if (!mounted || loadingRef.current || !videoRef.current) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              const rawValue = barcodes[0]?.rawValue?.trim();
              if (!rawValue) return;

              const now = Date.now();
              const last = lastScanRef.current;
              if (last && last.token === rawValue && now - last.at < 1500) {
                return;
              }
              lastScanRef.current = { token: rawValue, at: now };
              setToken(rawValue);
            } catch {
              // ignore detection noise
            }
          }, 600);
          return;
        } catch {
          setScannerState('blocked');
          setCameraError('native:getUserMedia-or-detector-failed');
          // fallback to ZXing below
        }
      }

      // Fallback path for browsers without BarcodeDetector.
      try {
        const { BrowserCodeReader, BrowserQRCodeReader } = await import('@zxing/browser');
        const devices = await BrowserCodeReader.listVideoInputDevices();
        if (!devices.length) {
          setScannerState('blocked');
          return;
        }

        const selectedDevice = devices.find((item) =>
          item.label.toLowerCase().includes('back'),
        ) ?? devices[0];
        const codeReader = new BrowserQRCodeReader();

        const controls = await codeReader.decodeFromVideoDevice(
          selectedDevice.deviceId,
          video,
          (result) => {
            const rawValue = result?.getText()?.trim();
            if (!rawValue || loadingRef.current) return;

            const now = Date.now();
            const last = lastScanRef.current;
            if (last && last.token === rawValue && now - last.at < 1500) {
              return;
            }
            lastScanRef.current = { token: rawValue, at: now };
            setToken(rawValue);
          },
        );

        stopControls = controls;
        setScannerState('ready');
        setScannerEngine('zxing');
        setCameraError('none');
      } catch {
        setScannerState('blocked');
        setScannerEngine('none');
        setCameraError('zxing-init-failed-or-camera-blocked');
      }
    };

    void start();

    return () => {
      mounted = false;
      if (detectorTimer) {
        clearInterval(detectorTimer);
      }
      stopStream();
    };
  }, []);

  const submitScan = async (value: string) => {
    setLoading(true);
    setResult('');

    const location = await getLocationPayload();
    const idempotencyKey =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: value,
        ...location,
        idempotencyKey,
      }),
    });

    const data = (await res.json()) as Partial<ScanResponse> & {
      code?: string;
      message?: string;
    };

    if (!res.ok) {
      setResult(`[${data.code ?? 'SCAN_FAILED'}] ${data.message ?? 'Scan gagal'}`);
      setLoading(false);
      return;
    }

    setResult(
      `${data.message ?? 'Scan berhasil'} (${data.status ?? '-'}) - ${
        data.dateKey ?? '-'
      }`,
    );
    setLoading(false);
  };

  useEffect(() => {
    if (!token || loading) {
      return;
    }

    void submitScan(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || loading) return;
    await submitScan(token);
  };

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold">Scan QR Absensi</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Arahkan kamera HP ke QR kantor. Jika kamera tidak tersedia, gunakan input token manual.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border p-4">
          <p className="mb-2 text-sm font-medium">Kamera Scanner</p>
          <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-dashed bg-black">
            <video
              ref={videoRef}
              className={`h-full w-full object-cover transition-opacity ${
                scannerState === 'ready' ? 'opacity-100' : 'opacity-20'
              }`}
              muted
              playsInline
              autoPlay
            />
            {scannerState !== 'ready' ? (
              <div className="absolute inset-0 grid place-items-center text-center text-sm text-zinc-500">
                {scannerState === 'unsupported'
                  ? 'Scanner kamera tidak didukung browser ini.'
                  : scannerState === 'blocked'
                    ? 'Izin kamera ditolak atau kamera tidak tersedia.'
                    : 'Menyiapkan kamera...'}
              </div>
            ) : null}
          </div>
          <div className="mt-3 rounded-md border bg-zinc-50 p-3 text-xs text-zinc-600">
            <p className="font-semibold text-zinc-700">Diagnostik Scanner</p>
            <div className="mt-1 space-y-1">
              <p>Engine aktif: {scannerEngine}</p>
              <p>Secure context: {runtimeInfo.secureContext ? 'yes' : 'no'}</p>
              <p>mediaDevices: {runtimeInfo.hasMediaDevices ? 'yes' : 'no'}</p>
              <p>getUserMedia: {runtimeInfo.hasGetUserMedia ? 'yes' : 'no'}</p>
              <p>BarcodeDetector: {runtimeInfo.hasBarcodeDetector ? 'yes' : 'no'}</p>
              <p>Permission camera: {cameraPermission}</p>
              <p>Camera error: {cameraError}</p>
              <p>State: {scannerState}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border p-4">
          <p className="mb-2 text-sm font-medium">Fallback Manual</p>
          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Token QR"
              required
            />
            <Button type="submit" disabled={loading || !token}>
              {loading ? 'Memproses...' : 'Scan Sekarang'}
            </Button>
          </form>

          {result ? <p className="mt-4 text-sm">Hasil: {result}</p> : null}
        </div>
      </div>
    </div>
  );
}
