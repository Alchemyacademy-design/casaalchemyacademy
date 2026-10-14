import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/manus/hooks/useAuth";
import { getLoginUrl } from "@/manus/const";
import { formatUsd, useIndividualCoursePrices } from "@/manus/hooks/useIndividualCoursePrices";
import { INDIVIDUAL_COURSE_OPEN } from "@/manus/lib/feature-flags";

const ANNUAL_TOTAL_CENTS = 70800;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: number;
  courseTitle?: string;
};

export default function CoursePurchaseGate({ open, onOpenChange, courseId, courseTitle }: Props) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { data: prices = [] } = useIndividualCoursePrices();
  const coursePrice = INDIVIDUAL_COURSE_OPEN ? prices.find((p) => p.course_id === courseId) : undefined;
  // Only claim value when a year of everything costs less than two of these courses.
  const showValueLine = Boolean(coursePrice && ANNUAL_TOTAL_CENTS < coursePrice.unit_amount * 2);

  // Same destination as the landing page Join buttons: sign in, then plans.
  const joinMembership = () => {
    onOpenChange(false);
    navigate(isAuthenticated ? "/plans" : `${getLoginUrl()}?next=${encodeURIComponent("/plans")}`);
  };
  const buyCourse = () => {
    onOpenChange(false);
    navigate(`/choose-course?course=${courseId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Choose how to join</DialogTitle>
          <DialogDescription>{courseTitle ? `Get access to ${courseTitle}.` : "Get access to this course."}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative rounded-xl border-2 border-accent bg-accent/5 p-5 shadow-sm">
            <span className="absolute -top-3 left-5 rounded-full bg-accent px-3 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-foreground">
              Best value
            </span>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Annual member</p>
            <p className="mt-1 font-serif text-3xl text-primary">
              <span className="mr-1 text-xs font-sans uppercase tracking-widest">USD</span>59
              <span className="ml-1 text-xs font-sans uppercase tracking-widest text-muted-foreground">/ month</span>
            </p>
            <p className="mt-1 text-sm text-foreground/80">Every course, billed yearly (USD 708)</p>
            {showValueLine ? (
              <p className="mt-2 text-sm font-medium text-primary">Every course for a year, for less than the price of two courses</p>
            ) : null}
            <Button onClick={joinMembership} className="mt-4 w-full">Join Annual</Button>
          </div>

          <div className="rounded-xl border border-border p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Monthly member</p>
            <p className="mt-1 font-serif text-2xl text-primary">
              <span className="mr-1 text-xs font-sans uppercase tracking-widest">USD</span>99
              <span className="ml-1 text-xs font-sans uppercase tracking-widest text-muted-foreground">/ month</span>
            </p>
            <p className="mt-1 text-sm text-foreground/80">Every course, cancel anytime</p>
            <Button onClick={joinMembership} variant="secondary" className="mt-3 w-full">Join Monthly</Button>
          </div>

          {coursePrice ? (
            <div className="rounded-xl border border-dashed border-border p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">This course only</p>
              <p className="mt-1 font-serif text-xl text-primary">
                <span className="mr-1 text-xs font-sans uppercase tracking-widest">USD</span>{formatUsd(coursePrice.unit_amount)}
              </p>
              <p className="mt-1 text-sm text-foreground/80">One-time payment, 6 months access to this course</p>
              <Button onClick={buyCourse} variant="outline" className="mt-3 w-full">Buy this course</Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
