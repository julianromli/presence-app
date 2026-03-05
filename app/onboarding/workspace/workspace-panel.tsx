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
      <main className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center px-6 py-10">
        <p className="text-sm text-muted-foreground">Memuat onboarding workspace...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col justify-center px-6 py-10">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">Pilih cara mulai</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Buat workspace baru atau gabung ke workspace yang sudah ada.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/30 p-1">
          <button
            type="button"
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              mode === "create"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => {
              setMode("create");
              setError(null);
            }}
          >
            Create new workspace
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              mode === "join"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => {
              setMode("join");
              setError(null);
            }}
          >
            Join existing workspace
          </button>
        </div>

        {mode === "create" ? (
          <div className="mt-6 space-y-3">
            <label className="block text-sm font-medium text-foreground" htmlFor="workspace-name">
              Workspace name
            </label>
            <input
              id="workspace-name"
              type="text"
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              placeholder="Contoh: Isometricon HQ"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-offset-2 placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40"
            />
            <button
              type="button"
              onClick={handleCreateWorkspace}
              disabled={submitting || workspaceName.trim().length < 3}
              className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Creating..." : "Create workspace"}
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <label className="block text-sm font-medium text-foreground" htmlFor="workspace-code">
              Invitation code
            </label>
            <input
              id="workspace-code"
              type="text"
              value={invitationCode}
              onChange={(event) => setInvitationCode(event.target.value.toUpperCase())}
              placeholder="Contoh: TEAM-7K4M-PRESENCE"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm uppercase outline-none ring-offset-2 placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40"
            />
            <p className="text-xs text-muted-foreground">
              Minta kode undangan ke superadmin workspace Anda.
            </p>
            <button
              type="button"
              onClick={handleJoinWorkspace}
              disabled={submitting || invitationCode.trim().length < 3}
              className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Joining..." : "Join workspace"}
            </button>
          </div>
        )}

        {error ? (
          <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
