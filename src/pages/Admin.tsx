import { useState } from "react";
import AdminShell from "@/components/AdminShell";
import BusinessDataUnavailable from "@/components/BusinessDataUnavailable";

const SECTION_COPY = {
  overview: {
    title: "Administrative overview unavailable",
    description:
      "Administrative totals, system status, and operational summaries are not shown because no trusted administrative data API is connected.",
    capability: "GET /api/admin/overview",
  },
  pending: {
    title: "Approval queue unavailable",
    description:
      "Pending-user and approval records must come from an authenticated server endpoint with administrative authorization and audit logging.",
    capability: "GET /api/admin/approvals",
  },
  investors: {
    title: "Investor directory unavailable",
    description:
      "Investor identities, portfolio values, deposits, and account status must not be embedded in the frontend bundle.",
    capability: "GET /api/admin/investors",
  },
  operations: {
    title: "Operations console unavailable",
    description:
      "Operational health, transaction controls, and workflow actions remain disabled until they are backed by trusted services and monitored APIs.",
    capability: "GET /api/admin/operations",
  },
} as const;

type AdminSection = keyof typeof SECTION_COPY;

const Admin = () => {
  const [active, setActive] = useState<AdminSection>("overview");
  const section = SECTION_COPY[active];

  return (
    <AdminShell
      active={active}
      onNavigate={(nextSection) =>
        setActive(nextSection as AdminSection)
      }
    >
      <BusinessDataUnavailable
        title={section.title}
        description={section.description}
        capability={section.capability}
      />
    </AdminShell>
  );
};

export default Admin;
