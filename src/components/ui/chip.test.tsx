import { render, screen } from "@testing-library/react-native";

import { Chip } from "./chip";

describe("Chip", () => {
  test("keeps a counted label on one line", async () => {
    await render(<Chip label="Needs review 3" />);

    const label = screen.getByText("Needs review 3");
    expect(label.props).toMatchObject({
      adjustsFontSizeToFit: true,
      minimumFontScale: 0.85,
      numberOfLines: 1,
    });
  });
});
