import { fireEvent, render, screen } from "@testing-library/react-native";
import { Alert } from "react-native";

import { EMPTY_SPOT_FORM, type FormPhoto } from "@/lib/spot-form";

import { SpotForm } from "./spot-form";

const mockDiscardUpload = jest.fn();
const mockUploadPhoto = jest.fn();

jest.mock("@clerk/expo", () => ({
  useAuth: () => ({ getToken: jest.fn().mockResolvedValue("token") }),
}));
jest.mock("convex/react", () => ({ useMutation: () => mockDiscardUpload }));
jest.mock("@/lib/spot-photos", () => ({
  pickPhotos: jest.fn().mockResolvedValue([]),
  uploadPhoto: (...args: unknown[]) => mockUploadPhoto(...args),
}));
jest.mock("expo-image", () => {
  const { Image } = jest.requireActual<typeof import("react-native")>("react-native");
  return { Image };
});
// The picker needs react-native-maps; stand in with a stub that adopts a
// position once, as the real one does with the user's location.
jest.mock("@/components/location-picker", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    LocationPicker: ({ onChange }: { onChange: (v: { latitude: number; longitude: number }) => void }) => {
      const fired = React.useRef(false);
      React.useEffect(() => {
        if (!fired.current) {
          fired.current = true;
          onChange({ latitude: 51.05, longitude: -114.07 });
        }
      });
      return null;
    },
  };
});

const localPhoto = (key: string): FormPhoto => ({
  key,
  uri: `file:///${key}.jpg`,
  width: 100,
  height: 100,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("SpotForm", () => {
  test("an empty save shows field errors and never calls onSave", async () => {
    const onSave = jest.fn();
    await render(
      <SpotForm title="New spot" initialValues={EMPTY_SPOT_FORM} onCancel={jest.fn()} onSave={onSave} />,
    );

    await fireEvent.press(screen.getByText("Save"));
    expect(await screen.findByText("Give the spot a name.")).toBeOnTheScreen();
    expect(screen.getByText("Pick at least one type.")).toBeOnTheScreen();
    expect(screen.getByText("Pick a bust factor.")).toBeOnTheScreen();
    expect(onSave).not.toHaveBeenCalled();
  });

  test("a completed form saves with the picked options and adopted location", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    await render(
      <SpotForm title="New spot" initialValues={EMPTY_SPOT_FORM} onCancel={jest.fn()} onSave={onSave} />,
    );

    await fireEvent.changeText(screen.getByLabelText("Spot name"), "Test Ledge");
    await fireEvent.press(screen.getByText("Ledge"));
    await fireEvent.press(screen.getByText("Low"));
    await fireEvent.press(screen.getByText("Save"));

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

  test("a failed upload discards the photos uploaded before it and keeps the spot unsaved", async () => {
    mockUploadPhoto
      .mockResolvedValueOnce("storage-1")
      .mockRejectedValueOnce(new Error("network"));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const onSave = jest.fn();

    await render(
      <SpotForm
        title="New spot"
        initialValues={{
          ...EMPTY_SPOT_FORM,
          name: "Test Ledge",
          types: ["ledge"],
          bustFactor: "low",
          latitude: 51.05,
          longitude: -114.07,
          photos: [localPhoto("a"), localPhoto("b")],
        }}
        onCancel={jest.fn()}
        onSave={onSave}
      />,
    );

    await fireEvent.press(screen.getByText("Save"));
    expect(mockUploadPhoto).toHaveBeenCalledTimes(2);
    expect(mockDiscardUpload).toHaveBeenCalledWith({ storageId: "storage-1" });
    expect(onSave).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith("Couldn't save the spot", "network");
  });
});
