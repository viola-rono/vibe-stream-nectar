import { supabase } from "@/integrations/supabase/client";

// Find or create a 1:1 conversation with `otherUserId`. Returns conversation id.
// Uses a SECURITY DEFINER RPC so RLS on `conversations`/`conversation_participants`
// doesn't block the initial insert+select round-trip.
export async function getOrCreateDirectConversation(_meId: string, otherUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc("get_or_create_direct_conversation", {
    _other: otherUserId,
  });
  if (error) throw error;
  if (!data) throw new Error("Failed to open conversation");
  return data as string;
}