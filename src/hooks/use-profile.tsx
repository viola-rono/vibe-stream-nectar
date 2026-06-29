import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type MyProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<MyProfile | null> => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id,username,full_name,avatar_url,bio")
        .eq("id", user.id)
        .maybeSingle();
      return (data as MyProfile) ?? null;
    },
  });
}