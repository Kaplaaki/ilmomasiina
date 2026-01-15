import Stripe from "stripe";
import z, { ZodType } from "zod";

/** Validation schema for Stripe branding settings.
 *
 * It's a bit extreme to validate this with Zod, but it ensures payments shouldn't fail due to
 * invalid config.
 */
// eslint-disable-next-line import/prefer-default-export
export const stripeBrandingSchema: ZodType<Stripe.Checkout.SessionCreateParams.BrandingSettings> = z.strictObject({
  background_color: z.string().optional(),
  border_style: z.enum(["pill", "rectangular", "rounded"]).optional(),
  button_color: z.string().optional(),
  display_name: z.string().optional(),
  font_family: z
    .enum([
      "default",
      "be_vietnam_pro",
      "bitter",
      "chakra_petch",
      "hahmlet",
      "inconsolata",
      "inter",
      "lato",
      "lora",
      "m_plus_1_code",
      "montserrat",
      "noto_sans",
      "noto_sans_jp",
      "noto_serif",
      "nunito",
      "open_sans",
      "pridi",
      "pt_sans",
      "pt_serif",
      "raleway",
      "roboto",
      "roboto_slab",
      "source_sans_pro",
      "titillium_web",
      "ubuntu_mono",
      "zen_maru_gothic",
    ])
    .optional(),
  icon: z
    .union([
      z.strictObject({ type: z.literal("file"), file: z.string() }),
      z.strictObject({ type: z.literal("url"), url: z.string() }),
    ])
    .optional(),
  logo: z
    .union([
      z.strictObject({ type: z.literal("file"), file: z.string() }),
      z.strictObject({ type: z.literal("url"), url: z.string() }),
    ])
    .optional(),
});
