interface BusinessDataUnavailableProps {
  title: string;
  description: string;
  capability: string;
}

const BusinessDataUnavailable = ({
  title,
  description,
  capability,
}: BusinessDataUnavailableProps) => (
  <section
    aria-labelledby="business-data-unavailable-title"
    className="rounded-[10px] border border-[#E5E5E5] bg-white p-8"
  >
    <div className="inline-flex rounded-full bg-[#FFB703]/10 px-3 py-1 text-xs font-semibold text-[#8A6200]">
      Protected business data boundary
    </div>

    <h1
      id="business-data-unavailable-title"
      className="mt-4 text-2xl font-bold tracking-tight text-midnight"
    >
      {title}
    </h1>

    <p className="mt-3 max-w-2xl text-sm leading-6 text-[#666]">
      {description}
    </p>

    <div
      role="note"
      className="mt-6 rounded-md border border-dashed border-[#D8D8D8] bg-offwhite p-4"
    >
      <div className="text-sm font-semibold text-midnight">
        No business records are displayed
      </div>
      <p className="mt-1 text-sm leading-6 text-[#666]">
        This capability remains disabled until authenticated server APIs,
        resource-level authorization, persistence, and audit logging are
        connected and validated.
      </p>
    </div>

    <dl className="mt-6">
      <dt className="text-xs font-semibold uppercase tracking-wide text-[#888]">
        Required backend capability
      </dt>
      <dd className="mt-1 text-sm font-medium text-midnight">{capability}</dd>
    </dl>
  </section>
);

export default BusinessDataUnavailable;
