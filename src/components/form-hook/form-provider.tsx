import type { PropsWithChildren } from "react";
import { FieldValues, FormProvider as ReactHookFormProvider, UseFormReturn } from "react-hook-form";

// ==============================================================
interface Props<T extends FieldValues> extends PropsWithChildren {
  methods: UseFormReturn<T>;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}
// ==============================================================

export default function FormProvider<T extends FieldValues>({
  children,
  methods,
  onSubmit
}: Props<T>) {
  return (
    <ReactHookFormProvider {...methods}>
      <form onSubmit={onSubmit}>{children}</form>
    </ReactHookFormProvider>
  );
}
