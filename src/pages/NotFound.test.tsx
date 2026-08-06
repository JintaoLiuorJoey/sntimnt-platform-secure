import {
  render,
  screen,
} from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
} from "react-router";
import {
  describe,
  expect,
  it,
  vi,
} from "vitest";
import NotFound from "./NotFound";

describe("NotFound", () => {
  it("does not log the unmatched path", () => {
    const consoleError =
      vi.spyOn(
        console,
        "error",
      ).mockImplementation(
        () => undefined,
      );

    try {
      render(
        <MemoryRouter
          initialEntries={[
            "/account/recovery-secret?token=private#details",
          ]}
        >
          <Routes>
            <Route
              path="*"
              element={<NotFound />}
            />
          </Routes>
        </MemoryRouter>,
      );

      expect(
        screen.getByRole(
          "heading",
          {
            name: "404",
          },
        ),
      ).toBeInTheDocument();

      expect(
        consoleError,
      ).not.toHaveBeenCalled();
    }
    finally {
      consoleError.mockRestore();
    }
  });
});
