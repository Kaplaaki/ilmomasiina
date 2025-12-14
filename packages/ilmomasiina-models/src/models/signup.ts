import type { SignupStatus } from "../enum";
import type { ProductSchema } from "../schema/product";
import type QuotaAttributes from "./quota";

export default interface SignupAttributes {
  id: string;
  firstName: string | null;
  lastName: string | null;
  namePublic: boolean;
  email: string | null;
  language: string | null;
  confirmedAt: Date | null;
  status: SignupStatus | null;
  position: number | null;
  /** Total price of the signup in cents, calculated when it was last updated. */
  price: number | null;
  /** The currency in which the price is denominated. */
  currency: string | null;
  /** The product lines used to calculate the price. */
  products: ProductSchema[] | null;
  createdAt: Date;
  quotaId: QuotaAttributes["id"];
}
