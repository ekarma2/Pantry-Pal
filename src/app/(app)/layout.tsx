import { AuthGate } from "@/components/auth-gate";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AuthGate>{children}</AuthGate>;
}
