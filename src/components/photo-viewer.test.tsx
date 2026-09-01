import { fireEvent, render, screen } from "@testing-library/react-native";

import { PhotoViewer } from "@/components/photo-viewer";

const urls = ["https://example.com/one.jpg", "https://example.com/two.jpg"];

async function renderViewer(props: Partial<Parameters<typeof PhotoViewer>[0]> = {}) {
  const onIndexChange = jest.fn();
  const onClose = jest.fn();
  const view = await render(
    <PhotoViewer
      urls={urls}
      spotName="Chinatown 12 Stair"
      index={0}
      visible
      onIndexChange={onIndexChange}
      onClose={onClose}
      {...props}
    />,
  );
  return { ...view, onIndexChange, onClose };
}

describe("PhotoViewer", () => {
  test("clamps an index that outlived the photo it pointed at", async () => {
    await renderViewer({ index: 5 });

    expect(screen.getByText("2 of 2")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next photo" })).toBeNull();
  });

  test("pages with the arrow controls", async () => {
    const { onIndexChange } = await renderViewer();

    expect(screen.queryByRole("button", { name: "Previous photo" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Next photo" }));

    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  test("renders nothing while closed", async () => {
    await renderViewer({ visible: false });

    expect(screen.queryByText("1 of 2")).toBeNull();
  });
});
