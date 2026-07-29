import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import Login from "@/pages/Login";

describe("Login", () => {
  it("does not collect or validate a password in the React application", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue to secure sign in/i })).toBeInTheDocument();
  });

  it("does not manufacture a local session in demo mode", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /continue to secure sign in/i }));

    expect(
      screen.getByText(/secure authentication is not connected in demo mode/i),
    ).toBeInTheDocument();
  });

  it("shows a generic authentication failure message", () => {
    render(
      <MemoryRouter initialEntries={["/login?reason=authentication-failed"]}>
        <Login />
      </MemoryRouter>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "We could not complete sign-in. Please try again.",
    );
  });
});
