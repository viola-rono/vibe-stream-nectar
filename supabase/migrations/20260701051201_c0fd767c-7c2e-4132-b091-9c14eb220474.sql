
-- comment_likes table
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.comment_likes TO authenticated;
GRANT ALL ON public.comment_likes TO service_role;

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY comment_likes_select ON public.comment_likes FOR SELECT USING (true);
CREATE POLICY comment_likes_insert ON public.comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY comment_likes_delete ON public.comment_likes FOR DELETE USING (auth.uid() = user_id);

-- Comment like count trigger
CREATE OR REPLACE FUNCTION public.update_comment_likes_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.comments SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.comments SET likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0) WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_comment_likes_count ON public.comment_likes;
CREATE TRIGGER trg_comment_likes_count
AFTER INSERT OR DELETE ON public.comment_likes
FOR EACH ROW EXECUTE FUNCTION public.update_comment_likes_count();

-- Conversation last_message trigger
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations
     SET last_message = COALESCE(NEW.content, '[media]'),
         last_message_at = NEW.created_at
   WHERE id = NEW.conversation_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_conversation_last_message ON public.messages;
CREATE TRIGGER trg_conversation_last_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();

-- Enable realtime
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
