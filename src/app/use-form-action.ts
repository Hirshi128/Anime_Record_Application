"use client";

import { useActionState } from "react";
import { initialFormState, type FormAction } from "@/lib/form-state";

export function useFormAction(action: FormAction) {
  return useActionState(async (previous: { message: string; revision: number }, data: FormData) => {
    const result = await action(previous, data);
    return { ...result, revision: previous.revision + 1 };
  }, { ...initialFormState, revision: 0 });
}
