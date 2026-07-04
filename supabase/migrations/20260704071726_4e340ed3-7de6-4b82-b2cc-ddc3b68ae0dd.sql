
CREATE TABLE public.login_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  ip text,
  user_agent text,
  location text,
  approval_token text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  resolved_at timestamptz,
  CONSTRAINT login_approval_status_check CHECK (status IN ('pending','approved','blocked','expired'))
);

CREATE INDEX login_approval_user_pending_idx ON public.login_approval_requests (user_id, status, created_at DESC);

GRANT SELECT ON public.login_approval_requests TO authenticated;
GRANT ALL ON public.login_approval_requests TO service_role;

ALTER TABLE public.login_approval_requests ENABLE ROW LEVEL SECURITY;

-- Signed-in user can see their own pending/recent requests (so Device A watcher fires).
CREATE POLICY "Users see their own approval requests"
  ON public.login_approval_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- All writes performed by server functions using the service role; no policies for INSERT/UPDATE/DELETE from clients.

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.login_approval_requests;
ALTER TABLE public.login_approval_requests REPLICA IDENTITY FULL;
