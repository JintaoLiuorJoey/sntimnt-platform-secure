import AppShell from "@/components/AppShell";

interface PlaceholderProps {
  title: string;
  description: string;
}

const Placeholder = ({ title, description }: PlaceholderProps) => (
  <AppShell>
    <div className="max-w-3xl mx-auto py-16 text-center">
      <h1 className="text-2xl font-bold text-midnight mb-3">{title}</h1>
      <p className="text-[hsl(var(--body-text))]">{description}</p>
    </div>
  </AppShell>
);

export const Performance = () => (
  <Placeholder
    title="Performance"
    description="Detailed performance analytics will appear here."
  />
);

export const SignalLog = () => (
  <Placeholder
    title="Signal Log"
    description="A complete history of signals will appear here."
  />
);

export const Profile = () => (
  <Placeholder
    title="Profile"
    description="Your account details and preferences will appear here."
  />
);
