import { useTranslation } from "react-i18next";
import { defaultMemoize } from "reselect";

const formatFactory = defaultMemoize(
  (locale: string, currency: string) => {
    const formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      // minimumFractionDigits: 0 produces abominations like "$39.1", we prefer either two or zero decimals
      trailingZeroDisplay: "stripIfInteger",
    });
    return (value: number) => formatter.format(value / 100);
  },
  { maxSize: 16 },
);

// eslint-disable-next-line import/prefer-default-export
export function usePriceFormatter(currency = CURRENCY) {
  const { t } = useTranslation();
  const locale = t("currencyFormat.locale");

  return formatFactory(locale, currency);
}
