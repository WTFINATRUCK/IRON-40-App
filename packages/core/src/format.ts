export type Category = "flower" | "concentrate" | "gear";
export type OrderStatus = "queued" | "assigned" | "en_route" | "arrived" | "delivered" | "failed" | "canceled";

export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export const categoryLabel: Record<Category, string> = {
  flower: "Flower",
  concentrate: "Concentrates",
  gear: "Gear",
};

export const statusLabel: Record<OrderStatus, string> = {
  queued: "Finding a driver",
  assigned: "Driver assigned",
  en_route: "On the way",
  arrived: "Driver is outside",
  delivered: "Delivered",
  failed: "Not delivered",
  canceled: "Canceled",
};

export const ACTIVE: OrderStatus[] = ["queued", "assigned", "en_route", "arrived"];

export const receiptNo = (n: number) => `I40-${String(n).padStart(6, "0")}`;

export const grams = (g: number | null | undefined) => (g == null ? "" : `${Number(g)} g`);

export function when(iso: string | null | undefined, tz = "America/New_York") {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: tz }).format(new Date(iso));
}

// Database error codes → plain-language messages. Unknown errors get a generic line (no internals leak).
const messages: Record<string, string> = {
  not_authenticated: "Sign in to continue.",
  forbidden: "This account can't do that.",
  account_type_conflict: "This email is already used for a different kind of account. Use a separate email here.",
  unknown_store: "This store isn't available.",
  under_21: "You must be 21 or older.",
  locked_after_submission: "Your name and date of birth are locked once your ID is submitted. Contact support to change them.",
  profile_required: "Finish your profile first.",
  already_submitted: "Your ID is already submitted.",
  invalid_upload: "Upload a clear photo of your ID and a selfie (JPG, PNG or WebP, up to 8 MB each).",
  too_many_addresses: "You can save up to 5 addresses. Delete one first.",
  id_not_verified: "Your ID needs to be approved before you can order.",
  order_in_progress: "You already have an order on the way.",
  store_closed: "Delivery is closed right now. Check the hours and try again.",
  invalid_address: "Choose a delivery address.",
  out_of_zone: "That address is outside our delivery area.",
  invalid_cart: "Your cart has a problem. Remove items and add them again.",
  item_unavailable: "Something in your cart is no longer available.",
  flower_limit: "That's over the flower limit for one order.",
  concentrate_limit: "That's over the concentrate limit for one order.",
  below_minimum: "Your cart is under the order minimum.",
  too_late_to_cancel: "The driver is already on the way, so this order can't be canceled here.",
  not_found: "That record wasn't found.",
  invalid_invite: "That invite code is invalid, used or expired.",
  location_required: "Allow location access to go online.",
  finish_active_orders: "Finish or hand back active orders first.",
  invalid_transition: "That step isn't available for this order anymore.",
  reason_required: "Add a short reason.",
  not_pending: "That ID was already reviewed.",
  invalid_qty: "Enter a valid quantity.",
  insufficient_stock: "Not enough stock for that transfer.",
  invalid_timezone: "Choose a valid time zone.",
  invalid_hours: "Closing time must be after opening time.",
  rate_limited: "Too many attempts. Wait a few minutes and try again.",
};

export function errorMessage(err: unknown): string {
  const raw = typeof err === "string" ? err : (err as { message?: string } | null)?.message ?? "";
  return messages[raw] ?? "Something went wrong. Try again.";
}
