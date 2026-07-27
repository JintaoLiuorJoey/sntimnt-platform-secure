import { useAuth } from "@/auth/auth-context";
import AppShell from "@/components/AppShell";
import BusinessDataUnavailable from "@/components/BusinessDataUnavailable";

const Profile = () => {
  const { session } = useAuth();
  const user = session?.user;

  return (
    <AppShell>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-midnight">
            Profile
          </h1>
          <p className="mt-1 text-sm text-[#666]">
            Identity information is read from the server-validated authentication
            session.
          </p>
        </header>

        {!user ? (
          <BusinessDataUnavailable
            title="Profile unavailable"
            description="No validated authenticated identity is available. Local fallback identities are not permitted."
            capability="GET /api/auth/session"
          />
        ) : (
          <>
            <section
              aria-labelledby="authenticated-profile-title"
              className="rounded-[10px] border border-[#E5E5E5] bg-white p-6"
            >
              <h2
                id="authenticated-profile-title"
                className="text-base font-bold text-midnight"
              >
                Authenticated profile
              </h2>

              <p className="mt-2 text-sm leading-6 text-[#666]">
                These values come from the signed identity claims accepted by the
                backend. They cannot be edited or replaced in the browser.
              </p>

              <dl className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[#888]">
                    Display name
                  </dt>
                  <dd className="mt-1 break-words text-sm font-medium text-midnight">
                    {user.displayName}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[#888]">
                    Email
                  </dt>
                  <dd className="mt-1 break-words text-sm font-medium text-midnight">
                    {user.email}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[#888]">
                    Authorized roles
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-midnight">
                    {user.roles.join(", ")}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[#888]">
                    Identity source
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-midnight">
                    Server-validated session
                  </dd>
                </div>
              </dl>
            </section>

            <BusinessDataUnavailable
              title="Profile and account changes unavailable"
              description="Profile edits, notification preferences, password changes, banking updates, deposits, recurring funding, withdrawals, and account closure remain disabled until authenticated server APIs, step-up verification, resource authorization, persistence, and audit logging are implemented."
              capability="GET/PATCH /api/me/profile and audited account workflow APIs"
            />
          </>
        )}
      </div>
    </AppShell>
  );
};

export default Profile;
