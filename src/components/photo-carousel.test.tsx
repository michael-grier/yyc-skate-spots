import { fireEvent, render, screen } from "@testing-library/react-native";

import { PhotoCarousel } from "@/components/photo-carousel";

const mockPhotoViewer = jest.fn((_props: object) => null);

jest.mock("@/components/photo-viewer", () => ({
  PhotoViewer: (props: object) => mockPhotoViewer(props),
}));

beforeEach(() => {
  mockPhotoViewer.mockClear();
});

describe("PhotoCarousel gallery", () => {
  test("opens the selected photo in the full-screen viewer", async () => {
    await render(
      <PhotoCarousel
        urls={["https://example.com/one.jpg", "https://example.com/two.jpg"]}
        spotName="Chinatown 12 Stair"
        variant="gallery"
      />,
    );

    await fireEvent.press(
      screen.getByRole("button", { name: "Open Chinatown 12 Stair, photo 2 of 2" }),
    );

    expect(mockPhotoViewer).toHaveBeenLastCalledWith(
      expect.objectContaining({
        index: 1,
        spotName: "Chinatown 12 Stair",
        visible: true,
      }),
    );
  });

  test("keeps the compact admin carousel non-interactive", async () => {
    await render(
      <PhotoCarousel urls={["https://example.com/one.jpg"]} spotName="Chinatown 12 Stair" />,
    );

    expect(screen.queryByRole("button")).toBeNull();
    expect(mockPhotoViewer).not.toHaveBeenCalled();
  });
});
