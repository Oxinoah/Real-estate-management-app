import { supabase } from './supabase';

// Reads the role and name of a signed-in user from `profiles` and returns the
// session object the app routes on: { user, role, fullName }, or null.
export async function loadProfile(user) {
  if (!user) return null;
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();
  if (error || !profile) return null;
  return { user, role: profile.role, fullName: profile.full_name };
}
