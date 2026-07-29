import { useNavigate } from "react-router";
import AdminShell from "@/components/AdminShell";
import BusinessDataUnavailable from "@/components/BusinessDataUnavailable";

const AdminInvestor = () => {
  const navigate = useNavigate();

  return (
    <AdminShell
      active="investors"
      onNavigate={() => navigate("/admin")}
    >
      <button
        type="button"
        onClick={() => navigate("/admin")}
        className="mb-4 text-sm font-medium text-[#666] transition hover:text-midnight"
      >
        ← Return to administration
      </button>

      <BusinessDataUnavailable
        title="Investor account data unavailable"
        description="Investor profiles, deposits, recurring schedules, banking details, withdrawals, returns, and notes are not available until the secure business API and resource-level authorization layer are implemented."
        capability="GET /api/admin/investors/{investorId}"
      />
    </AdminShell>
  );
};

export default AdminInvestor;
