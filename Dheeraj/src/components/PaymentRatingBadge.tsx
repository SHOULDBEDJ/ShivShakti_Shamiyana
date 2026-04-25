import { useI18n } from "@/context/I18nContext";
import { cn } from "@/lib/utils";

export type Rating = "green" | "orange" | "red" | null | undefined;

type Props = {
  rating: Rating;
  size?: "sm" | "md";
  showLabel?: boolean;
  reason?: string | null;
  className?: string;
};

const styles: Record<string, string> = {
  green: "bg-success/15 text-success border-success/30",
  orange: "bg-warning/20 text-warning-foreground border-warning/40",
  red: "bg-destructive/15 text-destructive border-destructive/30",
};

const dot: Record<string, string> = {
  green: "bg-success",
  orange: "bg-warning",
  red: "bg-destructive",
};

export const PaymentRatingBadge = ({ rating, size = "sm", showLabel = true, reason, className }: Props) => {
  const { t } = useI18n();
  if (!rating) return null;
  const labelKey = rating === "green" ? "ratingGreen" : rating === "orange" ? "ratingOrange" : "ratingRed";
  return (
    <span
      title={reason || ""}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        styles[rating],
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot[rating])} />
      {showLabel && t(labelKey)}
    </span>
  );
};
