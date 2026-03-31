// stripe.js
// ---------
// Minimal Stripe integration scaffolding for SnapCast.
//
// Real Stripe verification requires a server + webhook to confirm payment.
// This file provides:
// - a local "premium" entitlement flag (from chrome.storage)
// - opening a Stripe Checkout page (URL placeholder)
//
// Next steps after wiring a backend:
// - replace the "local flag" with webhook-driven updates to storage
// - add a secure way to verify session_id (via backend)

const STORAGE_KEY_PREMIUM = "snapcast.premium";
const STORAGE_KEY_LAST_CHECKOUT = "snapcast.lastCheckout";

// TODO: replace with your real Stripe Checkout URL for the $49 Lifetime plan.
export const STRIPE_LIFETIME_CHECKOUT_URL = "https://buy.stripe.com/REPLACE_ME";

export async function getIsPremium() {
  const res = await chrome.storage.local.get([STORAGE_KEY_PREMIUM]);
  return Boolean(res[STORAGE_KEY_PREMIUM]);
}

export async function setIsPremium(paid) {
  await chrome.storage.local.set({ [STORAGE_KEY_PREMIUM]: Boolean(paid) });
}

export async function markCheckoutStarted() {
  await chrome.storage.local.set({
    [STORAGE_KEY_LAST_CHECKOUT]: Date.now()
  });
}

export async function openLifetimeCheckout() {
  await markCheckoutStarted();
  await chrome.tabs.create({ url: STRIPE_LIFETIME_CHECKOUT_URL, active: true });
}

