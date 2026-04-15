import { AppShell } from "../../components/layout/AppShell";

export default function ProtectedLayout({ children }) {
  return <AppShell>{children}</AppShell>;
}
