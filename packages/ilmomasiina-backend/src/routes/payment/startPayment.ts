import { FastifyReply, FastifyRequest } from "fastify";
import moment from "moment";
import { UniqueConstraintError } from "sequelize";
import Stripe from "stripe";

import { PaymentMode, PaymentStatus, SignupPathParams, StartPaymentResponse } from "@tietokilta/ilmomasiina-models";
import config from "../../config";
import { Event } from "../../models/event";
import { Payment } from "../../models/payment";
import { Quota } from "../../models/quota";
import { Signup } from "../../models/signup";
import { NoSuchSignup } from "../signups/errors";
import {
  OnlinePaymentsDisabled,
  PaymentCreationInProgress,
  PaymentNotRequired,
  SignupAlreadyPaid,
  SignupNotConfirmed,
} from "./errors";
import { createCheckoutSession, getStripe, refreshCheckoutSession } from "./index";

/** Create a new payment and Stripe checkout session. */
async function createPayment(signup: Signup): Promise<string> {
  const expiresAt = moment().add(config.stripeCheckoutExpiryMins, "minutes");
  // Stripe requires at least 30 minutes expiry; add some buffer for making the request.
  if (config.stripeCheckoutExpiryMins === 30) expiresAt.add(30, "seconds");

  // Create payment record in CREATING state.
  let payment: Payment;
  try {
    payment = await Payment.create({
      signupId: signup.id,
      amount: signup.price!,
      currency: signup.currency!,
      products: signup.products!,
      expiresAt: expiresAt.toDate(),
    });
  } catch (error) {
    // Unique constraint violation means another request already created a payment.
    if (error instanceof UniqueConstraintError) {
      throw new PaymentCreationInProgress("Payment creation already in progress");
    }
    throw error;
  }

  // Create checkout session in Stripe.
  let session: Stripe.Checkout.Session;
  try {
    session = await createCheckoutSession(signup, payment);
  } catch (error) {
    // Mark as failed - user can retry by starting a new payment
    await Payment.update({ status: PaymentStatus.CREATION_FAILED }, { where: { id: payment.id } });
    throw error;
  }

  // Transition to PENDING.
  // This can theoretically fail in the DB triggers if createCheckoutSession took long enough that the payment was
  // marked CREATION_FAILED.
  await Payment.update(
    { status: PaymentStatus.PENDING, stripeCheckoutSessionId: session.id },
    { where: { id: payment.id } },
  );

  return session.url!;
}

/**
 * Handle an existing payment in PENDING state.
 * Checks the Stripe session status and either returns the URL (pending) or marks the payment as paid/expired.
 * If expired, creates a new payment.
 */
async function handlePendingPayment(signup: Signup, payment: Payment): Promise<string> {
  const session = await refreshCheckoutSession(payment);

  switch (session.status!) {
    case "complete":
      throw new SignupAlreadyPaid("This signup has already been paid");
    case "expired":
      // Try to create a new payment. Throws 409 in case requests race.
      return createPayment(signup);
    case "open":
      // Session still valid, return its URL
      return session.url!;
    case null:
      throw new Error("Stripe session has null status");
    default:
      throw new Error(`Unhandled Stripe session status: ${session.status! satisfies never}`);
  }
}

/** Get or create a payment for the signup. Returns payment URL. */
async function getOrCreatePayment(signupId: string): Promise<string> {
  // Load the signup with its active payment and event
  const signup = await Signup.scope("active").findByPk(signupId, {
    include: [
      {
        model: Payment.scope("active"),
        as: "activePayment",
        required: false,
      },
      {
        model: Quota,
        attributes: [],
        include: [
          {
            model: Event,
            attributes: ["payments"],
          },
        ],
      },
    ],
  });
  if (!signup) {
    throw new NoSuchSignup("No signup found with given id");
  }

  // Validate signup state
  if (!signup.confirmedAt) {
    throw new SignupNotConfirmed("Signup must be confirmed before payment");
  }
  if (!signup.hasPrice) {
    throw new PaymentNotRequired("This signup does not require payment");
  }
  if (signup.quota!.event!.payments !== PaymentMode.ONLINE) {
    throw new OnlinePaymentsDisabled("Online payments are not enabled for this event");
  }

  if (!signup.activePayment) {
    // No active payment - create a new one. Throws 409 in case requests race.
    return createPayment(signup);
  }

  const payment = signup.activePayment;
  switch (payment.status) {
    case PaymentStatus.PAID:
      throw new SignupAlreadyPaid("This signup has already been paid");

    case PaymentStatus.PENDING:
      return handlePendingPayment(signup, payment);

    case PaymentStatus.CREATING:
      // Another request is creating this payment - race condition.
      // TODO: We could retry here with an idempotency key if the payment is new enough.
      throw new PaymentCreationInProgress("Payment creation already in progress");

    case PaymentStatus.CREATION_FAILED:
    case PaymentStatus.EXPIRED:
    case PaymentStatus.REFUNDED:
      // These should not be returned by the "active" scope, but handle defensively
      throw new Error(`Invalid active payment status: ${payment.status}`);
    default:
      throw new Error(`Unknown payment status: ${payment.status satisfies never}`);
  }
}

/** Requires editTokenVerification */
export default async function startPayment(
  request: FastifyRequest<{ Params: SignupPathParams }>,
  reply: FastifyReply,
): Promise<StartPaymentResponse> {
  // Fail fast if payments are globally disabled.
  getStripe();
  const paymentUrl = await getOrCreatePayment(request.params.id);
  reply.status(200);
  return { paymentUrl };
}
