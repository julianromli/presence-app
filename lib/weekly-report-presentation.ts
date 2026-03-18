export type WeeklyReportPresentation = {
  status: "pending" | "success" | "failed";
  weekKey: string;
  generatedAt?: number;
  startedAt?: number;
  finishedAt?: number;
  triggerSource?: "manual" | "cron";
  fileName?: string;
  byteLength?: number;
};

export function formatWeeklyReportStatusLabel(
  status: WeeklyReportPresentation["status"],
) {
  switch (status) {
    case "success":
      return "Berhasil";
    case "failed":
      return "Gagal";
    default:
      return "Diproses";
  }
}

export function getWeeklyReportStatusTone(
  status: WeeklyReportPresentation["status"],
) {
  switch (status) {
    case "success":
      return "success";
    case "failed":
      return "danger";
    default:
      return "warning";
  }
}

export function formatWeeklyReportSourceLabel(
  source?: WeeklyReportPresentation["triggerSource"],
) {
  if (source === "manual") {
    return "Manual";
  }
  if (source === "cron") {
    return "Cron";
  }
  return "-";
}

function formatTimestamp(timestamp?: number) {
  if (timestamp === undefined) {
    return "-";
  }
  return new Date(timestamp).toLocaleString("id-ID");
}

export function getWeeklyReportTimestampMeta(report: WeeklyReportPresentation) {
  if (report.status === "success" && report.generatedAt !== undefined) {
    return {
      label: "Terbit",
      value: formatTimestamp(report.generatedAt),
    };
  }

  if (report.status === "failed" && report.finishedAt !== undefined) {
    return {
      label: "Gagal",
      value: formatTimestamp(report.finishedAt),
    };
  }

  if (report.status === "pending" && report.startedAt !== undefined) {
    return {
      label: "Mulai",
      value: formatTimestamp(report.startedAt),
    };
  }

  return {
    label: "Waktu",
    value: "-",
  };
}

function formatBytes(byteLength?: number) {
  if (byteLength === undefined) {
    return "Ukuran file belum tersedia.";
  }

  if (byteLength < 1024) {
    return `${byteLength} B`;
  }

  if (byteLength < 1024 * 1024) {
    return `${(byteLength / 1024).toFixed(1)} KB`;
  }

  return `${(byteLength / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatWeeklyReportFileMeta(report: WeeklyReportPresentation) {
  if (report.status === "pending") {
    return {
      primary: "Belum tersedia",
      secondary: "File akan siap setelah proses selesai.",
    };
  }

  if (report.status === "failed") {
    return {
      primary: "Tidak tersedia",
      secondary: "Periksa error sebelum mencoba generate ulang.",
    };
  }

  return {
    primary: report.fileName ?? `absenin_id_${report.weekKey}.xlsx`,
    secondary: formatBytes(report.byteLength),
  };
}
