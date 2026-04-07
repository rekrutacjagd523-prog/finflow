import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY environment variable is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
  typescript: true,
});

export const STRIPE_PLANS = {
  monthly: {
    priceId: process.env.STRIPE_PRICE_MONTHLY ?? "",
    amount: 2900, // $29.00
    interval: "month" as const,
  },
  annual: {
    priceId: process.env.STRIPE_PRICE_ANNUAL ?? "",
    amount: 28800, // $288.00
    interval: "year" as const,
  },
} as const;

export type PlanInterval = keyof typeof STRIPE_PLANS;
