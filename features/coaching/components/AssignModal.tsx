"use client";

import { useState, useEffect } from "react";
import { X, Loader2, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useTrainers, useCreateAssignment } from "../queries";
import type { CoachingCandidate } from "@/lib/db/schema";

interface AssignModalProps {
    candidate: CoachingCandidate | null;
    onClose: () => void;
}

export function AssignModal({ candidate, onClose }: AssignModalProps) {
    const { data: trainers = [], isLoading: loadingTrainers } = useTrainers();
    const createAssignment = useCreateAssignment();

    const [trainerClerkId, setTrainerClerkId] = useState("");
    const [notes, setNotes] = useState("");

    // Reset form when candidate changes
    useEffect(() => {
        setTrainerClerkId("");
        setNotes("");
    }, [candidate]);

    if (!candidate) return null;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!trainerClerkId || !candidate) return;

        await createAssignment.mutateAsync({
            candidateId: candidate.id,
            trainerClerkId,
            managerNotes: notes || undefined,
        });

        onClose();
    }

    return (
        /* Backdrop */
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="relative bg-card rounded-2xl border border-border shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-base font-semibold text-foreground">
                            Assign CT
                        </h2>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {candidate.employeeName}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Candidate summary */}
                <div className="rounded-lg bg-muted/30 border border-border px-4 py-3 flex items-center gap-6 text-sm">
                    <div>
                        <p className="text-xs text-muted-foreground">PPH</p>
                        <p className="font-semibold text-amber-600 dark:text-amber-400">
                            {candidate.avgPph ? Number(candidate.avgPph).toFixed(1) : "—"}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Gap %</p>
                        <p className="font-semibold text-foreground">
                            {candidate.avgGapPct
                                ? `${Number(candidate.avgGapPct).toFixed(1)}%`
                                : "—"}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Job Title</p>
                        <p className="font-medium text-foreground">{candidate.jobTitle ?? "—"}</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* CT selector */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">
                            Certified Trainer
                        </label>
                        {loadingTrainers ? (
                            <div className="flex items-center gap-2 py-2">
                                <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                                <span className="text-sm text-muted-foreground">Loading trainers…</span>
                            </div>
                        ) : trainers.length === 0 ? (
                            <p className="text-sm text-red-500">
                                No active CTs. Invite a CT first using the panel above.
                            </p>
                        ) : (
                            <select
                                required
                                value={trainerClerkId}
                                onChange={(e) => setTrainerClerkId(e.target.value)}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                            >
                                <option value="" disabled>
                                    Select a CT…
                                </option>
                                {trainers.map((t) => (
                                    <option key={t.clerkId} value={t.clerkId}>
                                        {t.displayName ?? t.email}
                                        {t.trainerSchedule ? ` (${t.trainerSchedule})` : ""}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Manager notes */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">
                            Notes for CT{" "}
                            <span className="font-normal text-muted-foreground">(optional)</span>
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            placeholder="What should the CT focus on?"
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={
                                !trainerClerkId ||
                                trainers.length === 0 ||
                                createAssignment.isPending
                            }
                            className={cn(
                                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                                !trainerClerkId || trainers.length === 0
                                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                            )}
                        >
                            {createAssignment.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <UserCheck className="h-4 w-4" />
                            )}
                            Assign
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
