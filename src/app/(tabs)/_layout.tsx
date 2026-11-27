import { useAuth } from "@clerk/expo";
import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { Tabs } from "expo-router";
import { View } from "react-native";

import { MapIcon, PersonIcon, PlusCircleIcon } from "@/components/icons";
import { colors } from "@/theme/colors";

/**
 * Bottom tab bar: Map / Add spot / Sign in. Matte solid bar with a hairline
 * top edge; no native blur so it renders identically on both platforms.
 */
export default function TabsLayout() {
  const { isSignedIn } = useAuth();
  const unreadUpdates = useQuery(api.notices.unreadCount, isSignedIn ? {} : "skip");

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
          title: isSignedIn ? "Profile" : "Sign in",
          tabBarAccessibilityLabel: unreadUpdates ? "Profile, new updates" : undefined,
          tabBarIcon: ({ color, size }) => (
            <View>
              <PersonIcon size={size} color={color} />
              {unreadUpdates ? (
                <View className="absolute -right-0.5 top-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-bust-low" />
              ) : null}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
