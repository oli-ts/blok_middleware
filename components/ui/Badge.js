import clsx from "clsx";

const colorMap = {
  default: "border-gray-200 bg-gray-100 text-gray-800",
  success: "border-green-200 bg-green-100 text-green-800",
  warning: "border-yellow-200 bg-yellow-100 text-yellow-800",
  danger: "border-red-200 bg-red-100 text-red-800",
  info: "border-blue-200 bg-blue-100 text-blue-800",
  high: "border-green-200 bg-green-100 text-green-800",
  medium: "border-yellow-200 bg-yellow-100 text-yellow-800",
  low: "border-gray-200 bg-gray-100 text-gray-800",
  purple: "border-purple-200 bg-purple-100 text-purple-800",
  indigo: "border-indigo-200 bg-indigo-100 text-indigo-800",
};

export function Badge({ children, tone = "default", className }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        colorMap[tone] || colorMap.default,
        className
      )}
    >
      {children}
    </span>
  );
}
