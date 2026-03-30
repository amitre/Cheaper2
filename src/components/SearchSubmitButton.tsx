"use client";
import { useFormStatus } from "react-dom";

interface Props {
  label?: string;
  loadingLabel?: string;
  className?: string;
}

export default function SearchSubmitButton({
  label = "Compare",
  loadingLabel = "מחפש...",
  className = "px-5 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors whitespace-nowrap",
}: Props) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${className} flex items-center gap-2 disabled:opacity-80`}
    >
      {pending && (
        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
      )}
      {pending ? loadingLabel : label}
    </button>
  );
}
