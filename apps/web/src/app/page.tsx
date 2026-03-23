import { redirect } from 'next/navigation';

/**
 * Root route — redirect to the portal (or login if unauthenticated).
 * Middleware handles the auth check and redirects to /login if needed.
 */
export default function RootPage() {
  redirect('/portal');
}
