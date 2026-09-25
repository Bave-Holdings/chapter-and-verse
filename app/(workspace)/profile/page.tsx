import type { Metadata } from "next";
import { ProfileForm } from "../../profile/profile-form";

export const metadata: Metadata = {
  title: "My Profile | Chapter & Verse",
  description: "Manage your Chapter & Verse profile and account details.",
};

export default function ProfilePage() {
  return <ProfileForm />;
}
