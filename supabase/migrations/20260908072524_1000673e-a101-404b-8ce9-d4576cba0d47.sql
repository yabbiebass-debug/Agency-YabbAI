revoke all on function public.approve_approval(uuid) from public, anon;
revoke all on function public.reject_approval(uuid) from public, anon;
revoke all on function public.close_deal(uuid, text, text, numeric, numeric) from public, anon;
revoke all on function public.mark_replied(uuid) from public, anon;
grant execute on function public.approve_approval(uuid) to authenticated;
grant execute on function public.reject_approval(uuid) to authenticated;
grant execute on function public.close_deal(uuid, text, text, numeric, numeric) to authenticated;
grant execute on function public.mark_replied(uuid) to authenticated;