const siteUrlFromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();

export const SITE_URL = (
  siteUrlFromEnv && siteUrlFromEnv.length > 0
    ? siteUrlFromEnv
    : "https://www.absenin.id"
).replace(/\/$/, "");
export const SITE_NAME = "Absenin.id";
export const SITE_TITLE = "Absenin.id - Absensi Digital";
export const SITE_DESCRIPTION =
  "Sistem absensi digital berbasis QR dinamis untuk check-in dan check-out real-time, kontrol akses berbasis role, dan laporan operasional mingguan.";
export const SITE_OG_DESCRIPTION =
  "Kelola absensi QR dinamis, kontrol akses per role, dan laporan operasional mingguan dari satu sistem.";

export const PUBLIC_SITE_PATHS = ["/", "/privacy", "/terms"] as const;
