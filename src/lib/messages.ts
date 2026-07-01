import { supabase } from "@/integrations/supabase/client";

// Find or create a 1:1 conversation with `otherUserId`. Returns conversation id.
export async function getOrCreateDirectConversation(meId: string, otherUserId: string): Promise<string> {
  if (meId === otherUserId) throw new Error("Cannot message yourself");

  // Look up existing direct conversation containing both participants
  const { data: mine } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", meId);

  const myConvIds = (mine ?? []).map((r: any) => r.conversation_id as string);
  if (myConvIds.length) {
    const { data: theirs } = await supabase
      .from("conversation_participants")
      .select("conversation_id, conversations!inner(type)")
      .eq("user_id", otherUserId)
      .in("conversation_id", myConvIds);
    const match = (theirs ?? []).find((r: any) => r.conversations?.type === "direct" || !r.conversations?.type);
    if (match) return (match as any).conversation_id as string;
  }

  // Create a new direct conversation
  const { data: conv, error: convErr } = await supabase
    .from("conversations")
    .insert({ type: "direct" })
    .select("id")
    .single();
  if (convErr || !conv) throw convErr ?? new Error("Failed to create conversation");

  const { error: partErr } = await supabase
    .from("conversation_participants")
    .insert([
      { conversation_id: conv.id, user_id: meId },
      { conversation_id: conv.id, user_id: otherUserId },
    ]);
  if (partErr) throw partErr;

  return conv.id;
}