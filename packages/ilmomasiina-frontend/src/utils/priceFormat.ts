import { useMemo } from "react";

import { useTranslation } from "react-i18next";

// eslint-disable-next-line import/prefer-default-export
export function usePriceFormatter() {
  const { t } = useTranslation();

  return useMemo(() => {
    const formatter = new Intl.NumberFormat(t("currencyFormat.locale"), {
      style: "currency",
      currency: CURRENCY,
      // minimumFractionDigits: 0 produces abominations like "$39.1", we prefer either two or zero decimals
      trailingZeroDisplay: "stripIfInteger",
    });
    return (value: number) => formatter.format(value / 100);
  }, [t]);
}
