import Stripe from "stripe";
import orgModel from "../models/organizationModel.js";
import dotenv from "dotenv";
dotenv.config();

console.log(
  "Stripe key:",
  process.env.STRIPE_SECRET_KEY ? "Loaded" : "Missing"
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-07-30.basil",
});

const priceIds = {
  Pro: process.env.STRIPE_PRO_PRICE_ID,
  Enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID,
};

const UNLIMITED = -1;

const planLimits = {
  Free: { clients: 10, users: 2, storage: 100 },
  Pro: { clients: 100, users: 10, storage: 1000 },
  Enterprise: { clients: UNLIMITED, users: UNLIMITED, storage: UNLIMITED },
};

const sanitizeLimits = (limits) => {
  const result = {};
  for (const key in limits) {
    result[key] = limits[key] === UNLIMITED ? "unlimited" : limits[key];
  }
  return result;
};

//  Create Stripe Checkout Session with org metadata
const createCheckoutSessionForOrg = async (orgData, email) => {
  const session = await stripe.checkout.sessions.create({
    customer_email: email,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceIds[orgData.subscriptionPlan], quantity: 1 }],
    success_url: "http://localhost:5000/payment/success",
    cancel_url: "http://localhost:5000/payment/cancel",
    metadata: {
      name: orgData.name,
      address: orgData.address,
      logo: orgData.logo,
      subscriptionPlan: orgData.subscriptionPlan,
    },
  });
  return session.url;
};

//  Manual checkout session (for upgrades)
const checkoutSession = async (req, res) => {
  const { subscriptionPlan } = req.body;

  try {
    const org = await orgModel.findById(req.user.orgId);
    if (!org) {
      return res.status(400).json({ message: "Organization not found" });
    }
    if (org.subscriptionPlan !== "Free") {
      return res
        .status(400)
        .json({ message: "Organization already subscribed" });
    }

    const session = await stripe.checkout.sessions.create({
      customer_email: req.user.email,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceIds[subscriptionPlan], quantity: 1 }],
      success_url: "http://localhost:5000/payment/success",
      cancel_url: "http://localhost:5000/payment/cancel",
      metadata: { orgId: org._id.toString() },
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    console.error("Checkout session error:", error);
    res.status(500).json({ message: error.message });
  }
};

//  Stripe Webhook Handler
const handleWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log("Recieved Stripe Event ", event.type);
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      console.log("Webhook metadata:", session.metadata);

      if (session.metadata.orgId) {
        // Upgrade existing org
        const org = await orgModel.findById(session.metadata.orgId);
        if (org) {
          const priceId =
            session.items?.data?.[0]?.price?.id || session.metadata.priceId;
          const plan = getPlanFromPrice(priceId);
          // const plan = session.amount_total === 1000 ? "Pro" : "Enterprise";
          org.subscriptionPlan = plan;
          org.limits = planLimits[plan];
          await org.save();
        }
      } else {
        // CreatE new org
        const { name, address, logo, subscriptionPlan } =
          session.metadata;

        console.log("Raw plan:", subscriptionPlan);

        const normalizedPlan =
          subscriptionPlan?.charAt(0).toUpperCase() +
          subscriptionPlan?.slice(1).toLowerCase();

        const rawLimits = planLimits[normalizedPlan];
        const limits = sanitizeLimits(rawLimits);

        const newOrg = new orgModel({
          name,
          address,
          logo,
          subscriptionPlan: normalizedPlan,
          limits: rawLimits,
        });

        await newOrg.save();
        console.log("Paid Org Created", newOrg);
      }
    } else if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {

      // Update subsc
      const subscription = event.data.object;
      const org = await orgModel.findOne({
        stripeSubscriptionId: subscription.id,
      });

      if (org) {
        org.subscriptionPlan =
          subscription.status === "active"
            ? getPlanFromPrice(subscription.items.data[0].price.id)
            : "Free";
        org.limits = planLimits[org.subscriptionPlan];
        await org.save();
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(400).json({ message: error.message });
  }
};

//  maping priceid to PLAn
function getPlanFromPrice(priceId) {
  if (!priceId) return "Free"; // fallback if priceId is missing
  const normalizedPriceId = priceId.trim();
  if (normalizedPriceId === priceIds.Pro) return "Pro";
  if (normalizedPriceId === priceIds.Enterprise) return "Enterprise";
  return "Free"; // default fallback
}

export {
  handleWebhook,
  checkoutSession,
  createCheckoutSessionForOrg,
  planLimits,
  sanitizeLimits,
};

