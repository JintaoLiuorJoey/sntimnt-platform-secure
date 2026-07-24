import { z } from "zod";

export const userRoleSchema = z.enum(["investor", "admin", "operations"]);

export const authenticatedUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1),
  roles: z.array(userRoleSchema).min(1),
});

export const authSessionSchema = z.object({
  user: authenticatedUserSchema,
  expiresAt: z.string().datetime({ offset: true }),
  refreshAfter: z.string().datetime({ offset: true }).optional(),
});

export type UserRole = z.infer<typeof userRoleSchema>;
export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
export type AuthStatus = "loading" | "authenticated" | "anonymous" | "error";
