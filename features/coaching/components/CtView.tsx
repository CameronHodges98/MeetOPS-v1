"use client";

import { useState } from "react";
import {
    ChevronDown,
    ChevronUp,
    Loader2,
    CheckCircle2,
    Clock,
    PlayCircle,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useAssignments, useUpdateAssignment } from "../queries";
import type { CoachingTemplate } from "@/lib/db/schema";

type ObjectiveResult = {
    objectiveId: string;
    result: "understands" | "bottleneck";
    comment: string;
};

interface CtViewProps {
    ctName: string;
}

function AssignmentCard({ row }: { row: import("../queries").AssignmentRow }) {
    const { assignment, candidate, template } = row;
    const updateAssignment = useUpdateAssignment();

    const [open, setOpen] = useState(false);
    const [objectiveResults, setObjectiveResults] = useState<
        Record<string, ObjectiveResult>
    >(() => {
        // Pre-fill from any existing results
        const existing = (assignment.objectiveResults ?? []) as ObjectiveResult[];
        return Object.fromEntries(existing.map((r) => [r.objectiveId, r]));
    });
    const [ctSummaryNotes, setCtSummaryNotes] = useState(
        assignment.ctSummaryNotes ?? ""
    );
    const [submitting, setSubmitting] = useState(false);

    const objectives = (template.objectives ?? []) as {
        id: string;
        text: string;
    }[];
    const allAnswered = objectives.every((o) => objectiveResults[o.id]?.result);

    const statusConfig: Record<
        string,
        { label: string; color: string; icon: React.ReactNode }
    > = {
        assigned: {
            label: "Assigned",
            color: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400",
            icon: <Clock className="h-3.5 w-3.5" />,
        },
        in_progress: {
            label: "In Progress",
            color: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
            icon: <PlayCircle className="h-3.5 w-3.5" />,
        },
        pending_review: {
            label: "Submitted",
            color: "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400",
            icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        },
        complete: {
            label: "Complete",
            color: "bg-muted text-muted-foreground",
            icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        },
    };

    const status = statusConfig[assignment.status] ?? statusConfig.assigned;
    const isComplete =
        assignment.status === "pending_review" || assignment.status === "complete";

    async function handleStart() {
        await updateAssignment.mutateAsync({ id: assignment.id, action: "start" });
        setOpen(true);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        try {
            await updateAssignment.mutateAsync({
                id: assignment.id,
                action: "submit",
                objectiveResults: objectives.map((o) => ({
                    objectiveId: o.id,
                    result: objectiveResults[o.id]?.result ?? "understands",
                    comment: objectiveResults[o.id]?.comment ?? "",
                })),
                ctSummaryNotes,
            });
            setOpen(false);
        } finally {
            setSubmitting(false);
        }
    }

    function setResult(
        objectiveId: string,
        result: "understands" | "bottleneck",
        comment?: string
    ) {
        setObjectiveResults((prev) => ({
            ...prev,
            [objectiveId]: {
                objectiveId,
                result,
                comment: comment ?? prev[objectiveId]?.comment ?? "",
            },
        }));
    }

    function setComment(objectiveId: string, comment: string) {
        setObjectiveResults((prev) => ({
            ...prev,
            [objectiveId]: {
                objectiveId,
                result: prev[objectiveId]?.result ?? "understands",
                comment,
            },
        }));
    }

    return (
        <div className="rounded-xl border border-border overflow-hidden">
            {/* Header row */}
            <div className="flex items-center justify-between px-5 py-4">
                <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-foreground">
                        {candidate.employeeName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {candidate.jobTitle} ·{" "}
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                            {candidate.avgPph
                                ? `${Number(candidate.avgPph).toFixed(1)} PPH`
                                : "—"}
                        </span>{" "}
                        ·{" "}
                        <span>
                            {candidate.avgGapPct
                                ? `${Number(candidate.avgGapPct).toFixed(1)}% gap`
                                : "—"}
                        </span>
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <span
                        className={cn(
                            "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full",
                            status.color
                        )}
                    >
                        {status.icon}
                        {status.label}
                    </span>

                    {assignment.status === "assigned" && (
                        <button
                            onClick={handleStart}
                            disabled={updateAssignment.isPending}
                            className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:bg-primary/90 transition-colors"
                        >
                            Start
                        </button>
                    )}

                    {assignment.status === "in_progress" && (
                        <button
                            onClick={() => setOpen((v) => !v)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {open ? (
                                <>
                                    <ChevronUp className="h-4 w-4" /> Close
                                </>
                            ) : (
                                <>
                                    <ChevronDown className="h-4 w-4" /> Complete form
                                </>
                            )}
                        </button>
                    )}

                    {isComplete && (
                        <button
                            onClick={() => setOpen((v) => !v)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {open ? (
                                <>
                                    <ChevronUp className="h-4 w-4" /> Hide
                                </>
                            ) : (
                                <>
                                    <ChevronDown className="h-4 w-4" /> View
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Manager notes */}
            {assignment.managerNotes && (
                <div className="mx-5 mb-3 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-0.5">
                        Manager notes
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                        {assignment.managerNotes}
                    </p>
                </div>
            )}

            {/* Coaching form */}
            {open && (
                <div className="border-t border-border px-5 py-5">
                    <p className="text-sm font-semibold text-foreground mb-4">
                        {template.name}
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {objectives.map((o) => {
                            const res = objectiveResults[o.id];
                            return (
                                <div
                                    key={o.id}
                                    className="rounded-lg border border-border p-4 space-y-3"
                                >
                                    <p className="text-sm text-foreground">{o.text}</p>

                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            disabled={isComplete}
                                            onClick={() =>
                                                setResult(o.id, "understands")
                                            }
                                            className={cn(
                                                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors border",
                                                res?.result === "understands"
                                                    ? "bg-green-100 dark:bg-green-950/40 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400"
                                                    : "border-border text-muted-foreground hover:bg-muted"
                                            )}
                                        >
                                            Understands
                                        </button>
                                        <button
                                            type="button"
                                            disabled={isComplete}
                                            onClick={() =>
                                                setResult(o.id, "bottleneck")
                                            }
                                            className={cn(
                                                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors border",
                                                res?.result === "bottleneck"
                                                    ? "bg-red-100 dark:bg-red-950/40 border-red-300 dark:border-red-700 text-red-700 dark:text-red-400"
                                                    : "border-border text-muted-foreground hover:bg-muted"
                                            )}
                                        >
                                            Bottleneck
                                        </button>
                                    </div>

                                    {res?.result === "bottleneck" && (
                                        <textarea
                                            disabled={isComplete}
                                            value={res.comment}
                                            onChange={(e) =>
                                                setComment(o.id, e.target.value)
                                            }
                                            placeholder="Describe the bottleneck…"
                                            rows={2}
                                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                                        />
                                    )}
                                </div>
                            );
                        })}

                        {/* Summary notes */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-foreground">
                                Summary notes
                                <span className="font-normal text-muted-foreground ml-1">
                                    (optional)
                                </span>
                            </label>
                            <textarea
                                disabled={isComplete}
                                value={ctSummaryNotes}
                                onChange={(e) => setCtSummaryNotes(e.target.value)}
                                rows={3}
                                placeholder="Overall observations, agreed next steps…"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                            />
                        </div>

                        {!isComplete && (
                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={!allAnswered || submitting}
                                    className={cn(
                                        "flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition-colors",
                                        allAnswered && !submitting
                                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                            : "bg-muted text-muted-foreground cursor-not-allowed"
                                    )}
                                >
                                    {submitting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <CheckCircle2 className="h-4 w-4" />
                                    )}
                                    Submit to manager
                                </button>
                            </div>
                        )}
                    </form>
                </div>
            )}
        </div>
    );
}

export function CtView({ ctName }: CtViewProps) {
    const { data: assignments = [], isLoading } = useAssignments();

    const active = assignments.filter(
        (r) => r.assignment.status !== "complete"
    );
    const completed = assignments.filter(
        (r) => r.assignment.status === "complete"
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="rounded-xl border border-border bg-card px-5 py-4">
                <p className="text-sm text-muted-foreground">
                    Welcome, <span className="font-semibold text-foreground">{ctName}</span>.
                    Complete the coaching template for each assigned employee and
                    submit when done.
                </p>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
                </div>
            ) : assignments.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-muted p-12 text-center text-muted-foreground text-sm">
                    No assignments yet. Your manager will assign employees to you.
                </div>
            ) : (
                <>
                    {active.length > 0 && (
                        <div className="space-y-3">
                            <h2 className="text-sm font-semibold text-foreground">
                                Active ({active.length})
                            </h2>
                            {active.map((row) => (
                                <AssignmentCard key={row.assignment.id} row={row} />
                            ))}
                        </div>
                    )}

                    {completed.length > 0 && (
                        <div className="space-y-3">
                            <h2 className="text-sm font-semibold text-muted-foreground">
                                Completed ({completed.length})
                            </h2>
                            {completed.map((row) => (
                                <AssignmentCard key={row.assignment.id} row={row} />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
