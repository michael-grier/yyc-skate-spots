import type { ColorValue } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

type IconProps = { size?: number; color: ColorValue };

// Hand-drawn 24-unit stroke icons so the chrome matches the BoardMark's
// line weight; avoids pulling in an icon font for a handful of glyphs.

export function MapIcon({ size = 24, color }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinejoin="round"
    >
      <Path d="M9 20l-6-2V4l6 2 6-2 6 2v14l-6-2-6 2z" />
      <Path d="M9 6v14M15 4v14" />
    </Svg>
  );
}

export function PlusCircleIcon({ size = 24, color }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    >
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 8v8M8 12h8" />
    </Svg>
  );
}

export function PersonIcon({ size = 24, color }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    >
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </Svg>
  );
}

export function LocateIcon({ size = 24, color }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinejoin="round"
    >
      <Path d="M12 2l7 19-7-4-7 4 7-19z" />
    </Svg>
  );
}

export function ChevronRightIcon({ size = 24, color }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M9 6l6 6-6 6" />
    </Svg>
  );
}
