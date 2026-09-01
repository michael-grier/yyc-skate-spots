import { render, screen } from "@testing-library/react-native";

import SharedSpotRoute from "@/app/share";

const mockRedirect = jest.fn((_props: { href: unknown }) => null);
let mockParams: { id?: string | string[] } = { id: "spot-1" };

jest.mock("expo-router", () => ({
  Redirect: (props: { href: unknown }) => mockRedirect(props),
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockParams,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { id: "spot-1" };
});

test("redirects a shared id to the public spot detail route", async () => {
  await render(<SharedSpotRoute />);

  expect(mockRedirect).toHaveBeenCalledWith({
    href: { pathname: "/spot/[id]", params: { id: "spot-1" } },
  });
});

test.each([{ id: undefined }, { id: "" }, { id: " " }, { id: ["spot-1", "spot-2"] }])(
  "rejects an incomplete share link",
  async (params) => {
    mockParams = params;
    await render(<SharedSpotRoute />);

    expect(screen.getByText("This share link is incomplete")).toBeTruthy();
    expect(mockRedirect).not.toHaveBeenCalled();
  },
);
