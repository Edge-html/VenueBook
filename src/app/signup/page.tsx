import type { Metadata } from "next";
import { SignUpForm } from "@/components/signup-form";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create your VenueBook account to start reserving venues.",
};

export default function SignUpPage() {
  return <SignUpForm />;
}