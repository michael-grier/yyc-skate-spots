import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import ReportSpotScreen from "@/app/spot/report/[id]";

const mockParams: { id: string; kind?: string } = { id: "spot-1", kind: "dead" };
const mockCreateReport = jest.fn();
const mockDiscardUpload = jest.fn();
const mockPickPhotos = jest.fn();
const mockUploadPhoto = jest.fn();
const photo = { key: "photo-1", uri: "file:///photo.jpg", width: 100, height: 100 };

jest.mock("@clerk/expo", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true, getToken: async () => "token" }),
}));
jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));
jest.mock("convex/react", () => {
  const { getFunctionName } = jest.requireActual<typeof import("convex/server")>("convex/server");
  return {
    useQuery: () => ({ _id: "spot-1", name: "Rails", status: "active", isOwner: false }),
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
  mockPickPhotos.mockResolvedValue([photo]);
  mockUploadPhoto.mockResolvedValue("storage-1");
  mockCreateReport.mockResolvedValue(null);
  mockDiscardUpload.mockResolvedValue(null);
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
