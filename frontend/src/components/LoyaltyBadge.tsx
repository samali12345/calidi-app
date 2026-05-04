import { Award } from "lucide-react";

interface LoyaltyBadgeProps {
  tier: string;
  size?: "sm" | "md" | "lg";
}

const tierStyles: Record<string, { bg: string; text: string; label: string }> = {
  none: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-500 dark:text-gray-400", label: "Standard" },
  silver: { bg: "bg-gray-200 dark:bg-gray-700", text: "text-gray-600 dark:text-gray-300", label: "Silver" },
  gold: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-600 dark:text-amber-400", label: "Gold" },
};

const sizes = {
  sm: "text-xs px-1.5 py-0.5 gap-1",
  md: "text-sm px-2 py-1 gap-1.5",
  lg: "text-base px-3 py-1.5 gap-2",
};

const iconSizes = { sm: 10, md: 14, lg: 18 };

export default function LoyaltyBadge({ tier, size = "md" }: LoyaltyBadgeProps) {
  const style = tierStyles[tier] || tierStyles.none;
  return (
    <span className={`inline-flex items-center rounded-sm font-body font-medium ${style.bg} ${style.text} ${sizes[size]}`}>
      <Award size={iconSizes[size]} />
      {style.label}
    </span>
  );
}
