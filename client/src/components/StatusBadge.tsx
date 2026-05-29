import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; className: string }> = {
  "Upcoming":          { label: "Upcoming",          className: "status-overdue" },
  "Scheduled":         { label: "Scheduled",         className: "status-on-track" },
  "Pending Response":  { label: "Pending Response",  className: "status-due-soon" },
  "Completed":         { label: "Completed",         className: "status-not-started" },
};

export default function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? { label: status, className: "status-not-started" };
  return (
    <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold", config.className)}>
      {config.label}
    </span>
  );
}
