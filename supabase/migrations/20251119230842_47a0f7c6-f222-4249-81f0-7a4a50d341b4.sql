-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS on_auth_user_created_staff ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_staff_user();

-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'front_desk');

-- Create staff_profiles table
CREATE TABLE public.staff_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create user_roles table for secure role management
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create OTA connections table
CREATE TABLE public.ota_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  ota_name TEXT NOT NULL,
  api_key TEXT NOT NULL,
  api_endpoint TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create staff activity log
CREATE TABLE public.staff_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES public.staff_profiles(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ota_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for staff_profiles
CREATE POLICY "Staff can view their own profile"
  ON public.staff_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
  ON public.staff_profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can update their own profile"
  ON public.staff_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for ota_connections
CREATE POLICY "Staff can view OTA connections"
  ON public.ota_connections FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage OTA connections"
  ON public.ota_connections FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for staff_activity_log
CREATE POLICY "Staff can view their own activity"
  ON public.staff_activity_log FOR SELECT
  USING (staff_id IN (SELECT id FROM public.staff_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can view all activity"
  ON public.staff_activity_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to auto-create staff profile and assign default role
CREATE OR REPLACE FUNCTION public.handle_new_staff_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create staff profile
  INSERT INTO public.staff_profiles (user_id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  
  -- Assign default role (front_desk)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'front_desk'));
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_staff
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_staff_user();

-- Add triggers for updated_at
CREATE TRIGGER update_staff_profiles_updated_at
  BEFORE UPDATE ON public.staff_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ota_connections_updated_at
  BEFORE UPDATE ON public.ota_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();