import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const StatCard = ({
  label, value, icon: Icon, tone = "default", hint,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "destructive" | "accent";
  hint?: string;
}) => {
  const toneMap = {
    default: "bg-secondary text-secondary-foreground",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    destructive: "bg-destructive/15 text-destructive",
    accent: "bg-accent/20 text-accent-foreground",
  };
  return (
    <div className="stat-card flex items-start justify-between gap-4">
      <div>
        <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
        <div className="font-display text-3xl mt-2">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </div>
      {Icon && (
        <div className={cn("h-10 w-10 rounded-lg grid place-items-center", toneMap[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      )}
    </div>
  );
};
