"use client";

import { useState } from "react";
import { Copy, Check, UserPlus, Trash2, Calendar, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useTrainers } from "../queries";

interface InviteCtPanelProps {
    open: boolean;
}

export function InviteCtPanel({ open }: InviteCtPanelProps) {
    const { data: trainers = [], isLoading: loadingTrainers, refetch } = useTrainers();

    const [generating, setGenerating] = useState(false);
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [revoking, setRevoking] = useState<string | null>(null);

    if (!open) return null;

    async function generateInvite() {
        setGenerating(true);
        setInviteLink(null);
        try {
            const res = await fetch("/api/coaching/invites", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            if (!res.ok) throw new Error("Failed to generate invite");
            const { token } = await res.json() as { token: string };
            const url = `${window.location.origin}/invite/${token}`;
            setInviteLink(url);
        } catch {
            alert("Failed to generate invite link. Please try again.");
        } finally {
            setGenerating(false);
        }
    }

    async function copyLink() {
        if (!inviteLink) return;
        await navigator.clipboard.writeText(inviteLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    async function revokeTrainer(clerkId: string) {
        if (!confirm("Remove this CT? They will lose access immediately.")) return;
        setRevoking(clerkId);
        try {
            await fetch(`/api/coaching/trainers/${clerkId}`, { method: "DELETE" });
            refetch();
        } catch {
            alert("Failed to revoke access.");
        } finally {
            setRevoking(null);
        }
    }

    return (
        <div className="border-t border-border pt-5 mt-1 space-y-5">
            {/* Generate invite */}
            <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">
                    Invite a Certified Trainer
                </p>
                <p className="text-xs text-muted-foreground">
                    Generate a one-time link. The CT signs up with their personal email and
                    gains access to the coaching page only.
                </p>
                <div className="flex items-center gap-3">
                    <button
                        onClick={generateInvite}
                        disabled={generating}
                        className={cn(
                            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                            generating
                                ? "bg-muted text-muted-foreground cursor-not-allowed"
                                : "bg-primary text-primary-foreground hover:bg-primary/90"
                        )}
                    >
                        {generating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <UserPlus className="h-4 w-4" />
                        )}
                        Generate invite link
                    </button>
                </div>

                {inviteLink && (
                    <div className="flex items-center gap-2">
                        <input
                            readOnly
                            value={inviteLink}
                            className="flex-1 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs text-foreground font-mono focus:outline-none"
                        />
                        <button
                            onClick={copyLink}
                            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                        >
                            {copied ? (
                                <>
                                    <Check className="h-3.5 w-3.5 text-green-500" />
                                    Copied
                                </>
                            ) : (
                                <>
                                    <Copy className="h-3.5 w-3.5" />
                                    Copy
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>

            {/* Active CTs */}
            <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                    Active Certified Trainers
                    {trainers.length > 0 && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                            ({trainers.length})
                        </span>
                    )}
                </p>

                {loadingTrainers ? (
                    <div className="flex items-center gap-2 py-4">
                        <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                        <span className="text-sm text-muted-foreground">Loading…</span>
                    </div>
                ) : trainers.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                        No CTs have accepted an invite yet.
                    </p>
                ) : (
                    <div className="rounded-xl border border-border overflow-hidden">
                        {trainers.map((t, i) => (
                            <div
                                key={t.clerkId}
                                className={cn(
                                    "flex items-center justify-between px-4 py-3",
                                    i < trainers.length - 1 && "border-b border-border/60"
                                )}
                            >
                                <div>
                                    <p className="text-sm font-medium text-foreground">
                                        {t.displayName ?? "—"}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{t.email}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {t.trainerSchedule && (
                                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Calendar className="h-3.5 w-3.5" />
                                            {t.trainerSchedule}
                                        </span>
                                    )}
                                    <button
                                        onClick={() => revokeTrainer(t.clerkId)}
                                        disabled={revoking === t.clerkId}
                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                        title="Revoke access"
                                    >
                                        {revoking === t.clerkId ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
