import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

afterEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

function renderToggle() {
  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

describe("Dark mode", () => {
  it("defaults to light (system + matchMedia=false) and offers to enable dark", () => {
    renderToggle();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(screen.getByRole("button", { name: "Ativar tema escuro" })).toBeInTheDocument();
  });

  it("toggles dark on and off and persists the choice", async () => {
    const user = userEvent.setup();
    renderToggle();
    await user.click(screen.getByRole("button", { name: "Ativar tema escuro" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("driverops-theme")).toBe("dark");

    await user.click(screen.getByRole("button", { name: "Ativar tema claro" }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("driverops-theme")).toBe("light");
  });

  it("applies a persisted dark choice on mount", () => {
    localStorage.setItem("driverops-theme", "dark");
    renderToggle();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(screen.getByRole("button", { name: "Ativar tema claro" })).toBeInTheDocument();
  });
});
