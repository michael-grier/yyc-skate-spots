import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { ComponentProps } from "react";

import {
  ACTIVE_DOT_COLOR,
  INACTIVE_DOT_COLOR,
  PhotoCarousel,
} from "@/components/photo-carousel";
import type { PhotoViewer } from "@/components/photo-viewer";

type PhotoViewerProps = ComponentProps<typeof PhotoViewer>;

const mockPhotoViewer = jest.fn((_props: PhotoViewerProps) => null);

jest.mock("@/components/photo-viewer", () => ({
  PhotoViewer: (props: PhotoViewerProps) => mockPhotoViewer(props),
}));

beforeEach(() => {
  mockPhotoViewer.mockClear();
});

/** The props of the most recent viewer render, so tests can drive its callbacks. */
function lastViewerProps() {
  const props = mockPhotoViewer.mock.lastCall?.[0];
  if (!props) throw new Error("PhotoViewer has not rendered");
  return props;
}

describe("PhotoCarousel gallery", () => {
  test("opens the selected photo in the full-screen viewer", async () => {
    await render(
      <PhotoCarousel
        urls={["https://example.com/one.jpg", "https://example.com/two.jpg"]}
        spotName="Chinatown 12 Stair"
        variant="gallery"
      />,
    );

    expect(mockPhotoViewer).toHaveBeenLastCalledWith(
      expect.objectContaining({ visible: false }),
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

  test("follows the viewer's paging so closing it lands on the photo last looked at", async () => {
    await render(
      <PhotoCarousel
        urls={[
          "https://example.com/one.jpg",
          "https://example.com/two.jpg",
          "https://example.com/three.jpg",
        ]}
        spotName="Chinatown 12 Stair"
        variant="gallery"
      />,
    );

    await fireEvent.press(
      screen.getByRole("button", { name: "Open Chinatown 12 Stair, photo 1 of 3" }),
    );
    await act(() => lastViewerProps().onIndexChange(2));

    expect(mockPhotoViewer).toHaveBeenLastCalledWith(
      expect.objectContaining({ index: 2, visible: true }),
    );

    await act(() => lastViewerProps().onClose());

    expect(mockPhotoViewer).toHaveBeenLastCalledWith(
      expect.objectContaining({ visible: false }),
    );
    expect(screen.getByTestId("photo-dot-2")).toHaveStyle({
      backgroundColor: ACTIVE_DOT_COLOR,
    });
    expect(screen.getByTestId("photo-dot-0")).toHaveStyle({
      backgroundColor: INACTIVE_DOT_COLOR,
    });
  });

  test("closes the viewer when its photo is deleted, and stays closed on a refill", async () => {
    const gallery = (urls: string[]) => (
      <PhotoCarousel urls={urls} spotName="Chinatown 12 Stair" variant="gallery" />
    );
    const { rerender } = await render(
      gallery(["https://example.com/one.jpg", "https://example.com/two.jpg"]),
    );

    await fireEvent.press(
      screen.getByRole("button", { name: "Open Chinatown 12 Stair, photo 2 of 2" }),
    );
    expect(mockPhotoViewer).toHaveBeenLastCalledWith(
      expect.objectContaining({ visible: true }),
    );

    await rerender(gallery(["https://example.com/one.jpg"]));

    expect(mockPhotoViewer).toHaveBeenLastCalledWith(
      expect.objectContaining({ visible: false }),
    );

    // A photo added later must not reopen a viewer the user never asked for.
    await rerender(gallery(["https://example.com/one.jpg", "https://example.com/three.jpg"]));

    expect(mockPhotoViewer).toHaveBeenLastCalledWith(
      expect.objectContaining({ visible: false }),
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
