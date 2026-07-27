import { runtimeConfig } from "@/config/runtime";

const DemoModeBanner = () => {
  if (!runtimeConfig.isMock) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[100] bg-amber-300 px-3 py-1 text-center text-xs font-bold text-black"
    >
      DEMO MODE — fictional data only — do not enter real personal, banking, or investment data
    </div>
  );
};

export default DemoModeBanner;
