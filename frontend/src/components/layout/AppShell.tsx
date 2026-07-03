import { Outlet } from "react-router-dom";

import { Topbar } from "./Topbar";

export function AppShell() {
  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <Topbar />
      <main className="flex-1 p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
