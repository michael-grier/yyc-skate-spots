import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import ReportSpotScreen from "@/app/spot/report/[id]";

const mockParams: { id: string; kind?: string } = { id: "spot-1", kind: "dead" };
const mockAuth = { isLoaded: true, isSignedIn: true, getToken: async () => "token" };
const mockBack = jest.fn();
const mockSpot = { _id: "spot-1", name: "Rails", status: "active", isOwner: false };
const mockCreateReport = jest.fn();
const mockDiscardUpload = jest.fn();
const mockPickPhotos = jest.fn();
const mockUploadPhoto = jest.fn();
const photo = { key: "photo-1", uri: "file:///photo.jpg", width: 100, height: 100 };

jest.mock("@clerk/expo", () => ({
  useAuth: () => mockAuth,
}));
jest.mock("@/components/sign-in-view", () => {
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return { SignInView: () => <Text>Sign-in form</Text> };
});
jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
}));
jest.mock("convex/react", () => {
  const { getFunctionName } = jest.requireActual<typeof import("convex/server")>("convex/server");
  return {
    useQuery: () => mockSpot,
    useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
      getFunctionName(reference) === "reports:create" ? mockCreateReport : mockDiscardUpload,
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
  jest.resetAllMocks();
  mockParams.kind = "dead";
  mockAuth.isLoaded = true;
  mockAuth.isSignedIn = true;
  mockSpot.isOwner = false;
  mockPickPhotos.mockResolvedValue([photo]);
  mockUploadPhoto.mockResolvedValue("storage-1");
  mockCreateReport.mockResolvedValue(null);
  mockDiscardUpload.mockResolvedValue(null);
});

test.each(["dead", undefined])("sign-in continues to the selected %s report", async (kind) => {
  mockParams.kind = kind;
  mockAuth.isSignedIn = false;
  await render(<ReportSpotScreen />);
  expect(screen.getByText("Sign-in form")).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Send report" })).toBeNull();
  expect(mockCreateReport).not.toHaveBeenCalled();

  mockAuth.isSignedIn = true;
  await screen.rerender(<ReportSpotScreen />);
  expect(screen.queryByText("Sign-in form")).toBeNull();
  expect(screen.getByText("Rails")).toBeOnTheScreen();
  if (kind === "dead") {
    expect(screen.getByRole("button", { name: "Add photos" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Send report" })).toBeDisabled();
  } else {
    await fireEvent.press(screen.getByText("Something else"));
    await fireEvent.press(screen.getByRole("button", { name: "Send report" }));
    expect(mockCreateReport).toHaveBeenCalledWith({ spotId: "spot-1", reason: "other" });
  }
});

test("sign-in can be cancelled with Back without submitting a report", async () => {
  mockAuth.isSignedIn = false;
  await render(<ReportSpotScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(mockBack).toHaveBeenCalledTimes(1);
  expect(mockCreateReport).not.toHaveBeenCalled();
});

test("signing in as the spot owner does not reveal a report form", async () => {
  mockAuth.isSignedIn = false;
  await render(<ReportSpotScreen />);
  mockAuth.isSignedIn = true;
  mockSpot.isOwner = true;
  await screen.rerender(<ReportSpotScreen />);
  expect(screen.getByText("Nothing to report here")).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Send report" })).toBeNull();
});

test("requires a photo before sending a dead-spot report", async () => {
  await render(<ReportSpotScreen />);
  expect(screen.getByRole("button", { name: "Send report" })).toBeDisabled();
  expect(screen.queryAllByRole("radio")).toHaveLength(0);
  mockPickPhotos.mockResolvedValueOnce([]);
  await fireEvent.press(screen.getByRole("button", { name: "Add photos" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Add photos" })).toBeEnabled());
  expect(screen.getByRole("button", { name: "Send report" })).toBeDisabled();
  await fireEvent.press(screen.getByRole("button", { name: "Add photos" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Send report" })).toBeEnabled());
  await fireEvent.press(screen.getByRole("button", { name: "Send report" }));
  await waitFor(() => expect(screen.getByText("Thanks for looking out")).toBeOnTheScreen());
  expect(mockUploadPhoto).toHaveBeenCalledWith(
    photo,
    "https://example.convex.site",
    "token",
    "report",
  );
  expect(mockCreateReport).toHaveBeenCalledWith({
    spotId: "spot-1",
    reason: "gone_or_unusable",
    photoIds: ["storage-1"],
  });
});

test("cleans up partial uploads and keeps the photos available for retry", async () => {
  mockPickPhotos.mockResolvedValue([photo, { ...photo, key: "photo-2" }]);
  mockUploadPhoto
    .mockResolvedValueOnce("storage-1")
    .mockRejectedValueOnce(new Error("Upload failed"));
  await render(<ReportSpotScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Add photos" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Send report" })).toBeEnabled());
  await fireEvent.press(screen.getByRole("button", { name: "Send report" }));
  await waitFor(() => expect(screen.getByText("Upload failed")).toBeOnTheScreen());
  expect(mockDiscardUpload).toHaveBeenCalledWith({ storageId: "storage-1" });
  expect(mockCreateReport).not.toHaveBeenCalled();
  mockUploadPhoto.mockResolvedValueOnce("storage-2").mockResolvedValueOnce("storage-3");
  await fireEvent.press(screen.getByRole("button", { name: "Send report" }));
  await waitFor(() =>
    expect(mockCreateReport).toHaveBeenCalledWith({
      spotId: "spot-1",
      reason: "gone_or_unusable",
      photoIds: ["storage-2", "storage-3"],
    }),
  );
});

test("keeps reports for other problems available without photos", async () => {
  mockParams.kind = undefined;
  await render(<ReportSpotScreen />);
  await fireEvent.press(screen.getByText("Something else"));
  await fireEvent.press(screen.getByRole("button", { name: "Send report" }));
  await waitFor(() =>
    expect(mockCreateReport).toHaveBeenCalledWith({ spotId: "spot-1", reason: "other" }),
  );
  expect(mockUploadPhoto).not.toHaveBeenCalled();
});
