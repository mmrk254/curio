"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { readSession } from "@/lib/curio-session";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(readSession() ? "/dashboard" : "/login");
  }, [router]);

  return <main className="loading-screen">Opening CURIO...</main>;
}
