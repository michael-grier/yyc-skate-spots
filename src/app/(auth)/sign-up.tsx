import { useAuth, useSignUp } from "@clerk/expo";
import { useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";

/**
 * Clerk's boilerplate email and password sign-up, moved off the index route
 * verbatim. It creates real accounts against the live Clerk instance, so it
 * works, but nothing here is designed and every error path is still a silent
 * return. Replace the whole screen when auth gets its real treatment.
 *
 * Nothing links here yet. Reach it in the dev client at /sign-up.
 */
export default function SignUpScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const { signUp } = useSignUp();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSignUp = async () => {
    const { error } = await signUp.password({ emailAddress, password });
    if (error) {
      // Handle the error in your app.
      // See https://clerk.com/docs/guides/development/custom-flows/error-handling
      return;
    }

    const { error: sendError } = await signUp.verifications.sendEmailCode();
    if (sendError) {
      // Handle the error in your app.
      return;
    }

    setIsVerifying(true);
  };

  const handleVerify = async () => {
    const { error } = await signUp.verifications.verifyEmailCode({ code });
    if (error) {
      // Handle the error in your app.
      return;
    }

    const { error: finalizeError } = await signUp.finalize();
    if (finalizeError) {
      // Handle the error in your app.
    }
  };

  if (!isLoaded) {
    return null;
  }

  if (isSignedIn) {
    return (
      <View style={styles.container}>
        <Text>You're signed in</Text>
      </View>
    );
  }

  if (isVerifying) {
    return (
      <View style={styles.container}>
        <TextInput
          style={styles.input}
          value={code}
          placeholder="Enter your verification code"
          onChangeText={setCode}
          keyboardType="numeric"
        />
        <Button title="Verify" onPress={handleVerify} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        value={emailAddress}
        placeholder="Enter email"
        onChangeText={setEmailAddress}
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        value={password}
        placeholder="Enter password"
        secureTextEntry={true}
        onChangeText={setPassword}
      />
      <Button title="Sign up" onPress={handleSignUp} />
      {/* Required for sign-up flows on Expo web. Clerk skips the browser CAPTCHA on iOS and Android */}
      <View nativeID="clerk-captcha" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 12,
    justifyContent: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
});
