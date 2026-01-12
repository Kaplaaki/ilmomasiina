import moment from "moment";
import Stripe from "stripe";

import { PaymentStatus } from "@tietokilta/ilmomasiina-models";
import config, { editSignupUrl } from "../../config";
import { Payment } from "../../models/payment";
import { Signup } from "../../models/signup";
import { generateToken } from "../signups/editTokens";
import { OnlinePaymentsDisabled } from "./errors";

/** Pre-initialized Stripe client, or null if not configured. */
const stripeClient: Stripe | null = config.stripeSecretKey
  ? new Stripe(config.stripeSecretKey, {
      apiVersion: "2025-12-15.clover",
      typescript: true,
    })
  : null;

/** Get the Stripe client. Throws if not configured. */
export function getStripe(): Stripe {
  if (!stripeClient) {
    throw new OnlinePaymentsDisabled("Online payments are not enabled on this server");
  }
  return stripeClient;
}

/** Create a Stripe Checkout Session for a Payment. */
export async function createCheckoutSession(signup: Signup, payment: Payment): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();

  const language = signup.language ?? config.defaultLanguage;
  const editToken = generateToken(signup.id);
  const returnUrl = editSignupUrl({ id: signup.id, editToken, lang: language });

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = payment.products.map((product) => ({
    price_data: {
      currency: payment.currency.toLowerCase(),
      product_data: {
        name: product.name,
      },
      unit_amount: product.unitPrice,
    },
    quantity: product.amount,
  }));

  return stripe.checkout.sessions.create({
    mode: "payment",
    ui_mode: "hosted",
    line_items: lineItems,
    customer_email: signup.email ?? undefined,
    success_url: returnUrl,
    cancel_url: returnUrl,
    expires_at: moment(payment.expiresAt).unix(),
    metadata: {
      signupId: signup.id,
      paymentId: String(payment.id),
    },
  });
}

/** Updates the Payment for a given Stripe Checkout Session ID and status and performs side effects. */
export async function checkoutSessionStatusUpdated(
  sessionId: Stripe.Checkout.Session["id"],
  status: Stripe.Checkout.Session.Status | null,
): Promise<void> {
  switch (status) {
    case "complete": {
      // Payment completed but we haven't processed the webhook yet.
      // Use WHERE to ensure we only perform side effects once.
      const [changed] = await Payment.update(
        { status: PaymentStatus.PAID, completedAt: new Date() },
        { where: { stripeCheckoutSessionId: sessionId, status: PaymentStatus.PENDING } },
      );
      if (changed) {
        // TODO: Send email receipt, etc.
      }
      break;
    }

    case "expired": {
      // Payment expired but we haven't processed the webhook yet.
      // Use WHERE to ensure we only perform side effects once.
      const [changed] = await Payment.update(
        { status: PaymentStatus.EXPIRED },
        { where: { stripeCheckoutSessionId: sessionId, status: PaymentStatus.PENDING } },
      );
      if (changed) {
        // TODO: Expire signup, etc.
      }
      break;
    }

    case "open":
      // Payment open, keep as is.
      break;

    case null:
      throw new Error("Stripe session has null status");
    default:
      throw new Error(`Unhandled Stripe session status: ${status satisfies never}`);
  }
}

/**
 * Refresh the status of an existing payment in PENDING state.
 * Checks the Stripe session status marks the payment as paid/expired as applicable.
 */
export async function refreshCheckoutSession(payment: Payment): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(payment.stripeCheckoutSessionId!);
  await checkoutSessionStatusUpdated(session.id, session.status);
  return session;
}
