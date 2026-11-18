-- Remove the demo admin insert that failed
-- Staff will be created when they sign up via auth

-- Create a trigger to automatically create staff profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_staff_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.staff_profiles (user_id, first_name, last_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'Staff'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'User'),
    COALESCE((NEW.raw_user_meta_data->>'role')::staff_role, 'front_desk')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_staff
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_staff_user();