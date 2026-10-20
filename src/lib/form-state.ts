export type FormState = { message: string };
export type FormAction = (
  state: FormState,
  formData: FormData,
) => Promise<FormState>;
export const initialFormState: FormState = { message: "" };
