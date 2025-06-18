import { ReactNode } from "react";

export interface UITheme {
  colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
  };
}

export interface ComponentProps {
  className?: string;
  children?: ReactNode;
}

export interface ButtonProps extends ComponentProps {
  variant?: "primary" | "secondary" | "outline" | "text";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
}

export interface InputProps extends ComponentProps {
  type?: "text" | "password" | "email" | "number";
  placeholder?: string;
  value?: string;
  disabled?: boolean;
  error?: string;
  onChange?: (value: string) => void;
}

export interface ModalProps extends ComponentProps {
  isOpen: boolean;
  title?: string;
  onClose: () => void;
}

export interface ConnectionStatusProps extends ComponentProps {
  status: "connected" | "connecting" | "disconnected" | "error";
  latency?: number;
  bandwidth?: {
    upload: number;
    download: number;
  };
}
