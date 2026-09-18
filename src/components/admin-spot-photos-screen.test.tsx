import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import AdminSpotPhotosScreen from "@/app/admin/spot/photos/[id]";

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockAddPhotos = jest.fn();
const mockDiscard = jest.fn();
const mockAcknowledge = jest.fn();
const mockPickPhotos = jest.fn();
const mockUploadPhoto = jest.fn();
const mockViewer = { isAdmin: true, isBanned: false, hasAcknowledgedStandards: true };
const photo = { key: "photo-1", uri: "file:///photo.jpg", width: 100, height: 100 };

jest.mock("@clerk/expo", () => ({ useAuth: () => ({ getToken: async () => "token" }) }));
jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: "spot-1" }),
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));
jest.mock("convex/react", () => {
  const { getFunctionName } = jest.requireActual<typeof import("convex/server")>("convex/server");
  return {
    useQuery: (ref: Parameters<typeof getFunctionName>[0]) =>
      getFunctionName(ref) === "moderation:viewer"
        ? mockViewer
        : { _id: "spot-1", name: "Rails", canAddAdminPhotos: true, creator: { name: "Owner" } },
    useMutation: (ref: Parameters<typeof getFunctionName>[0]) => {
      const name = getFunctionName(ref);
      if (name === "spots:addAdminPhotos") return mockAddPhotos;
      if (name === "spots:discardUpload") return mockDiscard;
      return mockAcknowledge;
    },
  };
});
jest.mock("@/lib/convex-site", () => ({
  resolveConvexSiteUrl: () => "https://example.convex.site",
}));
jest.mock("@/lib/spot-photos", () => ({
  pickPhotos: (...args: unknown[]) => mockPickPhotos(...args),
  uploadPhoto: (...args: unknown[]) => mockUploadPhoto(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockViewer.isAdmin = true;
  mockViewer.hasAcknowledgedStandards = true;
  mockPickPhotos.mockResolvedValue([photo]);
  mockUploadPhoto.mockResolvedValue("storage-1");
  mockAddPhotos.mockResolvedValue(null);
  mockDiscard.mockResolvedValue(null);
  mockAcknowledge.mockResolvedValue(null);
});

async function selectPhoto() {
  await fireEvent.press(screen.getByRole("button", { name: "Add photos" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Publish photos" })).toBeEnabled());
}

test("uploads photos with only a spot id and storage ids in the admin mutation", async () => {
  await render(<AdminSpotPhotosScreen />);
  expect(screen.getByRole("button", { name: "Publish photos" })).toBeDisabled();
  await selectPhoto();
  await fireEvent.press(screen.getByRole("button", { name: "Publish photos" }));
  await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
  expect(mockAddPhotos).toHaveBeenCalledWith({ id: "spot-1", photoIds: ["storage-1"] });
  expect(mockDiscard).not.toHaveBeenCalled();
});

test("discards the upload if permission was withdrawn before publishing", async () => {
  mockAddPhotos.mockRejectedValueOnce(new Error("Permission withdrawn"));
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  await render(<AdminSpotPhotosScreen />);
  await selectPhoto();
  await fireEvent.press(screen.getByRole("button", { name: "Publish photos" }));
  await waitFor(() =>
    expect(alert).toHaveBeenCalledWith("Couldn't add photos", "Permission withdrawn"),
  );
  expect(mockDiscard).toHaveBeenCalledWith({ storageId: "storage-1" });
  expect(mockBack).not.toHaveBeenCalled();
});

test("requires first-use standards before uploading and hides the form from non-admins", async () => {
  mockViewer.hasAcknowledgedStandards = false;
  await render(<AdminSpotPhotosScreen />);
  await selectPhoto();
  await fireEvent.press(screen.getByRole("button", { name: "Publish photos" }));
  expect(mockUploadPhoto).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("Agree and submit"));
  await waitFor(() => expect(mockAddPhotos).toHaveBeenCalledTimes(1));
  expect(mockAcknowledge).toHaveBeenCalledTimes(1);
  await screen.unmount();
  mockViewer.isAdmin = false;
  await render(<AdminSpotPhotosScreen />);
  expect(screen.getByText("Administrator access only")).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Add photos" })).toBeNull();
});
