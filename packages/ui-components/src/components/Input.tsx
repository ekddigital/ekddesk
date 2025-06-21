import React, { useState } from "react";
import { InputProps } from "../types";

export const Input: React.FC<InputProps> = ({
  type = "text",
  placeholder,
  value,
  disabled = false,
  error,
  onChange,
  className = "",
  ...props
}) => {
  const [internalValue, setInternalValue] = useState(value || "");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);
    onChange?.(newValue);
  };

  const baseClasses =
    "block w-full px-3 py-2 border rounded-md text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:border-transparent transition-colors";
  const errorClasses = error
    ? "border-red-300 focus:ring-red-500"
    : "border-gray-300 focus:ring-blue-500";

  const classes = [
    baseClasses,
    errorClasses,
    disabled ? "bg-gray-50 cursor-not-allowed" : "bg-white",
    className,
  ].join(" ");

  return (
    <div className="space-y-1">
      <input
        type={type}
        value={value !== undefined ? value : internalValue}
        placeholder={placeholder}
        disabled={disabled}
        onChange={handleChange}
        className={classes}
        {...props}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
};
