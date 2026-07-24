
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_has_any_role(app_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_write() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_read() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.apply_stock_movement(uuid, stock_movement_type, numeric, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_has_any_role(app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read() TO authenticated;
