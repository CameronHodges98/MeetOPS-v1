"use client";

import { useState, useRef, useCallback } from "react";
import Papa from "papaparse";
import {
    Upload,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    CheckCircle2,
    Loader2,
    Users,
    TrendingDown,
    UserPlus,
    UserCheck,
    Clock,
    PlayCircle,
    Eye,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
    useCoachingUploads,
    useCoachingCandidates,
    useAssignments,
    useUpdateAssignment,
    type AssignmentRow,
} from "../queries";
import {
    COACHING_ELIGIBLE_ROLES,
    PPH_COACHING_STANDARD,
    MAX_DIRECT_RATIO_FOR_COACHING,
} from "@/config/constants";
import type { PerformanceRow } from "@/app/api/coaching/upload/route";
import type { CoachingCandidate, CoachingTemplate } from "@/lib/db/schema";
import { InviteCtPanel } from "./InviteCtPanel";
import { AssignModal } from "./AssignModal";

// ── Helpers ─────────────────────────────────────────────────────

function getMostRecentMonday(): string {
    const now = new Date();
    const day = now.getDay();
    const daysBack = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysBack);
    return monday.toISOString().slice(0, 10);
}

function toTitleCase(s: string): string {
    return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatPph(pph: string | null): string {
    if (!pph) return "—";
    const n = Number(pph);
    return isNaN(n) ? "—" : n.toFixed(1);
}

// avg_gap_pct is stored as a percentage (e.g. 15.41 = 15.41%) — no ×100 needed
function formatGap(gapPct: string | null): string {
    if (!gapPct) return "—";
    const n = Number(gapPct);
    return isNaN(n) ? "—" : `${n.toFixed(1)}%`;
}

function formatHours(hrs: string | null): string {
    if (!hrs) return "—";
    const n = Number(hrs);
    return isNaN(n) ? "—" : n.toFixed(1);
}

// PPH: amber if below 100 standard, green at or above
function pphStatus(pph: string | null): "amber" | "green" {
    if (!pph) return "green";
    const n = Number(pph);
    if (n < PPH_COACHING_STANDARD) return "amber";
    return "green";
}

// GAP %: red > 13%, amber 10–13%, green < 10%
function gapStatus(gapPct: string | null): "red" | "amber" | "green" {
    if (!gapPct) return "green";
    const n = Number(gapPct);
    if (isNaN(n)) return "green";
    if (n > 13) return "red";
    if (n > 10) return "amber";
    return "green";
}

const STATUS_CLASSES = {
    red: "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400",
    amber: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
    green: "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400",
};

const ASSIGNMENT_STATUS = {
    assigned: {
        label: "Assigned",
        color: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400",
        icon: <Clock className="h-3 w-3" />,
    },
    in_progress: {
        label: "In Progress",
        color: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
        icon: <PlayCircle className="h-3 w-3" />,
    },
    pending_review: {
        label: "Review",
        color: "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400",
        icon: <Eye className="h-3 w-3" />,
    },
    complete: {
        label: "Complete",
        color: "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400",
        icon: <CheckCircle2 className="h-3 w-3" />,
    },
};

// ── Upload panel ─────────────────────────────────────────────────

type UploadState = "idle" | "parsing" | "uploading" | "done" | "error";

interface UploadPanelProps {
    onDone: (uploadId: number) => void;
}

function UploadPanel({ onDone }: UploadPanelProps) {
    const [file, setFile] = useState<File | null>(null);
    const [weekDate, setWeekDate] = useState(getMostRecentMonday());
    const [state, setState] = useState<UploadState>("idle");
    const [message, setMessage] = useState("");
    const [candidateCount, setCandidateCount] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    async function handleUpload() {
        if (!file) return;
        setState("parsing");
        setMessage("Parsing CSV…");

        Papa.parse<Record<string, string>>(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => h.replace(/^﻿/, "").trim(),
            complete: async (result) => {
                const raw = result.data;
                if (!raw.length) {
                    setState("error");
                    setMessage("File is empty or could not be parsed.");
                    return;
                }

                const candidates: PerformanceRow[] = [];
                for (const r of raw) {
                    // CSV job titles are ALLCAPS — normalize to title case for eligibility check
                    const jobTitle = toTitleCase(r["JOB TITLE"]?.trim() ?? "");
                    if (!COACHING_ELIGIBLE_ROLES.has(jobTitle)) continue;

                    const pph = Number(r["PPH"] ?? 0);
                    const directHours = Number(r["DIRECT HOURS"] ?? 0);
                    const indirectHours = Number(r["INDIRECT HOURS"] ?? 0);
                    const adminHours = Number(r["ADMIN HOURS"] ?? 0);
                    const totalHours = Number(r["TOTAL HOURS"] ?? 0);

                    // Skip employees whose indirect time exceeds the threshold
                    if (
                        totalHours > 0 &&
                        indirectHours / totalHours >
                            MAX_DIRECT_RATIO_FOR_COACHING
                    )
                        continue;
                    // Skip employees at or above PPH standard
                    if (pph >= PPH_COACHING_STANDARD) continue;

                    candidates.push({
                        // Normalize names to title case; store gapPct as percentage (e.g. 15.41, not 0.1541)
                        managerName: toTitleCase(
                            r["SUPERVISOR"]?.trim() ?? "UNKNOWN"
                        ),
                        employeeName: toTitleCase(
                            r["EMPLOYEE"]?.trim() ?? "UNKNOWN"
                        ),
                        jobTitle,
                        pph,
                        gapPct: Number(r["GAP %"] ?? 0) * 100,
                        directHours,
                        indirectHours,
                        adminHours,
                        totalHours,
                    });
                }

                setState("uploading");
                setMessage(
                    `Uploading ${candidates.length} candidate${candidates.length !== 1 ? "s" : ""}…`
                );

                try {
                    const res = await fetch("/api/coaching/upload", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            weekStartDate: weekDate,
                            fileName: file.name,
                            rows: candidates,
                        }),
                    });
                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        setState("error");
                        setMessage(
                            (err as { error?: string }).error ?? "Server error"
                        );
                        return;
                    }
                    const { uploadId, candidateCount: count } =
                        (await res.json()) as {
                            uploadId: number;
                            candidateCount: number;
                        };
                    setCandidateCount(count);
                    setState("done");
                    setMessage("Upload complete");
                    onDone(uploadId);
                } catch {
                    setState("error");
                    setMessage("Network error. Check your connection.");
                }
            },
            error: (err: { message: string }) => {
                setState("error");
                setMessage(err.message);
            },
        });
    }

    return (
        <div className="space-y-4">
            {/* Week date */}
            <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-foreground w-28 shrink-0">
                    Week of
                </label>
                <input
                    type="date"
                    value={weekDate}
                    onChange={(e) => setWeekDate(e.target.value)}
                    disabled={state === "uploading" || state === "parsing"}
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
            </div>

            {/* File picker */}
            {(state === "idle" || state === "error") && (
                <div
                    className="flex items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-primary/40 bg-muted/20 p-8 cursor-pointer transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <div className="text-center">
                        <Upload className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
                        {file ? (
                            <>
                                <p className="text-sm font-medium text-foreground">
                                    {file.name}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {(file.size / 1024).toFixed(0)} KB · Click
                                    to change
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="text-sm font-medium text-foreground">
                                    Click to select Performance Data CSV
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Export from Paylocity Performance report
                                </p>
                            </>
                        )}
                    </div>
                </div>
            )}

            <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setState("idle");
                }}
            />

            {/* Status */}
            {state === "error" && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-3">
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-700 dark:text-red-400">
                        {message}
                    </p>
                </div>
            )}

            {(state === "parsing" || state === "uploading") && (
                <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
                    <p className="text-sm text-foreground">{message}</p>
                </div>
            )}

            {state === "done" && (
                <div className="flex items-start gap-2 rounded-lg bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 p-3">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-sm font-medium text-green-800 dark:text-green-300">
                            Upload complete
                        </p>
                        <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                            {candidateCount} coaching candidate
                            {candidateCount !== 1 ? "s" : ""} identified
                        </p>
                    </div>
                </div>
            )}

            {/* Action buttons */}
            {(state === "idle" || state === "error") && (
                <button
                    onClick={handleUpload}
                    disabled={!file}
                    className={cn(
                        "rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                        file
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : "bg-muted text-muted-foreground cursor-not-allowed"
                    )}
                >
                    Upload
                </button>
            )}

            {state === "done" && (
                <button
                    onClick={() => {
                        setFile(null);
                        setState("idle");
                        setMessage("");
                    }}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                    Upload another week
                </button>
            )}
        </div>
    );
}

