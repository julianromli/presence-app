'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

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

function getLocationPayload(timeoutMs = 1500): Promise<LocationPayload> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({});
      return;
    }

    const timeout = setTimeout(() => {
      resolve({});
    }, timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeout);
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        });
      },
      () => {
        clearTimeout(timeout);
        resolve({});
      },
      {
        timeout: timeoutMs,
        enableHighAccuracy: true,
      },
    );
  });
}

export function ScanPanel() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanRef = useRef<{ token: string; at: number } | null>(null);
  const lastSubmittedRef = useRef<{ token: string; at: number } | null>(null);
  const autoPauseUntilRef = useRef(0);
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
  const [autoPauseSecondsLeft, setAutoPauseSecondsLeft] = useState(0);
  const [lastSubmitLatencyMs, setLastSubmitLatencyMs] = useState<number | null>(null);
  const [lastRejectCode, setLastRejectCode] = useState<string>('none');
  const [debugOpen, setDebugOpen] = useState(false);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    const timer = setInterval(() => {
      const seconds = Math.max(
        0,
        Math.ceil((autoPauseUntilRef.current - Date.now()) / 1000),
      );
      setAutoPauseSecondsLeft(seconds);
    }, 250);

    return () => clearInterval(timer);
  }, []);

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
            if (Date.now() < autoPauseUntilRef.current) return;
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
            if (Date.now() < autoPauseUntilRef.current) return;

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

  const sendScan = async (
    value: string,
    location: LocationPayload,
    idempotencyKey: string,
  ) => {
    return await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: value,
        ...location,
        idempotencyKey,
      }),
    });
  };

  const buildIdempotencyKey = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

  const submitScan = async (value: string, source: 'auto' | 'manual') => {
    setLoading(true);
    setResult('');
    setLastSubmitLatencyMs(null);
    setLastRejectCode('none');
    lastSubmittedRef.current = { token: value, at: Date.now() };

    const start = Date.now();
    let res = await sendScan(value, {}, buildIdempotencyKey());
    let data = (await res.json()) as Partial<ScanResponse> & {
      code?: string;
      message?: string;
    };

    if (
      !res.ok &&
      data.code === 'GEOFENCE_COORD_REQUIRED'
    ) {
      const location = await getLocationPayload(2000);
      if (
        location.latitude !== undefined &&
        location.longitude !== undefined
      ) {
        res = await sendScan(value, location, buildIdempotencyKey());
        data = (await res.json()) as Partial<ScanResponse> & {
          code?: string;
          message?: string;
        };
      }
    }

    if (!res.ok) {
      const errorCode = data.code ?? 'SCAN_FAILED';
      setLastRejectCode(errorCode);
      setResult(`[${data.code ?? 'SCAN_FAILED'}] ${data.message ?? 'Scan gagal'}`);
      if (source === 'auto') {
        autoPauseUntilRef.current =
          Date.now() +
          (errorCode === 'TOKEN_EXPIRED' ? 6000 : 3000);
      }
      setLoading(false);
      return;
    }

    setLastSubmitLatencyMs(Date.now() - start);
    if (source === 'auto') {
      const pauseSeconds = Math.max(5, data.policy?.cooldownSeconds ?? 30);
      autoPauseUntilRef.current = Date.now() + pauseSeconds * 1000;
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
    const lastSubmitted = lastSubmittedRef.current;
    if (
      lastSubmitted &&
      lastSubmitted.token === token &&
      Date.now() - lastSubmitted.at < 60_000
    ) {
      return;
    }

    void submitScan(token, 'auto');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || loading) return;
    await submitScan(token, 'manual');
  };

  const hasScannerIssue = scannerState !== 'ready' || cameraPermission === 'denied';
  const statusTone = hasScannerIssue
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700';
  const statusLabel = hasScannerIssue ? 'Perlu perhatian' : 'Siap scan';
  const scannerInfoText =
    scannerState === 'unsupported'
      ? 'Scanner kamera tidak didukung browser ini.'
      : scannerState === 'blocked'
        ? 'Izin kamera ditolak atau kamera tidak tersedia.'
        : 'Menyiapkan kamera...';
  const resultTone = result.startsWith('[')
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  return (
    <div className="container py-8 md:py-10">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Scan QR Absensi</h1>
          <p className="text-sm text-zinc-600">
            Arahkan kamera HP ke QR kantor. Jika kamera tidak tersedia, gunakan input token manual.
          </p>
          <div className={cn('inline-flex rounded-full border px-3 py-1 text-xs font-medium', statusTone)}>
            Status: {statusLabel}
          </div>
        </div>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-medium text-zinc-900">Kamera Scanner</p>
          <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-zinc-200 bg-black">
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
              <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-zinc-300">
                {scannerInfoText}
              </div>
            ) : null}
          </div>

          {autoPauseSecondsLeft > 0 ? (
            <p className="mt-3 text-xs text-zinc-500">
              Scanner jeda otomatis {autoPauseSecondsLeft}s untuk mencegah scan ganda.
            </p>
          ) : null}

          <Collapsible
            open={debugOpen}
            onOpenChange={setDebugOpen}
            className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/70"
          >
            <CollapsibleTrigger className="w-full px-3 py-2 text-left text-xs font-medium text-zinc-700">
              {debugOpen ? 'Sembunyikan diagnostik' : 'Lihat diagnostik scanner'}
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t border-zinc-200 px-3 py-3">
              <div className="space-y-1 text-xs text-zinc-600">
                <p>Engine aktif: {scannerEngine}</p>
                <p>Secure context: {runtimeInfo.secureContext ? 'yes' : 'no'}</p>
                <p>mediaDevices: {runtimeInfo.hasMediaDevices ? 'yes' : 'no'}</p>
                <p>getUserMedia: {runtimeInfo.hasGetUserMedia ? 'yes' : 'no'}</p>
                <p>BarcodeDetector: {runtimeInfo.hasBarcodeDetector ? 'yes' : 'no'}</p>
                <p>Permission camera: {cameraPermission}</p>
                <p>Camera error: {cameraError}</p>
                <p>State: {scannerState}</p>
                <p>Last submit latency: {lastSubmitLatencyMs ?? '-'} ms</p>
                <p>Last reject code: {lastRejectCode}</p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-medium text-zinc-900">Fallback Manual</p>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="qr-token" className="text-xs font-medium text-zinc-600">
                Token QR
              </label>
              <Input
                id="qr-token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Tempel token QR di sini"
                required
              />
            </div>
            <Button type="submit" disabled={loading || !token} className="w-full sm:w-auto">
              {loading ? 'Memproses...' : 'Scan Sekarang'}
            </Button>
          </form>

          {result ? (
            <div className={cn('mt-4 rounded-lg border px-3 py-2 text-sm', resultTone)}>
              Hasil: {result}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
