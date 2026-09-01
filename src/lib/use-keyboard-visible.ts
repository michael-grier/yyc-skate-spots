import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * True while the software keyboard is on screen. Forms use it to decide what to
 * render — swapping a footer for an accessory bar, dropping a heading — never to
 * compute an offset. Layout stays with KeyboardAvoidingView so each platform
 * keeps its own inset behaviour.
 */
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // iOS fires the "will" pair early enough to swap in the same frame the
    // keyboard animates; Android only ever emits the "did" pair.
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, () => setVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
}
