import { supabase } from "@/integrations/supabase/client";

const FN = "booking-engine-public";

async function call<T = any>(action: string, body: Record<string, any>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(FN, { body: { action, ...body } });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).detail || (data as any).error);
  return data as T;
}

export const bookingApi = {
  getProperty: (slug: string) => call("get_property", { slug }),
  search: (slug: string, check_in: string, check_out: string, guests: number, filters?: any) =>
    call("search", { slug, check_in, check_out, guests, filters }),
  hold: (slug: string, payload: any) => call("hold", { slug, ...payload }),
  quote: (slug: string, payload: any) => call("quote", { slug, ...payload }),
  adyenSession: (slug: string, payload: any) => call("adyen_session", { slug, ...payload }),
  confirm: (slug: string, payload: any) => call("confirm", { slug, ...payload }),
  lookup: (slug: string, payload: any) => call("lookup", { slug, ...payload }),
  cancel: (slug: string, payload: any) => call("cancel", { slug, ...payload }),

  // Guest self-service
  guestLogin: (slug: string, payload: { confirmation_number: string; last_name: string; zipcode: string }) =>
    call("guest_login", { slug, ...payload }),
  myReservations: (slug: string, guest_token: string) =>
    call("my_reservations", { slug, guest_token }),
  checkinPrefetch: (slug: string, guest_token: string) =>
    call("checkin_prefetch", { slug, guest_token }),
  checkinUpdateGuest: (slug: string, guest_token: string, payload: any) =>
    call("checkin_update_guest", { slug, guest_token, ...payload }),
  checkinAdyenSession: (slug: string, guest_token: string, payload: any) =>
    call("checkin_adyen_session", { slug, guest_token, ...payload }),
  checkinUploadSignature: (slug: string, guest_token: string, signature_data_url: string, signed_name?: string) =>
    call("checkin_upload_signature", { slug, guest_token, signature_data_url, signed_name }),
  checkinComplete: (slug: string, guest_token: string) =>
    call("checkin_complete", { slug, guest_token }),
};
