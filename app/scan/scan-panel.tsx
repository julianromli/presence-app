'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  Bell,
  MapPin,
  CheckCircle2,
  XCircle,
  CameraOff,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { workspaceFetch } from '@/lib/workspace-client';
import { cn } from '@/lib/utils';
import { ScanBottomNav } from '@/components/ui/scan-bottom-nav';
import { ScanNotificationsDrawer } from '@/components/ui/scan-notifications-drawer';
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog';

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
  const [lastRejectCode, setLastRejectCode] = useState<string>('none');
  const [debugOpen, setDebugOpen] = useState(false);

  const [currentTime, setCurrentTime] = useState(new Date());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [modalContent, setModalContent] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
    metadata?: string;
  } | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
      if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
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
        }
      }

      try {
        const { BrowserCodeReader, BrowserQRCodeReader } = await import(
          '@zxing/browser'
        );
        const devices = await BrowserCodeReader.listVideoInputDevices();
        if (!devices.length) {
          setScannerState('blocked');
          return;
        }

        const selectedDevice =
          devices.find((item) => item.label.toLowerCase().includes('back')) ??
          devices[0];
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
    return await workspaceFetch('/api/scan', {
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
    setLastRejectCode('none');
    lastSubmittedRef.current = { token: value, at: Date.now() };

    let res = await sendScan(value, {}, buildIdempotencyKey());
    let data = (await res.json()) as Partial<ScanResponse> & {
      code?: string;
      message?: string;
    };

    if (!res.ok && data.code === 'GEOFENCE_COORD_REQUIRED') {
      const location = await getLocationPayload(2000);
      if (location.latitude !== undefined && location.longitude !== undefined) {
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
      const errorMessage = data.message ?? 'Scan gagal';

      setModalContent({
        type: 'error',
        title: 'Scan Gagal',
        message: errorMessage,
        metadata: errorCode,
      });
      setIsModalOpen(true);

      if (source === 'auto') {
        autoPauseUntilRef.current =
          Date.now() + (errorCode === 'TOKEN_EXPIRED' ? 6000 : 3000);
      }
      setLoading(false);
      return;
    }

    if (source === 'auto') {
      const pauseSeconds = Math.max(5, data.policy?.cooldownSeconds ?? 30);
      autoPauseUntilRef.current = Date.now() + pauseSeconds * 1000;
    }

    setModalContent({
      type: 'success',
      title: 'Berhasil',
      message: data.message ?? 'Scan berhasil',
      metadata: `${data.status?.toUpperCase() ?? '-'} · ${data.dateKey ?? '-'}`,
    });
    setIsModalOpen(true);
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

  const scannerInfoText =
    scannerState === 'unsupported'
      ? 'Scanner tidak didukung'
      : scannerState === 'blocked'
        ? 'Akses kamera ditolak'
        : 'Menyiapkan kamera...';

  return (
    <div className="min-h-screen flex flex-col items-center bg-secondary/30 pb-20 justify-between">
      {/* Header */}
      <div className="w-full px-6 pt-6 pb-4 flex justify-between items-center bg-background border-b z-10 sticky top-0 md:max-w-md">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-0.5">
            Selamat Pagi,
          </p>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Halo, Karyawan
          </h1>
        </div>
        <button
          onClick={() => setNotifOpen(true)}
          className="relative w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors group"
        >
          <Bell className="w-5 h-5 text-foreground transition-transform group-active:scale-90" />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-primary ring-2 ring-background ring-offset-0" />
        </button>
      </div>

      <ScanNotificationsDrawer open={notifOpen} onOpenChange={setNotifOpen} />

      {/* Main Content */}
      <div className="flex-1 w-full max-w-md flex flex-col px-6 relative py-8 mx-auto items-center">
        {/* Glow Effects */}
        <div className="absolute top-20 left-10 w-64 h-64 bg-primary/10 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
        <div className="absolute top-20 right-10 w-64 h-64 bg-blue-500/10 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse delay-1000"></div>

        <div className="relative w-full bg-card rounded-[32px] shadow-card p-6 flex flex-col items-center justify-center z-10 border border-border">
          <div className="mb-6 flex items-center gap-2 px-3 py-1 bg-success/10 rounded-full border border-success/20">
            <span className="w-2 h-2 bg-success rounded-full animate-pulse"></span>
            <span className="text-xs font-semibold text-success uppercase tracking-wide">
              Online
            </span>
          </div>

          <div className="relative w-64 h-64 mb-6 group">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-foreground rounded-tl-xl z-20"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-foreground rounded-tr-xl z-20"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-foreground rounded-bl-xl z-20"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-foreground rounded-br-xl z-20"></div>
            <div className="w-full h-full p-2 relative overflow-hidden rounded-[14px]">
              <video
                ref={videoRef}
                className={cn(
                  'h-full w-full object-cover rounded-[10px] transition-opacity',
                  scannerState === 'ready' ? 'opacity-100' : 'opacity-20 bg-muted',
                )}
                muted
                playsInline
                autoPlay
              />
              {scannerState !== 'ready' ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center text-sm text-muted-foreground z-10">
                  {scannerState === 'idle' || loading ? (
                    <Loader2 className="w-8 h-8 animate-spin mb-2" />
                  ) : (
                    <CameraOff className="w-8 h-8 mb-2 opacity-50" />
                  )}
                  <span className="font-medium text-xs">
                    {scannerInfoText}
                  </span>
                </div>
              ) : null}
              {scannerState === 'ready' && (
                <div className="absolute inset-x-2 top-2 bottom-2 overflow-hidden pointer-events-none rounded-[10px]">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/30 to-transparent w-full h-[20%] animate-[scan_2s_ease-in-out_infinite]"></div>
                </div>
              )}
            </div>
          </div>

          <div className="text-center space-y-1">
            <p className="text-sm font-bold text-foreground uppercase tracking-wide">
              Scan untuk Masuk
            </p>
            <p className="text-3xl font-bold text-foreground tracking-tight font-mono">
              {currentTime.toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
              })}
              <span className="text-sm font-medium text-muted-foreground ml-1">
                WIB
              </span>
            </p>
          </div>

          {autoPauseSecondsLeft > 0 ? (
            <div className="w-full mt-6 transition-all duration-300">
              <div className="flex justify-between text-xs text-muted-foreground font-medium mb-2">
                <span>Refresh otomatis</span>
                <span>00:{autoPauseSecondsLeft.toString().padStart(2, '0')}</span>
              </div>
              <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${(autoPauseSecondsLeft / 30) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="w-full mt-6 h-1.5" />
          )}
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground bg-card px-4 py-2 rounded-full shadow-sm border border-border z-10">
          <MapPin className="w-4 h-4" />
          <span className="text-xs font-medium">Auto Deteksi Lokasi Tersedia</span>
        </div>

        <div className="mt-4 w-full z-10 mb-8">
          <Collapsible
            open={debugOpen}
            onOpenChange={setDebugOpen}
            className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
          >
            <CollapsibleTrigger className="w-full px-4 py-3 text-left text-sm font-medium text-foreground flex justify-between items-center hover:bg-muted/50 transition-colors">
              <span>Manual Input & Diagnostik</span>
              <span className="text-xs font-normal text-muted-foreground">
                {debugOpen ? 'Tutup' : 'Buka'}
              </span>
            </CollapsibleTrigger>
            <CollapsiblePanel className="border-t border-border px-4 py-4 space-y-4 bg-muted/20">
              <form onSubmit={onSubmit} className="flex gap-2">
                <Input
                  id="qr-token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Token QR"
                  required
                  className="flex-1 text-sm h-9 bg-background"
                />
                <Button
                  type="submit"
                  disabled={loading || !token}
                  size="sm"
                  className="h-9 px-6"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Scan'
                  )}
                </Button>
              </form>
              <div className="space-y-1 text-xs text-muted-foreground pt-2 border-t">
                <p>Engine: {scannerEngine}</p>
                <p>Secure context: {runtimeInfo.secureContext ? 'yes' : 'no'}</p>
                <p>Permission camera: {cameraPermission}</p>
                <p>Camera error: {cameraError}</p>
                <p>State: {scannerState}</p>
                <p>Last reject code: {lastRejectCode}</p>
              </div>
            </CollapsiblePanel>
          </Collapsible>
        </div>
      </div>

      {/* Bottom Navigation */}
      <ScanBottomNav />

      {/* Dialog Result */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogPopup showCloseButton={false} className="w-[90vw] md:w-full md:max-w-md bg-card border-border rounded-3xl p-6 text-center focus:outline-none focus-visible:outline-none flex flex-col items-center justify-center shadow-2xl">
          <DialogPanel className="items-center">
            <div className="mb-2 flex h-20 w-20 items-center justify-center rounded-full border border-border bg-muted/50 shadow-sm">
              {modalContent?.type === 'success' ? (
                <CheckCircle2 className="h-10 w-10 text-success" />
              ) : (
                <XCircle className="h-10 w-10 text-destructive" />
              )}
            </div>
            <DialogHeader className="flex w-full flex-col items-center">
              <DialogTitle className="text-2xl font-bold tracking-tight text-center">
                {modalContent?.title}
              </DialogTitle>
              <DialogDescription className="mt-3 w-[260px] text-center text-sm">
                {modalContent?.message}
              </DialogDescription>
            </DialogHeader>

            {modalContent?.metadata && (
              <div className="mt-6 w-full rounded-xl border border-border bg-secondary/50 px-4 py-3 text-center text-sm font-medium text-foreground shadow-inner">
                {modalContent.metadata}
              </div>
            )}

            <Button
              onClick={() => setIsModalOpen(false)}
              className="mt-8 w-full rounded-2xl py-6 text-base font-semibold shadow-md active:scale-[0.98] transition-all"
              variant={modalContent?.type === 'success' ? 'default' : 'destructive'}
            >
              {modalContent?.type === 'success' ? 'Lanjut' : 'Tutup'}
            </Button>
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </div >
  );
}
