import { fireEvent, render, screen } from "@testing-library/react-native";
import { Alert, StyleSheet } from "react-native";

import { EMPTY_SPOT_FORM, type FormPhoto, type SpotFormValues } from "@/lib/spot-form";

import { SpotEditForm } from "./spot-edit-form";

const mockDiscardUpload = jest.fn();
const mockPickPhotos = jest.fn();
const mockUploadPhoto = jest.fn();

jest.mock("@clerk/expo", () => ({
  useAuth: () => ({ getToken: jest.fn().mockResolvedValue("token") }),
}));
jest.mock("convex/react", () => ({ useMutation: () => mockDiscardUpload }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/lib/spot-photos", () => ({
  pickPhotos: (...args: unknown[]) => mockPickPhotos(...args),
  uploadPhoto: (...args: unknown[]) => mockUploadPhoto(...args),
}));
jest.mock("expo-image", () => {
  const { Image } = jest.requireActual<typeof import("react-native")>("react-native");
  return { Image };
});
// The standards sheet is reachable from the footer but is not what these tests exercise.
jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetModal: () => null,
  BottomSheetView: () => null,
  BottomSheetBackdrop: () => null,
}));
// The picker needs react-native-maps; this stub preserves the explicit
// selection boundary without loading the native map in a form test.
jest.mock("@/components/location-picker", () => {
  const { Pressable, Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    LocationPicker: ({
      onChange,
    }: {
      onChange: (v: { latitude: number; longitude: number }) => void;
    }) => (
      <Pressable
        accessibilityRole="button"
        onPress={() => onChange({ latitude: 51.05, longitude: -114.07 })}
      >
        <Text>Set test location</Text>
      </Pressable>
    ),
  };
});

const localPhoto = (key: string): FormPhoto => ({
  key,
  uri: `file:///${key}.jpg`,
  width: 100,
  height: 100,
});

const EXISTING: SpotFormValues = {
  ...EMPTY_SPOT_FORM,
  name: "Harmony Park",
  types: ["ledge", "stairs"],
  bustFactor: "medium",
  latitude: 51.05,
  longitude: -114.07,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPickPhotos.mockResolvedValue([]);
});

describe("SpotEditForm", () => {
  test("notes are edited in their own overlay and land back on the form", async () => {
    await render(<SpotEditForm initialValues={EXISTING} onCancel={jest.fn()} onSave={jest.fn()} />);

    await fireEvent.press(screen.getByRole("button", { name: "Edit notes" }));
    await fireEvent.changeText(screen.getByLabelText("Notes"), "Security does laps at 5.");
    await fireEvent.press(screen.getByText("Done"));

    expect(screen.queryByLabelText("Notes")).not.toBeOnTheScreen();
    expect(screen.getByText("Security does laps at 5.")).toBeOnTheScreen();
  });

  test("saves the edited fields, including a surface cleared back to unanswered", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    await render(
      <SpotEditForm
        initialValues={{ ...EXISTING, surface: "smooth" }}
        onCancel={jest.fn()}
        onSave={onSave}
      />,
    );

    await fireEvent.changeText(screen.getByLabelText("Spot name"), "Harmony Park Ledges");
    // Tapping the chosen surface is what clears an optional field.
    await fireEvent.press(screen.getByText("Smooth"));
    await fireEvent.press(screen.getByText("Save changes"));

    expect(onSave).toHaveBeenCalledWith(
      {
        name: "Harmony Park Ledges",
        types: ["ledge", "stairs"],
        bustFactor: "medium",
        latitude: 51.05,
        longitude: -114.07,
      },
      [],
    );
  });

  test("picked photos and the add control use matching tile dimensions", async () => {
    mockPickPhotos.mockResolvedValueOnce([localPhoto("thumbnail")]);

    await render(<SpotEditForm initialValues={EXISTING} onCancel={jest.fn()} onSave={jest.fn()} />);

    await fireEvent.press(screen.getByRole("button", { name: "Add photos" }));

    const thumbnail = screen.getByLabelText("Selected photo 1");
    const addPhotos = screen.getByRole("button", { name: "Add photos" });
    expect(thumbnail.props.accessible).toBe(true);
    expect(StyleSheet.flatten(thumbnail.props.style)).toMatchObject({
      width: 80,
      height: 80,
      borderRadius: 12,
    });
    expect(StyleSheet.flatten(addPhotos.props.style)).toMatchObject({ width: 80, height: 80 });
  });

  test("re-picking an already attached photo does not duplicate it", async () => {
    mockPickPhotos.mockResolvedValueOnce([localPhoto("a")]);

    await render(
      <SpotEditForm
        initialValues={{ ...EXISTING, photos: [localPhoto("a")] }}
        onCancel={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByRole("button", { name: "Add photos" }));

    expect(screen.getByLabelText("Selected photo 1")).toBeOnTheScreen();
    expect(screen.queryByLabelText("Selected photo 2")).not.toBeOnTheScreen();
  });

  test("a failed upload discards the photos uploaded before it and keeps the spot unsaved", async () => {
    mockUploadPhoto.mockResolvedValueOnce("storage-1").mockRejectedValueOnce(new Error("network"));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const onSave = jest.fn();

    await render(
      <SpotEditForm
        initialValues={{ ...EXISTING, photos: [localPhoto("a"), localPhoto("b")] }}
        onCancel={jest.fn()}
        onSave={onSave}
      />,
    );

    await fireEvent.press(screen.getByText("Save changes"));

    expect(mockUploadPhoto).toHaveBeenCalledTimes(2);
    expect(mockDiscardUpload).toHaveBeenCalledWith({ storageId: "storage-1" });
    expect(onSave).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith("Couldn't save the spot", "network");
  });
});
