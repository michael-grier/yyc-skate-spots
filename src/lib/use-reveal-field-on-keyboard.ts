import { useCallback, useEffect, useRef } from "react";
import { Keyboard, type LayoutChangeEvent, type ScrollView } from "react-native";

// Leaves the field's section label visible above it.
const TOP_MARGIN = 12;
// Single-field forms never report focus, so their one field is the default.
const DEFAULT_FIELD = "field";

/**
 * Scrolls the focused text field to the top of its ScrollView once the keyboard is up. iOS
 * keeps the caret visible only at focus, so a multiline field that grows would otherwise type
 * under the keyboard. Attach `onFieldLayout(name)` to the field's direct child of the
 * ScrollView's content. A form with several fields names each one and passes
 * `onFieldFocus(name)` to its input, so focus moves the scroll even while the keyboard is open.
 */
export function useRevealFieldOnKeyboard() {
  const scrollRef = useRef<ScrollView>(null);
  const fieldYs = useRef(new Map<string, number>());
  const focusedField = useRef(DEFAULT_FIELD);
  const keyboardVisible = useRef(false);

  const reveal = useCallback(() => {
    const y = fieldYs.current.get(focusedField.current);
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - TOP_MARGIN), animated: true });
    }
  }, []);

  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", () => {
      keyboardVisible.current = true;
      reveal();
    });
    const hidden = Keyboard.addListener("keyboardDidHide", () => {
      keyboardVisible.current = false;
    });
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [reveal]);

  const onFieldLayout = useCallback(
    (name = DEFAULT_FIELD) =>
      (event: LayoutChangeEvent) => {
        fieldYs.current.set(name, event.nativeEvent.layout.y);
      },
    [],
  );

  const onFieldFocus = useCallback(
    (name: string) => () => {
      focusedField.current = name;
      if (keyboardVisible.current) {
        reveal();
      }
    },
    [reveal],
  );

  return { scrollRef, onFieldLayout, onFieldFocus };
}
