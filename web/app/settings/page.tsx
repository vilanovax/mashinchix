import { RequireAuth } from "@/components/auth/require-auth";
import { SettingsView } from "./settings-view";

export default function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsView />
    </RequireAuth>
  );
}
