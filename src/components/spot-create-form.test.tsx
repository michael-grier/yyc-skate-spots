import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import type { FormPhoto } from "@/lib/spot-form";

import { SpotCreateForm } from "./spot-create-form";

let mockKeyboardVisible = false;
const mockDiscardUpload = jest.fn();
const mockPickPhotos = jest.fn();
const mockUploadPhoto = jest.fn();

jest.mock("@clerk/expo", () => ({
  useAuth: () => ({ getToken: jest.fn().mockResolvedValue("token") }),
}));
jest.mock("convex/react", () => ({ useMutation: () => mockDiscardUpload }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/lib/use-keyboard-visible", () => ({
  useKeyboardVisible: () => mockKeyboardVisible,
}));
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

async function fillBasics() {
  await fireEvent.changeText(screen.getByLabelText("Spot name"), "Test Ledge");
  await fireEvent.press(screen.getByText("Ledge"));
  await fireEvent.press(screen.getByText("Next · Place"));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockKeyboardVisible = false;
  mockPickPhotos.mockResolvedValue([]);
});

describe("SpotCreateForm", () => {
  test("a step will not advance until its own fields are valid", async () => {
    await render(<SpotCreateForm onCancel={jest.fn()} onSave={jest.fn()} />);

    await fireEvent.press(screen.getByText("Next · Place"));

    expect(await screen.findByText("Give the spot a name.")).toBeOnTheScreen();
    expect(screen.getByText("Pick at least one type.")).toBeOnTheScreen();
    // Fields belonging to later steps stay quiet, and the step does not change.
    expect(screen.queryByText("Pick a bust factor.")).not.toBeOnTheScreen();
    expect(screen.getByText("What is it?")).toBeOnTheScreen();
  });

  test("walking all three steps saves the picked options and location", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    await render(<SpotCreateForm onCancel={jest.fn()} onSave={onSave} />);

    await fillBasics();
    await fireEvent.press(screen.getByText("Set test location"));
    await fireEvent.press(screen.getByText("Next · Details"));
    await fireEvent.press(screen.getByText("Low"));
    await fireEvent.press(screen.getByText("Save spot"));

    expect(onSave).toHaveBeenCalledWith(
      {
        name: "Test Ledge",
        types: ["ledge"],
        bustFactor: "low",
        latitude: 51.05,
        longitude: -114.07,
      },
      [],
    );
  });

  test("leaving the details step restores its button even with the keyboard up", async () => {
    // The notes accessory bar replaces the step button while notes is being
    // typed into. Tying it to focus events instead of the keyboard used to leave
    // it stuck on other steps, which hid Save and dead-ended the wizard.
    mockKeyboardVisible = true;
    await render(<SpotCreateForm onCancel={jest.fn()} onSave={jest.fn()} />);

    await fillBasics();
    await fireEvent.press(screen.getByText("Set test location"));
    await fireEvent.press(screen.getByText("Next · Details"));
    expect(screen.getByText("Done")).toBeOnTheScreen();
    expect(screen.queryByText("Save spot")).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByText("Back"));
    expect(screen.getByText("Next · Details")).toBeOnTheScreen();
    expect(screen.queryByText("Done")).not.toBeOnTheScreen();
  });

  test("a failed upload discards the photos uploaded before it and keeps the spot unsaved", async () => {
    mockPickPhotos.mockResolvedValueOnce([localPhoto("a"), localPhoto("b")]);
    mockUploadPhoto.mockResolvedValueOnce("storage-1").mockRejectedValueOnce(new Error("network"));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const onSave = jest.fn();

    await render(<SpotCreateForm onCancel={jest.fn()} onSave={onSave} />);

    await fillBasics();
    await fireEvent.press(screen.getByText("Set test location"));
    await fireEvent.press(screen.getByRole("button", { name: "Add photos" }));
    await fireEvent.press(screen.getByText("Next · Details"));
    await fireEvent.press(screen.getByText("Low"));
    await fireEvent.press(screen.getByText("Save spot"));

    // The alert is the last step of the save chain, so waiting on it means the
    // rollback before it has run. Asserting straight after the press only holds
    // while the mocks happen to settle within microtasks.
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Couldn't save the spot", "network"));
    expect(mockUploadPhoto).toHaveBeenCalledTimes(2);
    expect(mockDiscardUpload).toHaveBeenCalledWith({ storageId: "storage-1" });
    expect(onSave).not.toHaveBeenCalled();
  });
});
