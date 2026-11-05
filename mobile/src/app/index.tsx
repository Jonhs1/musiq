import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';
import { useProfile } from '../features/profile/api';

export default function Index() {
  const { session } = useAuth();
  const { data: profile } = useProfile();

  if (!session) return <Redirect href="/login" />;
  if (profile && !profile.nickname) return <Redirect href="/profile-setup" />;
  return <Redirect href="/home" />;
}