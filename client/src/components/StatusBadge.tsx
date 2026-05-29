import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; className: string }> = {
  "Not Started":       { label: "Not Started",  className: "status-not-started" },
  "In Progress":       { label: "In Progress",  className: "status-due-soon" },
  "Done":              { label: "Done",          className: "status-on-track" },
  "Sent to Client":    { label: "Sent",          className: "badge-sent" },
  "Uploaded to Onehub":{ label: "On Onehub",    className: "badge-uploaded" },
};

export default function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? { label: status, className: "status-not-started" };
  return (
    <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold", config.className)}>
      {config.label}
    </span>
  );
}
