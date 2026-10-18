// Shared by the sticker functions. The leading underscore keeps Vercel from
// serving this file as a function of its own.
import Stripe from "stripe";

// STRIPE_SECRET_KEY, or a variable called just STRIPE.
export const stripeKey = () => process.env.STRIPE_SECRET_KEY || process.env.STRIPE;
export const stripe = () => new Stripe(stripeKey());

// The store backend (filament-shopping): its admin panel and order emails.
export const STORE_API = "https://thomasverigin.ca/3Dprintingstore/api";
