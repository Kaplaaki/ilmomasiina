import type { SignupForEditResponse, SignupUpdateResponse } from "@tietokilta/ilmomasiina-models";
import { ApiError } from "../../api";
import { createStateContext } from "../../utils/stateContext";

export type State = Partial<SignupForEditResponse> & {
  localizedEvent?: SignupForEditResponse["event"];
  localizedSignup?: SignupForEditResponse["signup"];
  /** If true, the signup has not been confirmed. Will be updated by `updateSignup`. */
  isNew?: boolean;
  pending: boolean;
  error?: ApiError;
  /** The error related to payment completion, if any. */
  paymentError?: ApiError;
  editToken: string;
  editingClosedOnLoad?: boolean;
  confirmableUntil?: number;
  editableUntil?: number;
  preview?: { setPreviewingForm: (form: boolean) => void };
  updateSignup?: (response: SignupUpdateResponse) => void;
};

export const { Provider, useStateContext, createThunk } = createStateContext<State>();
