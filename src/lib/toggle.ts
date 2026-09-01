/** Adds an item to a list, or drops it when it is already there. */
export function toggle<T>(list: T[], item: T) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}
