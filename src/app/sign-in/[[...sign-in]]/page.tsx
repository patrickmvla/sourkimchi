"use client";
import { SignIn } from "@clerk/nextjs";
export default function Page() {
  return (
    <div className="container py-10">
      <SignIn />
    </div>
  );
}
