import { render, screen } from "@testing-library/react";

import App from "./App";

describe("App", () => {
  it("renders the module 4 secure shell", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /Alae now secures provider access/i })).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { level: 2, name: "Provider Access" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Truth Panel Stub/i)).toBeInTheDocument();
  });
});
