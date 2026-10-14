import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type IndividualCoursePrice = {
  course_id: number;
  title: string;
  cover_image_path: string | null;
  unit_amount: number;
  currency: string;
};

// Courses sold on their own, each with its own one-off Stripe price.
// Courses missing from this list cannot be bought individually.
export function useIndividualCoursePrices() {
  return useQuery({
    queryKey: ["public", "individual_course_prices"],
    queryFn: async (): Promise<IndividualCoursePrice[]> => {
      const { data, error } = await supabase.rpc("get_individual_course_prices");
      if (error) throw error;
      return ((data ?? []) as IndividualCoursePrice[]).map((r) => ({
        ...r,
        course_id: Number(r.course_id),
        unit_amount: Number(r.unit_amount),
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function formatUsd(cents: number): string {
  const v = cents / 100;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}
