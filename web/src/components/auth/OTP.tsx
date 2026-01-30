import React, { useRef, useState } from "react";

interface OTPInputProps {
  value: string[];
  setValue: (v: string[]) => void;
}

export default function OTPInput({ value, setValue }: OTPInputProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const [selections, setSelections] = useState(
    Array(value.length).fill({ start: 0, end: 0 })
  );

  /* ---------- helpers ---------- */
  const focusInput = (index: number) => inputs.current[index]?.focus();

  const replaceOtp = (newArr: string[]) => setValue(newArr);

  /* ---------- onChange ---------- */
  const handleChange = (text: string, index: number) => {
    const digits = text.replace(/[^0-9]/g, "");

    if (digits.length === 1) {
      const newOtp = [...value];
      newOtp[index] = digits;
      setValue(newOtp);

      if (index < value.length - 1) {
        focusInput(index + 1);
      }
    } else if (digits.length > 1) {
      const newOtp = [...value];
      digits.split("").forEach((d, i) => {
        const pos = index + i;
        if (pos < newOtp.length) newOtp[pos] = d;
      });
      setValue(newOtp);

      const lastFilled = index + digits.length - 1;
      if (lastFilled < value.length - 1) {
        focusInput(lastFilled + 1);
      }
    }
  };

  /* ---------- onKeyDown (Backspace / Delete) ---------- */
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
    const key = e.key;

    if (key === "Backspace" || key === "Delete") {
      if (!value[index] && index > 0) {
        const newOtp = [...value];
        newOtp[index - 1] = "";
        replaceOtp(newOtp);
        focusInput(index - 1);
      } else {
        const newOtp = [...value];
        newOtp[index] = "";
        replaceOtp(newOtp);
      }
    }
  };

  /* ---------- Focus (select all) ---------- */
  const handleFocus = (index: number) => {
    const next = [...selections];
    next[index] = { start: 0, end: 1 };
    setSelections(next);
  };

  return (
    <div className="flex justify-between mb-6">
      {value.map((digit, i) => (
        <input
          key={i}
          ref={(r) => {inputs.current[i] = r}}
          className="w-[13%] border border-gray-300 rounded-lg text-center text-2xl py-3 px-2"
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={digit}
          onChange={(e) => handleChange(e.target.value, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onFocus={() => handleFocus(i)}
          autoComplete="one-time-code"
        />
      ))}
    </div>
  );
}