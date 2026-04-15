import clsx from "clsx";

export function Card({ children, className }) {
  return (
    <div className={clsx("rounded-xl border border-gray-200 bg-white shadow-sm", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
      <div className="text-base font-semibold text-gray-900">{title}</div>
      {action}
    </div>
  );
}

export function CardBody({ children, className }) {
  return <div className={clsx("p-5", className)}>{children}</div>;
}
