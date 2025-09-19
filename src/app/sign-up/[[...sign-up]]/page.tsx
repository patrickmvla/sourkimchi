"use client";
import { SignUp } from "@clerk/nextjs";
export default function Page() {
  return (
    <div className="container py-10">
      <SignUp />
    </div>
  );
}
