import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { adminAuth, adminDb } from "@/lib/server/firebase-admin";

const TTL_MS = 10 * 60 * 1000;
const RESEND_MS = 60 * 1000;

function hash(uid: string, code: string, secret: string) {
  return createHmac("sha256", secret).update(`${uid}:${code}`).digest("hex");
}

export async function POST(request: Request) {
  try {
    const secret = process.env.OTP_HASH_SECRET;
    if (!secret || !process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
      return Response.json({ error: "Email verification is not configured yet." }, { status: 503 });
    }
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return Response.json({ error: "Sign in first." }, { status: 401 });
    const identity = await adminAuth().verifyIdToken(token);
    if (!identity.email) return Response.json({ error: "Your account needs an email address." }, { status: 400 });
    const { action, code } = await request.json() as { action?: string; code?: string };
    const db = adminDb();
    const profileRef = db.collection("users").doc(identity.uid);
    const profile = await profileRef.get();
    if (!profile.exists || profile.data()?.email?.toLowerCase() !== identity.email.toLowerCase()) {
      return Response.json({ error: "Account details are not ready. Try again." }, { status: 409 });
    }
    if (profile.data()?.emailOtpVerified === true) return Response.json({ verified: true });
    const otpRef = db.collection("emailOtps").doc(identity.uid);

    if (action === "send") {
      const nextCode = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const now = Date.now();
      await db.runTransaction(async (tx) => {
        const previous = await tx.get(otpRef);
        if (now - Number(previous.data()?.sentAt ?? 0) < RESEND_MS) throw new Error("Wait one minute before requesting another code.");
        tx.set(otpRef, { hash: hash(identity.uid, nextCode, secret), sentAt: now, expiresAt: now + TTL_MS, attempts: 0 });
      });
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to: [identity.email], subject: "Your VenueBook verification code", text: `Your VenueBook code is ${nextCode}. It expires in 10 minutes.` }),
      });
      if (!response.ok) { await otpRef.delete(); throw new Error("Could not send the code. Try again shortly."); }
      return Response.json({ sent: true });
    }

    if (action === "verify") {
      if (!/^\d{6}$/.test(code ?? "")) return Response.json({ error: "Enter the six-digit code." }, { status: 400 });
      await db.runTransaction(async (tx) => {
        const snapshot = await tx.get(otpRef);
        const data = snapshot.data();
        if (!data || Date.now() > Number(data.expiresAt)) throw new Error("The code expired. Request a new one.");
        if (Number(data.attempts) >= 5) throw new Error("Too many attempts. Request a new code.");
        const expected = Buffer.from(String(data.hash), "hex");
        const actual = Buffer.from(hash(identity.uid, code!, secret), "hex");
        if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
          tx.update(otpRef, { attempts: Number(data.attempts) + 1 });
          return;
        }
        tx.update(profileRef, { emailOtpVerified: true });
        tx.delete(otpRef);
      });
      const refreshed = await profileRef.get();
      if (!refreshed.data()?.emailOtpVerified) return Response.json({ error: "That code is incorrect." }, { status: 400 });
      return Response.json({ verified: true });
    }
    return Response.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email verification failed.";
    return Response.json({ error: message }, { status: message.includes("configured") ? 503 : 400 });
  }
}
