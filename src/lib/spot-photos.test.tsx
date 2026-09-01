import { uploadPhoto } from "./spot-photos";

const mockFetch = jest.fn();
const mockFileUris: string[] = [];
const mockResize = jest.fn();
const mockSaveAsync = jest.fn().mockResolvedValue({ uri: "file:///cache/rendered.jpg" });
const mockRenderAsync = jest.fn().mockResolvedValue({ saveAsync: mockSaveAsync });
const mockManipulate = jest.fn((_uri: string) => ({
  resize: mockResize,
  renderAsync: mockRenderAsync,
}));

jest.mock("expo/fetch", () => ({ fetch: (...args: unknown[]) => mockFetch(...args) }));
jest.mock("expo-file-system", () => ({
  File: class MockFile {
    uri: string;

    constructor(uri: string) {
      this.uri = uri;
      mockFileUris.push(uri);
    }
  },
}));
jest.mock("expo-image-manipulator", () => ({
  ImageManipulator: { manipulate: (uri: string) => mockManipulate(uri) },
  SaveFormat: { JPEG: "jpeg" },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockFileUris.length = 0;
  mockSaveAsync.mockResolvedValue({ uri: "file:///cache/rendered.jpg" });
  mockRenderAsync.mockResolvedValue({ saveAsync: mockSaveAsync });
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue({ storageId: "storage-1" }),
  });
});

test("uploads the rendered JPEG as an Expo file body", async () => {
  const storageId = await uploadPhoto(
    {
      key: "picked-photo",
      uri: "file:///cache/picked.heic",
      width: 4000,
      height: 3000,
    },
    "https://example.convex.site",
    "clerk-token",
  );

  expect(mockResize).toHaveBeenCalledWith({ width: 1600, height: 1200 });
  expect(mockFileUris).toEqual(["file:///cache/rendered.jpg"]);
  expect(mockFetch).toHaveBeenCalledWith("https://example.convex.site/upload", {
    method: "POST",
    headers: { "Content-Type": "image/jpeg", Authorization: "Bearer clerk-token" },
    body: expect.objectContaining({ uri: "file:///cache/rendered.jpg" }),
  });
  expect(storageId).toBe("storage-1");
});
