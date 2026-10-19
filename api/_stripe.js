// Shared by the sticker functions. The leading underscore keeps Vercel from
// serving this file as a function of its own.
import Stripe from "stripe";

// STRIPE_SECRET_KEY if set. Otherwise the live site (VERCEL_ENV production)
// uses STRIPE_PRODUCTION, the live key, and everything else (previews, local)
// the test key in STRIPE, so a preview link never takes real money.
const live = () => (process.env.VERCEL_ENV === "production" ? process.env.STRIPE_PRODUCTION : undefined);
export const stripeKey = () => process.env.STRIPE_SECRET_KEY || live() || process.env.STRIPE;
export const stripe = () => new Stripe(stripeKey());

// The store backend (filament-shopping): its admin panel and order emails.
export const STORE_API = "https://thomasverigin.ca/3Dprintingstore/api";
