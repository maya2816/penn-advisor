import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppShell } from "../components/Layout/AppShell.jsx";
import { StepProgram } from "../components/Setup/StepProgram.jsx";
import { StepCourses } from "../components/Setup/StepCourses.jsx";
import { StepConfirm } from "../components/Setup/StepConfirm.jsx";
import { useStudent } from "../state/StudentContext.jsx";

const STEPS = [
  { key: "program", label: "Program" },
  { key: "courses", label: "Courses" },
  { key: "confirm", label: "Confirm" },
];

/**
 * SetupPage — three-step wizard for entering program + completed courses.
 *
 * Flow:
 *   1. Pick program  →  2. Add courses (paste or search)  →  3. Review & confirm
 *
 * If `?reset=1` is in the URL (the Reset link in AppShell), wipe existing
 * student state on mount before showing step 1. After Confirm, save to
 * StudentContext (which persists to localStorage) and navigate to /dashboard.
 */
export function SetupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    programId,
    completedCourses,
    profile,
    setProgramId,
    setCompletedCourses,
    setProfile,
    reset,
  } = useStudent();

  // Local wizard state. We seed from any existing context so a returning
  // user doesn't lose their work mid-edit.
  //
  // Draft shape: Array<{ id: string, semester?: string, cu?: number, grade?: string, inProgress?: boolean }>
  // — populated by the PDF parser and threaded through to the dashboard
  // so it can group / display by term and grade later.
  const [stepIdx, setStepIdx] = useState(0);
  const [pickedProgram, setPickedProgram] = useState(programId);
  const [draftCourses, setDraftCourses] = useState(
    completedCourses.map((c) => ({
      id: c.id,
      semester: c.semester ?? null,
      cu: c.cu,
      grade: c.grade,
      inProgress: c.inProgress,
    }))
  );
  const [draftProfile, setDraftProfile] = useState(profile ?? null);

  // Reset support: ?reset=1 wipes everything before the wizard mounts.
  useEffect(() => {
    if (searchParams.get("reset") === "1") {
      reset();
      setPickedProgram(null);
      setDraftCourses([]);
      setDraftProfile(null);
      setStepIdx(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Called when StepCourses successfully parses a transcript PDF — we
  // capture the rich student identity + totals so the dashboard can
  // show name, GPA, etc. later.
  const handleParsedTranscript = (transcriptData) => {
    setDraftProfile({
      name: transcriptData.student?.name ?? null,
      pennId: transcriptData.student?.pennId ?? null,
      program: transcriptData.student?.program ?? null,
      major: transcriptData.student?.major ?? null,
      dateIssued: transcriptData.student?.dateIssued ?? null,
      gpa: transcriptData.totals?.gpa ?? null,
      earnedHrs: transcriptData.totals?.earnedHrs ?? null,
      inProgressCu: transcriptData.totals?.inProgressCu ?? null,
    });
  };

  const handleConfirm = () => {
    setProgramId(pickedProgram);
    setCompletedCourses(draftCourses);
    if (draftProfile) setProfile(draftProfile);
    navigate("/dashboard");
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        {/* Step indicator */}
        <ol className="mb-10 flex items-center justify-center gap-3">
          {STEPS.map((s, i) => {
            const active = i === stepIdx;
            const done = i < stepIdx;
            return (
              <li key={s.key} className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition ${
                    active
                      ? "bg-penn text-white"
                      : done
                      ? "bg-success text-white"
                      : "bg-slate-200 text-muted"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </div>
                <span
                  className={`text-sm font-medium ${
                    active ? "text-slate-900" : "text-muted"
                  }`}
                >
                  {s.label}
                </span>
                {i < STEPS.length - 1 && <span className="mx-2 h-px w-12 bg-border" />}
              </li>
            );
          })}
        </ol>

        <div className="rounded-2xl border border-border bg-white p-8 shadow-card">
          {stepIdx === 0 && (
            <StepProgram
              value={pickedProgram}
              onPick={setPickedProgram}
              onNext={() => setStepIdx(1)}
            />
          )}
          {stepIdx === 1 && (
            <StepCourses
              courses={draftCourses}
              onChange={setDraftCourses}
              onParsedTranscript={handleParsedTranscript}
              onBack={() => setStepIdx(0)}
              onNext={() => setStepIdx(2)}
            />
          )}
          {stepIdx === 2 && (
            <StepConfirm
              courses={draftCourses}
              onBack={() => setStepIdx(1)}
              onConfirm={handleConfirm}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
