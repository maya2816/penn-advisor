import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppShell } from "../components/Layout/AppShell.jsx";
import { StepProgram } from "../components/Setup/StepProgram.jsx";
import { StepCourses } from "../components/Setup/StepCourses.jsx";
import { StepGoals } from "../components/Setup/StepGoals.jsx";
import { StepConfirm } from "../components/Setup/StepConfirm.jsx";
import { useStudent } from "../state/StudentContext.jsx";

const STEPS = [
  { key: "program", label: "Program" },
  { key: "courses", label: "Courses" },
  { key: "goals", label: "Goals" },
  { key: "confirm", label: "Confirm" },
];

/**
 * SetupPage.jsx
 *
 * Role: Multi-step wizard — program, courses (PDF or search), optional goals,
 * then confirm. Seeds drafts from StudentContext so "Update setup" preserves work.
 *
 * Inputs: URL `?reset=1` clears all student state; otherwise hydrates from context.
 * Outputs: On confirm → writes program, courses, profile → `/dashboard`.
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

  const [stepIdx, setStepIdx] = useState(0);
  const [pickedProgram, setPickedProgram] = useState(programId);
  const [draftCourses, setDraftCourses] = useState(
    completedCourses.map((c) => ({
      id: c.id,
      semester: c.semester ?? null,
      section: c.section,
      cu: c.cu,
      grade: c.grade,
      inProgress: c.inProgress,
      placeholder: c.placeholder,
      attributes: c.attributes,
      tags: c.tags,
      pinnedSlot: c.pinnedSlot,
      degreeCredit: c.degreeCredit,
    }))
  );
  const [draftProfile, setDraftProfile] = useState(profile ?? null);

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

  const handleParsedTranscript = (transcriptData) => {
    setDraftProfile((prev) => ({
      ...(prev ?? {}),
      name: transcriptData.student?.name ?? null,
      pennId: transcriptData.student?.pennId ?? null,
      program: transcriptData.student?.program ?? null,
      major: transcriptData.student?.major ?? null,
      dateIssued: transcriptData.student?.dateIssued ?? null,
      gpa: transcriptData.totals?.gpa ?? null,
      earnedHrs: transcriptData.totals?.earnedHrs ?? null,
      inProgressCu: transcriptData.totals?.inProgressCu ?? null,
    }));
  };

  const handleConfirm = () => {
    setProgramId(pickedProgram);
    setCompletedCourses(draftCourses);
    setProfile(draftProfile ?? null);
    navigate("/dashboard");
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <ol className="mb-10 flex flex-wrap items-center justify-center gap-2 md:gap-3">
          {STEPS.map((s, i) => {
            const active = i === stepIdx;
            const done = i < stepIdx;
            return (
              <li key={s.key} className="flex items-center gap-2 md:gap-3">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition ${
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
                  className={`hidden text-sm font-medium sm:inline ${
                    active ? "text-slate-900" : "text-muted"
                  }`}
                >
                  {s.label}
                </span>
                {i < STEPS.length - 1 && (
                  <span className="mx-1 hidden h-px w-8 bg-border md:mx-2 md:inline md:w-12" />
                )}
              </li>
            );
          })}
        </ol>

        <div className="rounded-2xl border border-border bg-white p-8 shadow-card">
          {stepIdx === 0 && (
            <StepProgram
              value={pickedProgram}
              onPick={setPickedProgram}
              targetGraduationTerm={draftProfile?.targetGraduationTerm ?? null}
              onTargetGraduationChange={(term) =>
                setDraftProfile((p) => ({ ...(p ?? {}), targetGraduationTerm: term }))
              }
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
            <StepGoals
              careerInterests={draftProfile?.careerInterests ?? []}
              goalsFreeText={draftProfile?.goalsFreeText ?? ""}
              onChange={(patch) =>
                setDraftProfile((p) => ({ ...(p ?? {}), ...patch }))
              }
              onBack={() => setStepIdx(1)}
              onNext={() => setStepIdx(3)}
            />
          )}
          {stepIdx === 3 && (
            <StepConfirm
              courses={draftCourses}
              onBack={() => setStepIdx(2)}
              onConfirm={handleConfirm}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
