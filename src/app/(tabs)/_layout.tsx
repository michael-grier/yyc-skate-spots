import { Tabs } from "expo-router";

import { MapIcon, PersonIcon, PlusCircleIcon } from "@/components/icons";
import { colors } from "@/theme/colors";

/**
 * Bottom tab bar: Map / Add spot / Sign in. Matte solid bar with a hairline
 * top edge; no native blur so it renders identically on both platforms.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.mute,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: "rgba(255,255,255,0.08)",
        },
        tabBarLabelStyle: { fontFamily: "Inter_500Medium", fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Map",
          tabBarIcon: ({ color, size }) => <MapIcon size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: "Add spot",
          tabBarIcon: ({ color, size }) => <PlusCircleIcon size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Sign in",
          tabBarIcon: ({ color, size }) => <PersonIcon size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
