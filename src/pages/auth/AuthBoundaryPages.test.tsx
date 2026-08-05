import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import Forbidden from "@/pages/auth/Forbidden";
import Unauthorized from "@/pages/auth/Unauthorized";

function renderBoundary(
  pathname: "/unauthorized" | "/forbidden",
  state?: Record<string, unknown>,
) {
  return render(
    <MemoryRouter initialEntries={[{ pathname, state }]}>
      <Routes>
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="/forbidden" element={<Forbidden />} />
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/dashboard" element={<div>Dashboard page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("authorization boundary pages", () => {
  it("preserves a safe internal return location in the sign-in link", () => {
    renderBoundary("/unauthorized", {
      from: "/signals?filter=open#latest",
      reason: "authentication-required",
    });

    expect(
      screen.getByRole("link", {
        name: /continue to sign in/i,
      }),
    ).toHaveAttribute(
      "href",
      "/login?returnTo=%2Fsignals%3Ffilter%3Dopen%23latest",
    );
  });

  it("rejects an external protocol-relative return location", () => {
    renderBoundary("/unauthorized", {
      from: "//evil.example.invalid/steal",
    });

    expect(
      screen.getByRole("link", {
        name: /continue to sign in/i,
      }),
    ).toHaveAttribute(
      "href",
      "/login?returnTo=%2Fdashboard",
    );
  });

  it("rejects an authentication-boundary return loop", () => {
    renderBoundary("/unauthorized", {
      from: "/unauthorized",
    });

    expect(
      screen.getByRole("link", {
        name: /continue to sign in/i,
      }),
    ).toHaveAttribute(
      "href",
      "/login?returnTo=%2Fdashboard",
    );
  });

  it("shows fail-closed copy when session verification failed", () => {
    renderBoundary("/unauthorized", {
      from: "/profile",
      reason: "session-error",
    });

    expect(
      screen.getByRole("heading", {
        name: /we could not verify your session/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /for your protection, access was denied/i,
      ),
    ).toBeInTheDocument();
  });

  it("keeps the 403 page separate from the unauthenticated sign-in flow", () => {
    renderBoundary("/forbidden", {
      from: "/admin",
    });

    expect(
      screen.getByRole("heading", {
        name: /access denied/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /signed in, but it does not have permission/i,
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: /return to dashboard/i,
      }),
    ).toHaveAttribute(
      "href",
      "/dashboard",
    );

    expect(
      screen.queryByRole("link", {
        name: /continue to sign in/i,
      }),
    ).not.toBeInTheDocument();
  });
});
