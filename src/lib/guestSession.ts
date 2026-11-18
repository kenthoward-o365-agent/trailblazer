// Client-side helpers for the booking-engine guest session.
// The token is minted by the `guest_login` action and stored in sessionStorage
// (per browser tab) so refreshes work but leaving the site logs the guest out.

const keyFor = (slug: string) => `guest_session:${slug}`;

export interface GuestSession {
  token: string;
  reservation_id: string;
  expires_at: number; // epoch seconds
}

export function saveGuestSession(slug: string, s: { token: string; reservation_id: string; expires_in: number }) {
  const payload: GuestSession = {
    token: s.token,
    reservation_id: s.reservation_id,
    expires_at: Math.floor(Date.now() / 1000) + s.expires_in,
  };
  sessionStorage.setItem(keyFor(slug), JSON.stringify(payload));
}

export function getGuestSession(slug: string): GuestSession | null {
  try {
    const raw = sessionStorage.getItem(keyFor(slug));
    if (!raw) return null;
    const s = JSON.parse(raw) as GuestSession;
    if (Math.floor(Date.now() / 1000) >= s.expires_at) {
      sessionStorage.removeItem(keyFor(slug));
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function clearGuestSession(slug: string) {
  sessionStorage.removeItem(keyFor(slug));
}
