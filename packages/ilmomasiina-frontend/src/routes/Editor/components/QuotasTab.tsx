import React from "react";

import { Form } from "react-bootstrap";
import { UseFieldConfig } from "react-final-form";
import { useTranslation } from "react-i18next";

import { PaymentMode } from "@tietokilta/ilmomasiina-models";
import FieldRow from "../../../components/FieldRow";
import { EditorEventType } from "../../../modules/editor/types";
import useEditorErrors from "./errors";
import { useFieldValue } from "./hooks";
import LanguageSelect from "./LanguageSelect";
import Quotas from "./Quotas";
import SelectBox from "./SelectBox";

const numberConfig: UseFieldConfig<number | null> = {
  parse: (value) => (value ? Number(value) : null),
};

const QuotasTab = () => {
  const useOpenQuota = useFieldValue<boolean>("useOpenQuota");
  const eventType = useFieldValue<EditorEventType>("eventType");
  const { t } = useTranslation();
  const formatError = useEditorErrors();
  return (
    <div>
      <LanguageSelect />
      {eventType !== EditorEventType.ONLY_EVENT && (
        <FieldRow
          name="payments"
          label={t("editor.basic.payments")}
          as={SelectBox}
          options={[
            [PaymentMode.DISABLED, t("editor.basic.payments.disabled")],
            [PaymentMode.MANUAL, t("editor.basic.payments.manual")],
            [PaymentMode.ONLINE, t("editor.basic.payments.online")],
          ]}
          formatError={formatError}
        />
      )}
      <Quotas />
      <FieldRow
        name="useOpenQuota"
        label={t("editor.quotas.openQuota")}
        as={Form.Check}
        type="checkbox"
        checkAlign
        checkLabel={t("editor.quotas.openQuota.check")}
        help={t("editor.quotas.openQuota.info")}
        formatError={formatError}
      />
      {useOpenQuota && (
        <FieldRow
          name="openQuotaSize"
          label={t("editor.quotas.openQuotaSize")}
          type="number"
          config={numberConfig}
          min="0"
          placeholder="0" // if this is left empty, it's set to null and disabled
          required
          formatError={formatError}
        />
      )}
    </div>
  );
};

export default QuotasTab;
