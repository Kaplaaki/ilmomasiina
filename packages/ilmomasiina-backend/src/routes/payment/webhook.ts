import { FastifyReply, FastifyRequest } from "fastify";
import { BadRequest } from "http-errors";
import Stripe from "stripe";

import config from "../../config";
import { checkoutSessionStatusUpdated, getStripe } from "./index";

/** Handle incoming Stripe webhooks. */
export default async function stripeWebhook(request: FastifyRequest, reply: FastifyReply): Promise<unknown> {
  const stripe = getStripe();

  if (!config.stripeWebhookSecret) {
    throw new BadRequest("Stripe webhooks are not configured");
  }

  // Verify the webhook signature
  const signature = request.headers["stripe-signature"];
  if (!signature) {
    throw new BadRequest("Missing stripe-signature header");
  }

  let event: Stripe.Event;
  try {
    // Stripe requires the raw body for signature verification
    // TODO: This will likely not work as is, but webhooks are not a necessity.
    const { rawBody } = request as unknown as { rawBody?: Buffer };
    if (!rawBody) {
      throw new BadRequest("Raw body not available for webhook signature verification");
    }
    event = stripe.webhooks.constructEvent(rawBody, signature, config.stripeWebhookSecret);
  } catch (err) {
    throw new BadRequest("Webhook signature verification failed");
  }

  switch (event.type) {
    case "checkout.session.completed":
      await checkoutSessionStatusUpdated(event.data.object.id, "complete");
      break;

    case "checkout.session.expired":
      await checkoutSessionStatusUpdated(event.data.object.id, "expired");
      break;

    default:
      // Ignore other event types
      break;
  }

  reply.status(200);
  return { received: true };
}
