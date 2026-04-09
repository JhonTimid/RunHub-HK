import { Express, Request, Response } from "express";
import Stripe from "stripe";
import { storage } from "./storage";

// ── Stripe client (lazy init so missing key doesn't crash at import time) ──────
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key, { apiVersion: "2025-02-24.acacia" });
}

// HK$30/month — price is created dynamically if STRIPE_PRICE_ID is not set.
// In production, create a recurring price in the Stripe dashboard and set
// STRIPE_PRICE_ID in Railway variables.
const PREMIUM_PRICE_HKD = 3000; // in cents (HKD 30.00)

async function getOrCreatePrice(stripe: Stripe): Promise<string> {
  const envPrice = process.env.STRIPE_PRICE_ID;
  if (envPrice) return envPrice;

  // Fallback: create an inline price (test mode only)
  const price = await stripe.prices.create({
    currency: "hkd",
    unit_amount: PREMIUM_PRICE_HKD,
    recurring: { interval: "month" },
    product_data: { name: "RunHub HK Premium" },
  });
  return price.id;
}

// ── Middleware: ensure logged-in ──────────────────────────────────────────────
function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: "Login required" });
  }
  next();
}

// ── Middleware: ensure admin ───────────────────────────────────────────────────
function requireAdmin(req: Request, res: Response, next: Function) {
  const u = req.user as any;
  if (!u || u.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

export function registerSubscriptionRoutes(app: Express) {
  // ── GET /api/subscription/status ─────────────────────────────────────────────
  app.get("/api/subscription/status", requireAuth, (req, res) => {
    const u = req.user as any;
    res.json({
      isPremium: u.isPremium ?? false,
      premiumUntil: u.premiumUntil ?? null,
      role: u.role ?? "user",
    });
  });

  // ── POST /api/subscription/checkout ──────────────────────────────────────────
  // Creates a Stripe Checkout session and returns the session URL
  app.post("/api/subscription/checkout", requireAuth, async (req, res) => {
    try {
      const stripe = getStripe();
      const u = req.user as any;

      const baseUrl = process.env.APP_URL ?? `https://runhub-hk-production.up.railway.app`;

      // Get or create Stripe customer
      let customerId = u.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: u.email ?? undefined,
          name: u.name,
          metadata: { userId: String(u.id) },
        });
        customerId = customer.id;
        await storage.updateUserSubscription(u.id, {
          isPremium: u.isPremium,
          premiumUntil: u.premiumUntil,
          stripeCustomerId: customerId,
        });
      }

      const priceId = await getOrCreatePrice(stripe);

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}/#/subscription?success=1`,
        cancel_url: `${baseUrl}/#/subscription?cancelled=1`,
        metadata: { userId: String(u.id) },
      });

      res.json({ url: session.url });
    } catch (e: any) {
      console.error("[stripe] checkout error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/subscription/portal ────────────────────────────────────────────
  // Opens Stripe Customer Portal (manage / cancel subscription)
  app.post("/api/subscription/portal", requireAuth, async (req, res) => {
    try {
      const stripe = getStripe();
      const u = req.user as any;

      if (!u.stripeCustomerId) {
        return res.status(400).json({ error: "No Stripe customer found. Subscribe first." });
      }

      const baseUrl = process.env.APP_URL ?? `https://runhub-hk-production.up.railway.app`;

      const session = await stripe.billingPortal.sessions.create({
        customer: u.stripeCustomerId,
        return_url: `${baseUrl}/#/subscription`,
      });

      res.json({ url: session.url });
    } catch (e: any) {
      console.error("[stripe] portal error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/subscription/webhook ───────────────────────────────────────────
  // Raw body required — Stripe signature verification
  app.post(
    "/api/subscription/webhook",
    express_raw_body_middleware,
    async (req: Request, res: Response) => {
      const sig = req.headers["stripe-signature"] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      let event: Stripe.Event;

      try {
        const stripe = getStripe();
        if (webhookSecret) {
          event = stripe.webhooks.constructEvent(
            (req as any).rawBody as Buffer,
            sig,
            webhookSecret
          );
        } else {
          // Dev: no signature verification
          event = req.body as Stripe.Event;
        }
      } catch (err: any) {
        console.error("[stripe] webhook sig error:", err.message);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
      }

      try {
        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            const userId = Number(session.metadata?.userId);
            if (!userId) break;

            // Activate premium: set until end of next month as a fallback
            const until = new Date();
            until.setMonth(until.getMonth() + 1);

            await storage.updateUserSubscription(userId, {
              isPremium: true,
              premiumUntil: until.toISOString().slice(0, 10),
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
            });
            console.log(`[stripe] User ${userId} → premium until ${until.toISOString().slice(0, 10)}`);
            break;
          }

          case "invoice.paid": {
            const invoice = event.data.object as Stripe.Invoice;
            const customerId = invoice.customer as string;
            const user = await storage.getUserByStripeCustomerId(customerId);
            if (!user) break;

            const until = new Date();
            until.setMonth(until.getMonth() + 1);
            await storage.updateUserSubscription(user.id, {
              isPremium: true,
              premiumUntil: until.toISOString().slice(0, 10),
              stripeSubscriptionId: (invoice as any).subscription ?? user.stripeSubscriptionId,
            });
            console.log(`[stripe] invoice.paid → User ${user.id} extended to ${until.toISOString().slice(0, 10)}`);
            break;
          }

          case "customer.subscription.deleted":
          case "invoice.payment_failed": {
            const obj = event.data.object as any;
            const customerId = obj.customer as string;
            const user = await storage.getUserByStripeCustomerId(customerId);
            if (!user) break;

            await storage.updateUserSubscription(user.id, {
              isPremium: false,
              premiumUntil: null,
              stripeSubscriptionId: null,
            });
            console.log(`[stripe] subscription cancelled/failed → User ${user.id} → free`);
            break;
          }
        }
      } catch (err) {
        console.error("[stripe] webhook handler error:", err);
      }

      res.json({ received: true });
    }
  );
}

// Express middleware to pass raw body for webhook signature verification
function express_raw_body_middleware(req: Request, _res: Response, next: Function) {
  // rawBody is already set by the global json middleware in index.ts
  next();
}
