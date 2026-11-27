import type { Metadata } from "next";
import Backdrop from "@/components/ui/backdrop";
import LoginForm from "./login-form";

export const metadata: Metadata = {
  title: "Sign in · Day One",
};

export default function LoginPage() {
  // No one is signed in yet, so always the default sky
  return (
    <>
      <Backdrop />
      <LoginForm />
    </>
  );
}
