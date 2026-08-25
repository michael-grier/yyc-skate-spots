import { fireEvent, render, screen } from "@testing-library/react-native";

import { FavoriteButton } from "./favorite-button";

describe("FavoriteButton", () => {
  test("announces and reports an unsaved spot", async () => {
    const onPress = jest.fn();
    await render(<FavoriteButton isFavorite={false} onPress={onPress} />);

    const button = screen.getByRole("button", { name: "Add to favourites" });
    expect(button.props.accessibilityState).toMatchObject({ selected: false, disabled: false });
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test("announces a saved spot and blocks repeat presses while busy", async () => {
    const onPress = jest.fn();
    await render(<FavoriteButton isFavorite busy onPress={onPress} />);

    const button = screen.getByRole("button", { name: "Remove from favourites" });
    expect(button.props.accessibilityState).toMatchObject({ selected: true, disabled: true });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
