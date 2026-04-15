import clsx from "clsx";

export function Button({ variant = "primary", size = "md", className, ...props }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500";
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800",
    secondary: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100",
    ghost: "bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200",
    danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-2.5 text-base",
  };
  return (
    <button
      className={clsx(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}
