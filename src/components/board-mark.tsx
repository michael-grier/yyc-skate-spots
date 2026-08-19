import Svg, { Circle, G, Path } from "react-native-svg";

import { colors } from "@/theme/colors";

// Geometry center of the board drawing below, used as the rotation origin.
const CENTER = { x: 12, y: 14 };

type BoardMarkProps = {
  size: number;
  /** Degrees of counter-clockwise tilt (nose up to the right). The brand mark is 45. */
  angle?: number;
  color?: string;
  /** Thicken to ~2.4 below 20px or the deck line disappears on map pins. */
  strokeWidth?: number;
};

/**
 * The app's mark: a side-view skateboard, tilted 45° by default.
 * Used everywhere a logo or spot glyph appears — map pins, search bar,
 * sign-in — so it renders from props, not a bundled asset.
 */
export function BoardMark({ size, angle = 45, color = colors.silver, strokeWidth = 1.8 }: BoardMarkProps) {
  // A tilted board's bounding box exceeds the 24-unit viewBox, so shrink it
  // around its center just enough to keep the tips inside.
  const scale = angle === 0 ? 1 : 0.88;
  const transform = [
    `rotate(${-angle} ${CENTER.x} ${CENTER.y})`,
    `translate(${CENTER.x} ${CENTER.y})`,
    `scale(${scale})`,
    `translate(${-CENTER.x} ${-CENTER.y})`,
  ].join(" ");

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G transform={transform}>
        <Path
          d="M1.5 11 Q3 13.6 6 13.6 L18 13.6 Q21 13.6 22.5 11"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <Circle cx="7" cy="17" r="2" fill={color} />
        <Circle cx="17" cy="17" r="2" fill={color} />
      </G>
    </Svg>
  );
}
