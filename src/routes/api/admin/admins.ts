import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import {
  createAdmin,
  findAdminByEmail,
  findAdminById,
  listAdmins,
  saveAdmin,
} from "@/lib/server/admin-repo";
import { requireAdmin } from "@/lib/server/admin-session";
import { ROLE_PERMISSIONS, toPublicAdmin, type AdminRole } from "@/lib/server/admin-types";
import { hashPassword, normalizeEmail } from "@/lib/server/crypto";
import { fail, json, readJsonBody } from "@/lib/server/http";
import { route } from "@/lib/server/session";
import { validateEmail, validateName, validatePassword } from "@/lib/validation";

type CreateBody = { name?: string; email?: string; password?: string; role?: AdminRole };
type UpdateBody = { id?: string; role?: AdminRole; active?: boolean };

const ROLES = Object.keys(ROLE_PERMISSIONS) as AdminRole[];

/**
 * Staff accounts. Guarded by `admins.manage`, which only the owner role has —
 * a manager cannot promote themselves, and no customer-facing route touches
 * this data at all.
 */
export const Route = createFileRoute("/api/admin/admins")({
  server: {
    handlers: {
      GET: route(async ({ request }) => {
        await requireAdmin(request, "admins.manage");
        const admins = await listAdmins();
        return json({ ok: true, admins: admins.map(toPublicAdmin) });
      }),

      POST: route(async ({ request }) => {
        const actor = await requireAdmin(request, "admins.manage");
        const body = await readJsonBody<CreateBody>(request);
        if (!body) return fail("Invalid request.");

        const name = (body.name ?? "").trim();
        const email = normalizeEmail(body.email ?? "");
        const password = body.password ?? "";
        const role = body.role ?? "staff";

        for (const [field, message] of [
          ["name", validateName(name)],
          ["email", validateEmail(email)],
          // Staff passwords are held to the same bar as customers'.
          ["password", validatePassword(password)],
        ] as [string, string | null][]) {
          if (message) return fail(message, 400, field);
        }

        if (!ROLES.includes(role)) return fail("Unknown role.", 400, "role");
        if (await findAdminByEmail(email)) {
          return fail("An admin already exists with this email.", 409, "email");
        }

        const created = await createAdmin({
          name,
          email,
          passwordHash: await hashPassword(password),
          role,
        });

        console.info(`[ras/admin] ${actor.email} created ${role} account ${email}`);
        return json({ ok: true, admin: toPublicAdmin(created) });
      }),

      /** Change a role, or deactivate an account. Never deletes. */
      PUT: route(async ({ request }) => {
        const actor = await requireAdmin(request, "admins.manage");
        const body = await readJsonBody<UpdateBody>(request);
        if (!body?.id) return fail("Invalid request.");

        const target = await findAdminById(body.id);
        if (!target) return fail("Admin not found.", 404);

        // An owner must not be able to lock themselves out, which would leave
        // the business with no way back in.
        if (target.id === actor.id && (body.active === false || body.role !== undefined)) {
          return fail("You cannot change your own role or deactivate yourself.", 400);
        }

        if (body.role !== undefined && !ROLES.includes(body.role)) {
          return fail("Unknown role.", 400, "role");
        }

        const updated = await saveAdmin({
          ...target,
          role: body.role ?? target.role,
          active: body.active ?? target.active,
        });

        console.info(`[ras/admin] ${actor.email} updated ${target.email}`);
        return json({ ok: true, admin: toPublicAdmin(updated) });
      }),
    },
  },
});
