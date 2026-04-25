-- Per-module access permissions for staff users
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, module)
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own or admin all permissions"
  ON public.user_permissions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "admin insert permissions"
  ON public.user_permissions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "admin update permissions"
  ON public.user_permissions FOR UPDATE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "admin delete permissions"
  ON public.user_permissions FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON public.user_permissions(user_id);