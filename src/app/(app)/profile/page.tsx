import type { Metadata } from "next";
import { ProfileCard } from "@/components/profile-card";

export const metadata: Metadata = {
  title: "My Profile",
  description: "Manage your VenueBook account details.",
};

export default function ProfilePage() {
  return <ProfileCard />;
}