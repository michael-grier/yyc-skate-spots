import { fireEvent, render, screen } from "@testing-library/react-native";

import { ModerationReasonPicker } from "./moderation-reason-picker";

describe("ModerationReasonPicker", () => {
  test("renders every policy reason and reports the selected value", async () => {
    const onChange = jest.fn();
    await render(<ModerationReasonPicker value={null} onChange={onChange} />);

    expect(screen.getAllByRole("radio")).toHaveLength(7);
    await fireEvent.press(screen.getByText("Duplicate or inaccurate"));
    expect(onChange).toHaveBeenCalledWith("duplicate_or_inaccurate");
  });

  test("exposes the selected reason to assistive technology", async () => {
    await render(<ModerationReasonPicker value="not_a_spot" onChange={jest.fn()} />);

    expect(screen.getAllByRole("radio")[0].props.accessibilityState).toEqual({ checked: true });
  });
});
