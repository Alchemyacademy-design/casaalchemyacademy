import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { eligibilityForCourse } from "@/manus/services/certificate";

export type ModuleCompletionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleId: number;
  moduleTitle: string;
  courseId: number | null;
  nextModuleId: number | null;
  moduleExam: { id: number; title: string } | null;
  onGoToModuleQuiz: () => void;
};

/**
 * Shown once, at the moment the last lesson of a module is marked complete.
 *
 * Logic (parent decides when to open):
 *  - If the module has a published module-exam and the student has not passed
 *    it yet: CTA -> jump to the module quiz on this page.
 *  - Otherwise, if there is a next module: CTA -> next module.
 *  - Otherwise (last module of the course):
 *      * If a published course-final exam exists and is not passed: CTA -> the
 *        course page (where the final exam renders).
 *      * Else if the student is eligible for the certificate: CTA -> course page.
 *      * Else: CTA -> back to the course overview.
 */
export default function ModuleCompletionDialog({
  open,
  onOpenChange,
  moduleId,
  moduleTitle,
  courseId,
  nextModuleId,
  moduleExam,
  onGoToModuleQuiz,
}: ModuleCompletionDialogProps) {
  const navigate = useNavigate();

  const modulePassedQuery = useQuery({
    queryKey: ["module-exam-passed", moduleExam?.id],
    enabled: open && !!moduleExam?.id,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !moduleExam) return false;
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select("id")
        .eq("user_id", user.id)
        .eq("quiz_id", moduleExam.id)
        .eq("passed", true)
        .not("submitted_at", "is", null)
        .limit(1);
      if (error) throw error;
      return (data ?? []).length > 0;
    },
  });

  const isLastModule = !nextModuleId;

  const finalExamQuery = useQuery({
    queryKey: ["course-final-exam", courseId, "published", "completion-dialog"],
    enabled: open && isLastModule && !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("id,title")
        .eq("course_id", courseId!)
        .is("lesson_id", null)
        .is("module_id", null)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      return data as { id: number; title: string } | null;
    },
  });

  const finalExamPassedQuery = useQuery({
    queryKey: ["course-final-exam-passed", finalExamQuery.data?.id],
    enabled: open && !!finalExamQuery.data?.id,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const examId = finalExamQuery.data?.id;
      if (!user || !examId) return false;
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select("id")
        .eq("user_id", user.id)
        .eq("quiz_id", examId)
        .eq("passed", true)
        .not("submitted_at", "is", null)
        .limit(1);
      if (error) throw error;
      return (data ?? []).length > 0;
    },
  });

  const eligibilityQuery = useQuery({
    queryKey: ["certificate-eligibility", courseId, "completion-dialog"],
    enabled: open && isLastModule && !!courseId,
    queryFn: () => eligibilityForCourse(courseId!),
  });

  // Decide the action for this dialog instance.
  type Action =
    | { kind: "loading" }
    | { kind: "module-quiz"; label: string; hint: string }
    | { kind: "next-module"; label: string; hint: string }
    | { kind: "course-final-exam"; label: string; hint: string }
    | { kind: "certificate"; label: string; hint: string }
    | { kind: "course-overview"; label: string; hint: string };

  const action: Action = useMemo(() => {
    // Module exam still pending → always route to it, never let the student skip.
    if (moduleExam) {
      if (modulePassedQuery.isLoading) return { kind: "loading" };
      if (modulePassedQuery.data === false) {
        return {
          kind: "module-quiz",
          label: "Take the module quiz",
          hint: `A required quiz for ${moduleTitle} is waiting. Pass it to finish this module.`,
        };
      }
    }

    if (!isLastModule) {
      return {
        kind: "next-module",
        label: "Continue to the next module",
        hint: "You’re ready to move on. The next module begins whenever you are.",
      };
    }

    // Last module of the course.
    if (finalExamQuery.isLoading || finalExamPassedQuery.isLoading || eligibilityQuery.isLoading) {
      return { kind: "loading" };
    }
    if (finalExamQuery.data && finalExamPassedQuery.data === false) {
      return {
        kind: "course-final-exam",
        label: "Go to the course final exam",
        hint: "This is the final exam for the entire course. Pass it to complete your journey.",
      };
    }
    if (eligibilityQuery.data?.eligible) {
      return {
        kind: "certificate",
        label: "View your certificate",
        hint: "You’ve met every requirement. Your certificate is ready.",
      };
    }
    return {
      kind: "course-overview",
      label: "Back to course overview",
      hint: "You’ve completed every module. Review the course from the overview whenever you like.",
    };
  }, [
    moduleExam,
    moduleTitle,
    isLastModule,
    modulePassedQuery.isLoading,
    modulePassedQuery.data,
    finalExamQuery.isLoading,
    finalExamQuery.data,
    finalExamPassedQuery.isLoading,
    finalExamPassedQuery.data,
    eligibilityQuery.isLoading,
    eligibilityQuery.data,
  ]);

  // If the dialog was closed via ESC/overlay, leave the page state alone.
  useEffect(() => {
    if (!open) return;
  }, [open]);

  const handlePrimary = () => {
    switch (action.kind) {
      case "module-quiz":
        onOpenChange(false);
        onGoToModuleQuiz();
        return;
      case "next-module":
        onOpenChange(false);
        if (nextModuleId) navigate(`/modules/${nextModuleId}`);
        return;
      case "course-final-exam":
      case "certificate":
      case "course-overview":
        onOpenChange(false);
        if (courseId) navigate(`/courses/${courseId}`);
        return;
      default:
        return;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md border-0 p-0 overflow-hidden"
        style={{
          background: "var(--aa-cream, #F8F5EF)",
          color: "var(--aa-text-dark, #2A2318)",
        }}
      >
        <div
          aria-hidden
          className="h-1 w-full"
          style={{ background: "var(--aa-gold, #C4A05A)" }}
        />
        <div className="px-8 pt-8 pb-6">
          <p
            className="text-[11px] uppercase tracking-[0.22em] mb-4"
            style={{ color: "var(--aa-olive-mid, #5C5840)", fontFamily: "Manrope, sans-serif" }}
          >
            Module complete
          </p>
          <DialogHeader className="text-left space-y-3">
            <DialogTitle
              className="text-3xl leading-tight font-normal"
              style={{
                fontFamily: "'Instrument Serif', serif",
                color: "var(--aa-olive-dark, #3D3A2A)",
              }}
            >
              You’ve completed {moduleTitle}.
            </DialogTitle>
            <DialogDescription
              className="text-sm leading-relaxed"
              style={{
                color: "var(--aa-text-mid, #5C5248)",
                fontFamily: "Manrope, sans-serif",
              }}
            >
              {action.kind === "loading" ? "Checking what comes next…" : action.hint}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-8 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              style={{
                color: "var(--aa-text-mid, #5C5248)",
                fontFamily: "Manrope, sans-serif",
              }}
            >
              Stay on this page
            </Button>
            <Button
              type="button"
              onClick={handlePrimary}
              disabled={action.kind === "loading"}
              style={{
                background: "var(--aa-gold, #C4A05A)",
                color: "var(--aa-text-dark, #2A2318)",
                fontFamily: "Manrope, sans-serif",
                fontWeight: 600,
                border: "1px solid var(--aa-gold, #C4A05A)",
              }}
            >
              {action.kind === "loading" ? "Loading…" : action.label}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}