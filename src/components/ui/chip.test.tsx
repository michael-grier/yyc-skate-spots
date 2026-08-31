import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { Chip } from "./chip";

describe("Chip", () => {
  test("constrains and fits a long counted label on one line", async () => {
    await render(<Chip label="Needs review 1234567890" />);

    const button = screen.getByRole("button");
    const label = screen.getByText("Needs review 1234567890");
    expect(StyleSheet.flatten(button.props.style)).toMatchObject({ maxWidth: "100%" });
    expect(StyleSheet.flatten(label.props.style)).toMatchObject({ flexShrink: 1 });
    expect(label.props).toMatchObject({
      adjustsFontSizeToFit: true,
      minimumFontScale: 0.85,
      numberOfLines: 1,
    });
  });
});
