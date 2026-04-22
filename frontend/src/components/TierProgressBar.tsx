import LoyaltyBadge from "@/components/LoyaltyBadge";
import { Trophy } from "lucide-react";

interface TierProgressBarProps {
  tier: string;
  totalOrders: number;
  nextTier: "silver" | "gold" | null;
  nextTierThreshold: number | null;
  ordersToNextTier: number;
  nextTierDiscount: number | null;
  currentTierDiscount: number;
  currentTierMin: number;
  progressPercent: number;
  compact?: boolean;
}

function formatTierLabel(value: string | null) {
  if (!value) return "";
  if (value === "none") return "Standard";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function TierProgressBar({
  tier,
  totalOrders,
  nextTier,
  nextTierThreshold,
  ordersToNextTier,
  nextTierDiscount,
  currentTierDiscount,
  currentTierMin,
  progressPercent,
  compact = false,
}: TierProgressBarProps) {
  const currentTierLabel = formatTierLabel(tier);
  const nextTierLabel = formatTierLabel(nextTier);
  const safeProgress = Math.max(0, Math.min(100, progressPercent));

  if (tier === "gold" || !nextTier || !nextTierThreshold) {
    return (
      <div className={`${compact ? "p-3" : "p-4"} rounded-sm border border-amber-300/50 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-700/50`}>
        <div className="flex items-center gap-2">
          <LoyaltyBadge tier="gold" size={compact ? "sm" : "md"} />
          <div className="relative overflow-hidden rounded-sm">
            <p className={`${compact ? "text-xs" : "text-sm"} font-body text-amber-700 dark:text-amber-300 flex items-center gap-1`}>
              <Trophy size={compact ? 12 : 14} />
              You've reached our highest tier!
            </p>
            {!compact && (
              <div className="pointer-events-none absolute inset-0 opacity-70">
                <span className="absolute left-2 top-0 h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce" />
                <span className="absolute left-8 top-1 h-1.5 w-1.5 rounded-full bg-yellow-300 animate-pulse" />
                <span className="absolute right-10 top-0 h-1.5 w-1.5 rounded-full bg-amber-500 animate-bounce" />
                <span className="absolute right-4 top-1 h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${compact ? "p-3" : "p-4"} rounded-sm bg-secondary/30 space-y-3`}>
      <div className="flex items-center justify-between gap-3">
        <LoyaltyBadge tier={tier} size={compact ? "sm" : "md"} />
        {!compact && (
          <p className="font-body text-xs text-muted-foreground">
            Current discount: {currentTierDiscount}%
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between font-body text-xs uppercase tracking-wider text-muted-foreground">
          <span>{currentTierLabel}</span>
          <span>{nextTierLabel}</span>
        </div>
        <div className="w-full bg-secondary rounded-full h-2">
          <div
            className="bg-amber-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${safeProgress}%` }}
          />
        </div>
      </div>

      <div className="space-y-1">
        <p className={`${compact ? "text-[11px]" : "text-xs"} font-body text-muted-foreground`}>
          {totalOrders}/{nextTierThreshold} orders - {ordersToNextTier} more to reach {nextTierLabel}
        </p>
        {!compact && (
          <p className="font-body text-xs text-foreground">
            Unlock {nextTierDiscount}% discount on all orders
          </p>
        )}
        {compact && (
          <p className="font-body text-[11px] text-muted-foreground">
            Range: {currentTierMin} to {nextTierThreshold} orders
          </p>
        )}
      </div>
    </div>
  );
}
