"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  setActiveWorkspaceIdInBrowser,
  workspaceFetch,
} from "@/lib/workspace-client";
import { bootstrapActiveWorkspaceForMember } from "./bootstrap-active-workspace";

type OnboardingState = {
  hasActiveMembership: boolean;
  memberships: Array<{
    membershipId: string;
    role: "superadmin" | "admin" | "karyawan" | "device-qr";
    isActive: boolean;
    workspace: {
      _id: string;
      name: string;
      slug: string;
      isActive: boolean;
    };
  }>;
};

type Mode = "create" | "join";

export function OnboardingWorkspacePanel() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("create");
  const [loadingState, setLoadingState] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [invitationCode, setInvitationCode] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await workspaceFetch("/api/workspaces/onboarding", {
          method: "GET",
          cache: "no-store",
        });
        if (!response.ok) {
          if (!cancelled) {
            setError("Gagal memuat status onboarding.");
          }
          return;
        }

        const data = (await response.json()) as OnboardingState;
        if (!cancelled && data.hasActiveMembership) {
          await bootstrapActiveWorkspaceForMember(workspaceFetch);
          router.replace("/dashboard");
        }
      } catch {
        if (!cancelled) {
          setError("Gagal memuat status onboarding.");
        }
      } finally {
        if (!cancelled) {
          setLoadingState(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleCreateWorkspace() {
    setMode("create");
    setSubmitting(true);
    setError(null);
    try {
      const response = await workspaceFetch("/api/workspaces/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: workspaceName }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        setError(payload.message ?? "Gagal membuat workspace.");
        return;
      }

      const payload = (await response.json()) as { workspaceId: string };
      const selectResponse = await workspaceFetch("/api/workspaces/active", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: payload.workspaceId }),
      });
      if (!selectResponse.ok) {
        setError("Workspace berhasil dibuat, tapi gagal set workspace aktif.");
        return;
      }

      setActiveWorkspaceIdInBrowser(payload.workspaceId);
      router.replace("/dashboard");
    } catch {
      setError("Gagal membuat workspace.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleJoinWorkspace() {
    setMode("join");
    setSubmitting(true);
    setError(null);
    try {
      const response = await workspaceFetch("/api/workspaces/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: invitationCode }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        setError(payload.message ?? "Gagal bergabung ke workspace.");
        return;
      }

      const payload = (await response.json()) as { workspaceId: string };
      const selectResponse = await workspaceFetch("/api/workspaces/active", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: payload.workspaceId }),
      });
      if (!selectResponse.ok) {
        setError("Berhasil join, tapi gagal set workspace aktif.");
        return;
      }

      setActiveWorkspaceIdInBrowser(payload.workspaceId);
      router.replace("/dashboard");
    } catch {
      setError("Gagal bergabung ke workspace.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingState) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">
            Memuat workspace Anda...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen w-full flex-col lg:flex-row">
      {/* Left Branding Panel */}
      <div className="hidden lg:flex lg:w-1/2 lg:flex-col lg:justify-between bg-zinc-950 p-12 text-zinc-50 relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 font-bold text-2xl tracking-tighter">
            <div className="h-8 w-8 rounded-lg bg-white text-zinc-950 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
              >
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            Presence
          </div>
        </div>

        <div className="relative z-10 max-w-lg">
          <h2 className="text-4xl font-semibold tracking-tight leading-tight mb-4">
            Kelola tim dan presensi dengan cara yang lebih modern.
          </h2>
          <p className="text-zinc-400 text-lg">
            Buat ruang kerja untuk perusahaan Anda, atau bergabung dengan tim
            yang sudah ada dalam hitungan detik.
          </p>
        </div>
      </div>

      {/* Right Interaction Panel */}
      <div className="flex w-full lg:w-1/2 flex-col items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Selamat Datang
            </h1>
            <p className="text-muted-foreground">
              Silakan pilih cara untuk memulai di Presence.
            </p>
          </div>

          {/* Custom Segmented Control */}
          <div className="flex rounded-xl bg-muted/50 p-1">
            <button
              onClick={() => {
                setMode("create");
                setError(null);
              }}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
                mode === "create"
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Buat Workspace
            </button>
            <button
              onClick={() => {
                setMode("join");
                setError(null);
              }}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
                mode === "join"
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Gabung Workspace
            </button>
          </div>

          {/* Forms */}
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {mode === "create" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-foreground"
                    htmlFor="workspace-name"
                  >
                    Nama Workspace Baru
                  </label>
                  <input
                    id="workspace-name"
                    type="text"
                    value={workspaceName}
                    onChange={(event) => setWorkspaceName(event.target.value)}
                    placeholder="Contoh: Isometricon HQ"
                    className="flex h-12 w-full rounded-xl border border-input bg-transparent px-4 py-2 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCreateWorkspace}
                  disabled={submitting || workspaceName.trim().length < 3}
                  className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                >
                  {submitting ? "Membuat workspace..." : "Mulai Buat Workspace"}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      className="text-sm font-medium text-foreground"
                      htmlFor="workspace-code"
                    >
                      Kode Undangan
                    </label>
                  </div>
                  <input
                    id="workspace-code"
                    type="text"
                    value={invitationCode}
                    onChange={(event) =>
                      setInvitationCode(event.target.value.toUpperCase())
                    }
                    placeholder="Contoh: TEAM-7K4M-PRESENCE"
                    className="flex h-12 w-full rounded-xl border border-input bg-transparent px-4 py-2 text-sm uppercase shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <p className="text-[13px] text-muted-foreground">
                    Dapatkan kode undangan dari superadmin workspace Anda.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleJoinWorkspace}
                  disabled={submitting || invitationCode.trim().length < 3}
                  className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                >
                  {submitting ? "Memverifikasi kode..." : "Bergabung Sekarang"}
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="animate-in fade-in zoom-in-95 duration-200 mt-4">
              <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 shrink-0"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p>{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
