import { render, screen } from "@testing-library/react";

import App from "./App";

describe("App", () => {
  it("renders the module 1 scaffold shell", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /Alae scaffolded/i })).toBeInTheDocument();
    expect(screen.getByText(/Module 1 is ready/i)).toBeInTheDocument();
    expect(screen.getByText(/Truth Panel Stub/i)).toBeInTheDocument();
  });
});
