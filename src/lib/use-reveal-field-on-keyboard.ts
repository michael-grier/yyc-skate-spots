import { useCallback, useEffect, useRef } from "react";
import { Keyboard, type LayoutChangeEvent, type ScrollView } from "react-native";

// Leaves the field's section label visible above it.
const TOP_MARGIN = 12;

/**
 * Scrolls a form's only text field to the top of its ScrollView once the keyboard is up. iOS
 * keeps the caret visible only at focus, so a multiline field that grows would otherwise type
 * under the keyboard. Attach `onFieldLayout` to a direct child of the ScrollView's content.
 */
export function useRevealFieldOnKeyboard() {
  const scrollRef = useRef<ScrollView>(null);
  const fieldY = useRef(0);

  useEffect(() => {
    const subscription = Keyboard.addListener("keyboardDidShow", () => {
      scrollRef.current?.scrollTo({ y: Math.max(0, fieldY.current - TOP_MARGIN), animated: true });
    });
    return () => subscription.remove();
  }, []);

  const onFieldLayout = useCallback((event: LayoutChangeEvent) => {
    fieldY.current = event.nativeEvent.layout.y;
  }, []);

  return { scrollRef, onFieldLayout };
}
