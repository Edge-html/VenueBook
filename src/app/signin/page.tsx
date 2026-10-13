import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "@/components/signin-form";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to VenueBook to reserve the gymnasium or AVR.",
};

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}