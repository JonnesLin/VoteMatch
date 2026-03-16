/**
 * Simple JWT-based authentication for candidate portal.
 * Uses jose for JWT operations and bcryptjs for password hashing.
 */

import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "votematch-dev-secret-change-in-production"
);
const JWT_EXPIRY = "7d";

export interface AuthPayload {
  userId: string;
  email: string;
  role: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createToken(payload: AuthPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(JWT_EXPIRY)
    .setIssuedAt()
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<AuthPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as unknown as AuthPayload;
}

/**
 * Extracts and verifies JWT from Authorization header.
 * Returns the authenticated user payload or throws.
 */
export async function authenticateRequest(
  request: Request
): Promise<AuthPayload> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header");
  }

  const token = authHeader.slice(7);
  return verifyToken(token);
}

/**
 * Gets the authenticated user's candidate record.
 * Returns null if the user hasn't claimed a candidate profile.
 */
export async function getAuthenticatedCandidate(userId: string) {
  return prisma.candidate.findFirst({
    where: { claimedBy: userId, claimed: true },
    include: {
      election: true,
      positions: { include: { issue: true } },
    },
  });
}
