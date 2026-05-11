"use client";

import { useState, useEffect } from "react";

export function useMonthFilter() {
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  useEffect(() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    setSelectedMonth(`${year}-${month}`);
  }, []);

  return { selectedMonth, setSelectedMonth };
}

export const MONTHS = [
  { value: "2026-01", label: "Janeiro/2026" },
  { value: "2026-02", label: "Fevereiro/2026" },
  { value: "2026-03", label: "Março/2026" },
  { value: "2026-04", label: "Abril/2026" },
  { value: "2026-05", label: "Maio/2026" },
  { value: "2026-06", label: "Junho/2026" },
  { value: "2026-07", label: "Julho/2026" },
  { value: "2026-08", label: "Agosto/2026" },
  { value: "2026-09", label: "Setembro/2026" },
  { value: "2026-10", label: "Outubro/2026" },
  { value: "2026-11", label: "Novembro/2026" },
  { value: "2026-12", label: "Dezembro/2026" },
];