// ── Manager review inline panel ──────────────────────────────────

interface ManagerReviewProps {
    assignment: AssignmentRow;
    onComplete: (managerNotes: string) => void;
    completing: boolean;
}

function ManagerReview({ assignment, onComplete, completing }: ManagerReviewProps) {
    const [notes, setNotes] = useState(assignment.assignment.managerNotes ?? "");
    const objectives = (assignment.template.objectives ?? []) as {
        id: string;
        text: string;
    }[];
    const results = (assignment.assignment.objectiveResults ?? []) as {
        objectiveId: string;
        result: string;
        comment?: string;
    }[];

    return (
        <div className="border-t border-border px-5 py-4 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                CT Submission
            </p>

            {/* Objective results */}
            <div className="space-y-2">
                {objectives.map((o) => {
                    const r = results.find((x) => x.objectiveId === o.id);
                    return (
                        <div
                            key={o.id}
                            className="flex items-start gap-3 rounded-lg border border-border p-3"
                        >
                            <span
                                className={cn(
                                    "mt-0.5 shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full",
                                    r?.result === "understands"
                                        ? STATUS_CLASSES.green
                                        : r?.result === "bottleneck"
                                          ? STATUS_CLASSES.red
                                          : "bg-muted text-muted-foreground"
                                )}
                            >
                                {r?.result === "understands"
                                    ? "✓"
                                    : r?.result === "bottleneck"
                                      ? "!"
                                      : "—"}
                            </span>
                            <div>
                                <p className="text-xs text-foreground">{o.text}</p>
                                {r?.comment && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {r.comment}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* CT summary notes */}
            {assignment.assignment.ctSummaryNotes && (
                <div className="rounded-lg bg-muted/30 border border-border px-3 py-2">
                    <p className="text-xs font-medium text-foreground mb-1">
                        CT summary
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {assignment.assignment.ctSummaryNotes}
                    </p>
                </div>
            )}

            {/* Manager notes + complete */}
            {assignment.assignment.status === "pending_review" && (
                <div className="space-y-3 pt-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Manager review
                    </p>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        placeholder="Optional manager notes…"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <div className="flex justify-end">
                        <button
                            onClick={() => onComplete(notes)}
                            disabled={completing}
                            className="flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
                        >
                            {completing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <CheckCircle2 className="h-4 w-4" />
                            )}
                            Mark complete
                        </button>
                    </div>
                </div>
            )}

            {assignment.assignment.status === "complete" && (
                <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-4 w-4" />
                    Completed{" "}
                    {assignment.assignment.completedAt
                        ? new Date(assignment.assignment.completedAt).toLocaleDateString()
                        : ""}
                    {notes && ` · "${notes}"`}
                </div>
            )}
        </div>
    );
}

// ── Candidates table ─────────────────────────────────────────────

interface CandidatesTableProps {
    candidates: CoachingCandidate[];
    supervisorFilter: string;
    assignmentMap: Map<number, AssignmentRow>;
    onAssign: (candidate: CoachingCandidate) => void;
}

function CandidatesTable({
    candidates,
    supervisorFilter,
    assignmentMap,
    onAssign,
}: CandidatesTableProps) {
    const updateAssignment = useUpdateAssignment();
    const [reviewOpen, setReviewOpen] = useState<Set<number>>(new Set());
    const [completing, setCompleting] = useState<number | null>(null);

    // Group by supervisor
    const groups = new Map<string, CoachingCandidate[]>();
    for (const c of candidates) {
        const key = c.managerName;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(c);
    }

    // Sort groups: if supervisorFilter matches a group, that group first
    const sortedGroups = Array.from(groups.entries()).sort(([a], [b]) => {
        const filter = supervisorFilter.toLowerCase();
        const aMatch = a.toLowerCase().includes(filter);
        const bMatch = b.toLowerCase().includes(filter);
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        return a.localeCompare(b);
    });

    if (sortedGroups.length === 0) {
        return (
            <div className="rounded-xl border border-border p-10 text-center text-muted-foreground text-sm">
                No coaching candidates found for the selected week and filter.
            </div>
        );
    }

    async function handleComplete(assignmentId: number, managerNotes: string) {
        setCompleting(assignmentId);
        try {
            await updateAssignment.mutateAsync({
                id: assignmentId,
                action: "complete",
                managerNotes,
            });
            setReviewOpen((prev) => {
                const next = new Set(prev);
                next.delete(assignmentId);
                return next;
            });
        } finally {
            setCompleting(null);
        }
    }

    function toggleReview(assignmentId: number) {
        setReviewOpen((prev) => {
            const next = new Set(prev);
            if (next.has(assignmentId)) next.delete(assignmentId);
            else next.add(assignmentId);
            return next;
        });
    }

    return (
        <div className="space-y-6">
            {sortedGroups.map(([managerName, rows]) => (
                <div
                    key={managerName}
                    className="rounded-xl border border-border overflow-hidden"
                >
                    {/* Group header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border">
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-semibold text-foreground">
                                {toTitleCase(managerName)}
                            </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                            {rows.length} candidate
                            {rows.length !== 1 ? "s" : ""}
                        </span>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                                        #
                                    </th>
                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                                        Employee
                                    </th>
                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                                        Job Title
                                    </th>
                                    <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">
                                        PPH
                                    </th>
                                    <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">
                                        Gap %
                                    </th>
                                    <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">
                                        Total Hrs
                                    </th>
                                    <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">
                                        Indirect %
                                    </th>
                                    <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">
                                        Coaching
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((c, i) => {
                                    const ps = pphStatus(c.avgPph);
                                    const gs = gapStatus(c.avgGapPct);
                                    const aRow = c.assignmentId
                                        ? assignmentMap.get(c.assignmentId)
                                        : undefined;
                                    const aStatus = aRow
                                        ? ASSIGNMENT_STATUS[
                                              aRow.assignment.status
                                          ] ?? ASSIGNMENT_STATUS.assigned
                                        : null;
                                    const hasReview =
                                        aRow?.assignment.status ===
                                            "pending_review" ||
                                        aRow?.assignment.status === "complete";

                                    return (
                                        <>
                                            <tr
                                                key={c.id}
                                                className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors"
                                            >
                                                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                                                    {i + 1}
                                                </td>
                                                <td className="px-4 py-2.5 font-medium text-foreground">
                                                    {c.employeeName}
                                                </td>
                                                <td className="px-4 py-2.5 text-muted-foreground">
                                                    {c.jobTitle}
                                                </td>
                                                <td className="px-4 py-2.5 text-right">
                                                    <span
                                                        className={cn(
                                                            "inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full",
                                                            STATUS_CLASSES[ps]
                                                        )}
                                                    >
                                                        <TrendingDown className="h-3 w-3" />
                                                        {formatPph(c.avgPph)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-right">
                                                    <span
                                                        className={cn(
                                                            "inline-flex text-xs font-semibold px-2 py-0.5 rounded-full",
                                                            STATUS_CLASSES[gs]
                                                        )}
                                                    >
                                                        {formatGap(c.avgGapPct)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-right text-muted-foreground text-xs">
                                                    {formatHours(c.avgHours)}
                                                </td>
                                                <td className="px-4 py-2.5 text-right text-muted-foreground text-xs">
                                                    {c.avgIndirectPct
                                                        ? `${Number(c.avgIndirectPct).toFixed(0)}%`
                                                        : "—"}
                                                </td>
                                                <td className="px-4 py-2.5 text-right">
                                                    {aStatus ? (
                                                        <button
                                                            onClick={() =>
                                                                hasReview &&
                                                                aRow &&
                                                                toggleReview(
                                                                    aRow.assignment
                                                                        .id
                                                                )
                                                            }
                                                            className={cn(
                                                                "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                                                                aStatus.color,
                                                                hasReview &&
                                                                    "hover:opacity-80 cursor-pointer"
                                                            )}
                                                        >
                                                            {aStatus.icon}
                                                            {aStatus.label}
                                                            {hasReview &&
                                                                aRow &&
                                                                (reviewOpen.has(
                                                                    aRow.assignment.id
                                                                ) ? (
                                                                    <ChevronUp className="h-3 w-3" />
                                                                ) : (
                                                                    <ChevronDown className="h-3 w-3" />
                                                                ))}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => onAssign(c)}
                                                            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:bg-muted transition-colors"
                                                        >
                                                            <UserPlus className="h-3 w-3" />
                                                            Assign
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                            {/* Manager review inline row */}
                                            {hasReview &&
                                                aRow &&
                                                reviewOpen.has(
                                                    aRow.assignment.id
                                                ) && (
                                                    <tr
                                                        key={`review-${c.id}`}
                                                    >
                                                        <td
                                                            colSpan={8}
                                                            className="p-0"
                                                        >
                                                            <ManagerReview
                                                                assignment={aRow}
                                                                onComplete={(notes) =>
                                                                    handleComplete(
                                                                        aRow.assignment
                                                                            .id,
                                                                        notes
                                                                    )
                                                                }
                                                                completing={
                                                                    completing ===
                                                                    aRow.assignment
                                                                        .id
                                                                }
                                                            />
                                                        </td>
                                                    </tr>
                                                )}
                                        </>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Main view ────────────────────────────────────────────────────

interface CoachingViewProps {
    userDisplayName: string;
}

export function CoachingView({ userDisplayName }: CoachingViewProps) {
    const [uploadOpen, setUploadOpen] = useState(false);
    const [ctPanelOpen, setCtPanelOpen] = useState(false);
    const [selectedUploadId, setSelectedUploadId] = useState<number | null>(null);
    const [supervisorFilter, setSupervisorFilter] = useState(userDisplayName);
    const [assignTarget, setAssignTarget] = useState<CoachingCandidate | null>(null);

    const { data: uploads, refetch: refetchUploads } = useCoachingUploads();
    const effectiveUploadId = selectedUploadId ?? uploads?.[0]?.id ?? null;

    const { data: candidatesData, isLoading } = useCoachingCandidates(
        effectiveUploadId,
        supervisorFilter
    );
    const { data: assignments = [] } = useAssignments(effectiveUploadId);

    // Build map: assignmentId → AssignmentRow for O(1) lookup in table
    const assignmentMap = new Map<number, AssignmentRow>();
    for (const row of assignments) {
        assignmentMap.set(row.assignment.id, row);
    }

    const handleUploadDone = useCallback(
        (uploadId: number) => {
            refetchUploads().then(() => {
                setSelectedUploadId(uploadId);
                setUploadOpen(false);
            });
        },
        [refetchUploads]
    );

    const candidates = candidatesData?.candidates ?? [];
    const upload = candidatesData?.upload;

    return (
        <div className="space-y-6">
            {/* Top action panels */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Upload row */}
                <button
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/30 transition-colors"
                    onClick={() => {
                        setUploadOpen((v) => !v);
                        if (ctPanelOpen) setCtPanelOpen(false);
                    }}
                >
                    <div className="flex items-center gap-2">
                        <Upload className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-semibold text-foreground">
                            Upload Performance Data
                        </span>
                        {uploads && uploads.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                                · {uploads.length} week
                                {uploads.length !== 1 ? "s" : ""} on file
                            </span>
                        )}
                    </div>
                    {uploadOpen ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                </button>

                {uploadOpen && (
                    <div className="px-5 pb-5 border-t border-border pt-4">
                        <UploadPanel onDone={handleUploadDone} />
                    </div>
                )}

                {/* CT management row */}
                <button
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/30 transition-colors border-t border-border"
                    onClick={() => {
                        setCtPanelOpen((v) => !v);
                        if (uploadOpen) setUploadOpen(false);
                    }}
                >
                    <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-semibold text-foreground">
                            Manage Certified Trainers
                        </span>
                    </div>
                    {ctPanelOpen ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                </button>

                {ctPanelOpen && (
                    <div className="px-5 pb-5">
                        <InviteCtPanel open={ctPanelOpen} />
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Week selector */}
                <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Week</label>
                    <select
                        value={effectiveUploadId ?? ""}
                        onChange={(e) =>
                            setSelectedUploadId(Number(e.target.value) || null)
                        }
                        className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                        {!uploads?.length && (
                            <option value="">No data uploaded yet</option>
                        )}
                        {uploads?.map((u) => (
                            <option key={u.id} value={u.id}>
                                Week of {u.weekStartDate}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Supervisor filter */}
                <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">
                        Supervisor
                    </label>
                    <input
                        type="text"
                        value={supervisorFilter}
                        onChange={(e) => setSupervisorFilter(e.target.value)}
                        placeholder="All supervisors"
                        className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 w-52"
                    />
                    {supervisorFilter && (
                        <button
                            onClick={() => setSupervisorFilter("")}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Clear
                        </button>
                    )}
                </div>

                {/* Summary badge */}
                {upload && (
                    <span className="ml-auto text-xs text-muted-foreground">
                        {candidatesData?.candidates.length ?? 0} candidate
                        {(candidatesData?.candidates.length ?? 0) !== 1
                            ? "s"
                            : ""}
                        {supervisorFilter ? " (filtered)" : ""} ·{" "}
                        {upload.candidateCount} total this week
                    </span>
                )}
            </div>

            {/* Candidates */}
            {!uploads?.length ? (
                <div className="rounded-xl border-2 border-dashed border-muted p-12 text-center text-muted-foreground text-sm">
                    No performance data uploaded yet. Use the panel above to
                    upload a weekly CSV.
                </div>
            ) : isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
                </div>
            ) : (
                <CandidatesTable
                    candidates={candidates}
                    supervisorFilter={supervisorFilter}
                    assignmentMap={assignmentMap}
                    onAssign={setAssignTarget}
                />
            )}

            {/* Assign modal */}
            <AssignModal
                candidate={assignTarget}
                onClose={() => setAssignTarget(null)}
            />
        </div>
    );
}
