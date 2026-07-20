
REVOKE ALL ON FUNCTION public.get_alchemist_leaderboard(text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_alchemist_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_alchemist_leaderboard(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_alchemist_stats() TO authenticated;
