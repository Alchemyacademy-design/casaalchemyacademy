
UPDATE public.membership_plans
SET description = 'Full annual access at the best value — includes every course, community, members events, magazine, exclusive deals, and Live Classes with Lorena. One payment covers 12 months.'
WHERE key = 'annual_member';

UPDATE public.membership_plans
SET description = 'Complete monthly access to every course, community, events, magazine, suppliers directory and exclusive deals. Cancel anytime.'
WHERE key = 'monthly_member';

UPDATE public.membership_plans
SET description = 'One-time purchase for lifetime access to a single course, including all lesson materials, quizzes and completion certificate.'
WHERE key = 'individual_course';
