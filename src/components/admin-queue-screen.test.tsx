import { fireEvent, render, screen } from "@testing-library/react-native";
import AdminQueueScreen from "@/app/admin/index";

const mockSpots = [
  {
    _id: "spot-1",
    _creationTime: 1,
    name: "Allowed rails",
    types: ["handrail"],
    canAddAdminPhotos: true,
    previewPhotoUrl: null,
    review: { needsReview: false, openReportCount: 0 },
  },
  {
    _id: "spot-2",
    _creationTime: 2,
    name: "Private permission",
    types: ["ledge"],
    canAddAdminPhotos: false,
    previewPhotoUrl: null,
    review: { needsReview: false, openReportCount: 0 },
  },
];
jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));
jest.mock("convex/react", () => {
  const { getFunctionName } = jest.requireActual<typeof import("convex/server")>("convex/server");
  return {
    useMutation: () => jest.fn(),
    useQuery: (ref: Parameters<typeof getFunctionName>[0]) => {
      const name = getFunctionName(ref);
      if (name === "moderation:viewer") return { isAdmin: true };
      if (name === "moderation:listSpots") return mockSpots;
      return [];
    },
  };
});

test("counts and lists only spots eligible for admin photos", async () => {
  await render(<AdminQueueScreen />);
  await fireEvent.press(screen.getByText("Needs photos 1"));
  expect(screen.getByText("Allowed rails")).toBeOnTheScreen();
  expect(screen.queryByText("Private permission")).toBeNull();
});
