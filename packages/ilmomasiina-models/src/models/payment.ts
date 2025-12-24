import type { PaymentStatus } from "../enum";

export default interface PaymentAttributes {
  id: number;
  signupId: string;
  stripeCheckoutSessionId: string | null;
  status: PaymentStatus;
  amount: number;
  currency: string;
  products: unknown; // TODO
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  completedAt: Date | null;
}
