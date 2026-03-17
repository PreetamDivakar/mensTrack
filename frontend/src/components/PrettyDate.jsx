import React from "react";
import { formatDateParts } from "../utils/date";

export default function PrettyDate({ value }) {
  const parts = formatDateParts(value);
  if (!parts) return <span>—</span>;

  return (
    <span>
      {parts.day}
      <sup>{parts.suffix}</sup> {parts.month}
    </span>
  );
}

