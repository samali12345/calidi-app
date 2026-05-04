import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Package,
  Truck,
  CheckCircle,
  XCircle,
  RotateCcw,
  Clock,
  MapPin,
  Phone,
  Users,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { Delivery, Rider } from "@/lib/types";

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  pending_pickup: { icon: <Package size={12} />, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400", label: "Pending Pickup" },
  in_transit: { icon: <Truck size={12} />, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400", label: "In Transit" },
  delivered: { icon: <CheckCircle size={12} />, color: "text-green-600 bg-green-50 dark:bg-green-950/30 dark:text-green-400", label: "Delivered" },
  failed: { icon: <XCircle size={12} />, color: "text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400", label: "Failed" },
  returned: { icon: <RotateCcw size={12} />, color: "text-gray-500 bg-gray-50 dark:bg-gray-900/30 dark:text-gray-400", label: "Returned" },
};

const statusFilters = ["all", "pending_pickup", "in_transit", "delivered", "failed", "returned"];
const statusLabels: Record<string, string> = {
  all: "All",
  pending_pickup: "Pending",
  in_transit: "In Transit",
  delivered: "Delivered",
  failed: "Failed",
  returned: "Returned",
};

const nextStatusMap: Record<string, string[]> = {
  pending_pickup: ["in_transit", "failed"],
  in_transit: ["delivered", "failed"],
  failed: ["pending_pickup", "returned"],
  delivered: [],
  returned: [],
};

interface DeliveryStats {
  byStatus: Record<string, number>;
  byMethod: Record<string, number>;
  totalDeliveries: number;
  totalFees: number;
}

const getRiderDisplayName = (rider: Rider) =>
  rider.name?.trim() || rider.email || "Unnamed Rider";

export default function DeliveriesPage() {
  const { token } = useAuth();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DeliveryStats | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [liveLocationInput, setLiveLocationInput] = useState("");
  const [liveEtaInput, setLiveEtaInput] = useState("");
  const [liveNoteInput, setLiveNoteInput] = useState("");
  const [liveUpdatingId, setLiveUpdatingId] = useState<string | null>(null);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [unassignedDeliveries, setUnassignedDeliveries] = useState<Delivery[]>([]);
  const [loadingRiders, setLoadingRiders] = useState(false);
  const [assigningRiderId, setAssigningRiderId] = useState<string | null>(null);
  const [assignModalRider, setAssignModalRider] = useState<Rider | null>(null);

  const fetchDeliveries = async (options?: { silent?: boolean }) => {
    if (!token) return;
    if (!options?.silent) {
      setLoading(true);
    }
    try {
      const statusParam = filter !== "all" ? `&status=${filter}` : "";
      const data = await apiFetch<{ deliveries: Delivery[]; total: number }>(
        `/admin/deliveries?page=${page}${statusParam}`,
        { token }
      );
      setDeliveries(data.deliveries);
      setTotal(data.total);
    } catch {
      toast.error("Failed to load deliveries");
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  };

  const fetchStats = async () => {
    if (!token) return;
    try {
      const data = await apiFetch<DeliveryStats>("/admin/deliveries/stats", { token });
      setStats(data);
    } catch {
      // ignore
    }
  };

  const handleStatusUpdate = async (deliveryId: string, newStatus: string) => {
    if (!token) return;
    try {
      await apiFetch(`/admin/deliveries/${deliveryId}/status`, {
        method: "PUT",
        token,
        body: {
          status: newStatus,
          note: statusNote,
        },
      });
      toast.success(`Delivery updated to ${statusConfig[newStatus]?.label || newStatus}`);
      setStatusNote("");
      setExpandedId(null);
      fetchDeliveries();
      fetchStats();
    } catch (err: any) {
      toast.error(err.message || "Failed to update delivery");
    }
  };

  const handleLiveUpdate = async (
    deliveryId: string,
    options?: { allowNoteOnly?: boolean }
  ) => {
    if (!token) return;
    const hasLocation = liveLocationInput.trim().length > 0;
    const hasEta = liveEtaInput.trim().length > 0;
    const hasNote = liveNoteInput.trim().length > 0;

    if (!hasLocation && !hasEta && !(options?.allowNoteOnly && hasNote)) {
      toast.error("Add current location, ETA, or note");
      return;
    }

    try {
      setLiveUpdatingId(deliveryId);
      const response = await apiFetch<any>(`/admin/deliveries/${deliveryId}/live`, {
        method: "PUT",
        token,
        body: {
          currentLocation: hasLocation ? liveLocationInput.trim() : undefined,
          etaMinutes: hasEta ? Number(liveEtaInput) : undefined,
          note: liveNoteInput.trim() || undefined,
        },
      });
      toast.success("Live delivery info updated");
      const geocode = response?.geocodeSummary;
      if (hasLocation && geocode && !geocode.currentResolved) {
        toast.warning(geocode.currentMessage || "Location saved, but map coordinates were not resolved.");
      }
      if (geocode && !geocode.destinationResolved && geocode.destinationMessage) {
        toast.warning(geocode.destinationMessage);
      }
      setLiveLocationInput("");
      setLiveEtaInput("");
      setLiveNoteInput("");
      fetchDeliveries();
    } catch (err: any) {
      toast.error(err.message || "Failed to update live delivery info");
    } finally {
      setLiveUpdatingId(null);
    }
  };

  const handleAssignRider = async (deliveryId: string, riderId: string) => {
    if (!token || !riderId) return;
    try {
      setAssigningRiderId(deliveryId);
      await apiFetch(`/admin/deliveries/${deliveryId}/assign-rider`, {
        method: "POST",
        token,
        body: { riderId },
      });
      toast.success("Rider assigned");
      fetchDeliveries();
      fetchRiders();
      fetchUnassignedDeliveries();
    } catch (err: any) {
      toast.error(err.message || "Failed to assign rider");
    } finally {
      setAssigningRiderId(null);
    }
  };

  const handleRiderApproval = async (
    riderId: string,
    status: "approved" | "rejected"
  ) => {
    if (!token) return;
    try {
      await apiFetch(`/admin/riders/${riderId}/approval`, {
        method: "PUT",
        token,
        body: { status },
      });
      toast.success(`Rider ${status}`);
      fetchRiders();
    } catch (err: any) {
      toast.error(err.message || "Failed to update rider approval");
    }
  };

  const fetchRiders = async (options?: { silent?: boolean }) => {
    if (!token) return;
    if (!options?.silent) {
      setLoadingRiders(true);
    }
    try {
      const data = await apiFetch<Rider[]>("/admin/riders", { token });
      setRiders(data);
    } catch {
      toast.error("Failed to load riders");
    } finally {
      if (!options?.silent) {
        setLoadingRiders(false);
      }
    }
  };

  const fetchUnassignedDeliveries = async () => {
    if (!token) return;
    try {
      const data = await apiFetch<{ deliveries: Delivery[]; total: number }>(
        "/admin/deliveries?page=1&limit=200&status=pending_pickup",
        { token }
      );
      setUnassignedDeliveries(
        data.deliveries.filter(
          (delivery) =>
            !delivery.riderId ||
            (typeof delivery.riderId === "object" &&
              Object.keys(delivery.riderId || {}).length === 0)
        )
      );
    } catch {
      setUnassignedDeliveries([]);
    }
  };

  useEffect(() => {
    fetchDeliveries();
    fetchStats();
    fetchRiders();
    fetchUnassignedDeliveries();
  }, [token, page, filter]);

  useEffect(() => {
    if (!token) return;
    const intervalId = window.setInterval(() => {
      fetchDeliveries({ silent: true });
      fetchRiders({ silent: true });
    }, 15000);
    return () => window.clearInterval(intervalId);
  }, [token, page, filter]);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-wider text-foreground">
        Delivery Dashboard
      </h1>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="border border-border rounded-sm p-4">
            <p className="font-body text-xs uppercase tracking-wider text-muted-foreground">Total Deliveries</p>
            <p className="font-display text-2xl text-foreground">{stats.totalDeliveries}</p>
          </div>
          <div className="border border-border rounded-sm p-4">
            <p className="font-body text-xs uppercase tracking-wider text-muted-foreground">Pending Pickup</p>
            <p className="font-display text-2xl text-amber-600">{stats.byStatus.pending_pickup || 0}</p>
          </div>
          <div className="border border-border rounded-sm p-4">
            <p className="font-body text-xs uppercase tracking-wider text-muted-foreground">In Transit</p>
            <p className="font-display text-2xl text-blue-600">{stats.byStatus.in_transit || 0}</p>
          </div>
          <div className="border border-border rounded-sm p-4">
            <p className="font-body text-xs uppercase tracking-wider text-muted-foreground">Delivered</p>
            <p className="font-display text-2xl text-green-600">{stats.byStatus.delivered || 0}</p>
          </div>
        </div>
      )}

      {/* Riders Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-muted-foreground" />
          <h2 className="font-display text-lg tracking-wider text-foreground">Riders</h2>
        </div>
        {loadingRiders ? (
          <p className="font-body text-sm text-muted-foreground">Loading riders...</p>
        ) : riders.length === 0 ? (
          <p className="font-body text-sm text-muted-foreground border border-border rounded-sm p-4">
            No riders found
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {riders.map((rider) => {
              const isBusy = !!rider.activeDelivery;
              const approval = rider.riderApprovalStatus || "none";
              const statusLabel =
                approval === "pending"
                  ? "Pending Approval"
                  : approval === "rejected"
                  ? "Rejected"
                  : isBusy
                  ? "Busy"
                  : rider.isAvailable
                  ? "Available"
                  : "Offline";
              const statusClass =
                approval === "pending"
                  ? "text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400"
                  : approval === "rejected"
                  ? "text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400"
                  : isBusy
                  ? "text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400"
                  : rider.isAvailable
                  ? "text-green-600 bg-green-50 dark:bg-green-950/30 dark:text-green-400"
                  : "text-gray-600 bg-gray-50 dark:bg-gray-900/30 dark:text-gray-400";

              return (
                <div key={rider._id} className="border border-border rounded-sm p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-body text-sm font-medium text-foreground">
                        {getRiderDisplayName(rider)}
                      </p>
                      <p className="font-body text-xs text-muted-foreground">
                        {rider.email}
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-body ${statusClass}`}>
                      {statusLabel}
                    </span>
                  </div>

                  <p className="font-body text-xs text-muted-foreground">
                    Phone: {rider.phone || rider.mobileNumber || "N/A"}
                  </p>
                  <p className="font-body text-xs text-muted-foreground">
                    Vehicle: {rider.vehicleType || "bike"}
                  </p>

                  {rider.activeDelivery ? (
                    <div className="space-y-1">
                      <p className="font-body text-xs text-muted-foreground">
                        Active: {rider.activeDelivery.deliveryAddress?.city},{" "}
                        {rider.activeDelivery.deliveryAddress?.state}
                      </p>
                      <p className="font-body text-xs text-muted-foreground">
                        Last location update:{" "}
                        {rider.activeDelivery.liveUpdatedAt
                          ? new Date(rider.activeDelivery.liveUpdatedAt).toLocaleString()
                          : "N/A"}
                      </p>
                    </div>
                  ) : (
                    <p className="font-body text-xs text-muted-foreground">
                      No active delivery
                    </p>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    {approval === "pending" && (
                      <>
                        <Button
                          size="sm"
                          className="rounded-sm font-body text-xs bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleRiderApproval(rider._id, "approved")}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          className="rounded-sm font-body text-xs bg-red-600 hover:bg-red-700 text-white"
                          onClick={() => handleRiderApproval(rider._id, "rejected")}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {approval === "rejected" && (
                      <Button
                        size="sm"
                        className="rounded-sm font-body text-xs bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleRiderApproval(rider._id, "approved")}
                      >
                        Re-Approve
                      </Button>
                    )}
                    {approval === "approved" && !isBusy && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-sm font-body text-xs"
                        onClick={() => setAssignModalRider(rider)}
                      >
                        Assign to Delivery
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Status Filters */}
      <div className="flex gap-2 flex-wrap">
        {statusFilters.map((s) => (
          <button
            key={s}
            onClick={() => {
              setFilter(s);
              setPage(1);
            }}
            className={`font-body text-xs uppercase tracking-wider px-3 py-1.5 rounded-sm transition-colors ${
              filter === s
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {statusLabels[s]}
          </button>
        ))}
      </div>

      <p className="font-body text-sm text-muted-foreground">{total} deliveries</p>

      {loading ? (
        <p className="font-body text-muted-foreground py-8 text-center">Loading...</p>
      ) : deliveries.length === 0 ? (
        <p className="font-body text-muted-foreground py-8 text-center">No deliveries found</p>
      ) : (
        <div className="space-y-4">
	          {deliveries.map((delivery) => {
	            const sc = statusConfig[delivery.status] || statusConfig.pending_pickup;
	            const isExpanded = expandedId === delivery.deliveryId;
	            const nextStatuses = nextStatusMap[delivery.status] || [];
	            const assignedRiderName =
	              typeof delivery.riderId === "object" && delivery.riderId
	                ? delivery.riderId.name || delivery.riderId.email || "Assigned rider"
	                : "Unassigned";
	
	            return (
	              <div key={delivery.deliveryId} className="border border-border rounded-sm overflow-hidden">
                {/* Summary Row */}
                <div
                  className="p-4 flex items-center gap-4 cursor-pointer hover:bg-secondary/10"
                  onClick={() => setExpandedId(isExpanded ? null : delivery.deliveryId)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-body text-sm font-medium text-foreground">{delivery.deliveryId}</p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-body ${sc.color}`}>
                        {sc.icon} {sc.label}
                      </span>
                    </div>
	                    <p className="font-body text-xs text-muted-foreground">
	                      Order: {delivery.orderId} Â· {delivery.recipientName}
	                    </p>
	                    <p className="font-body text-xs text-muted-foreground">
	                      Rider: {assignedRiderName}
	                    </p>
	                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-body text-sm text-foreground">
                      {delivery.deliveryAddress.city}
                    </p>
                    <p className="font-body text-xs text-muted-foreground">
                      {delivery.deliveryMethod} Â· {delivery.itemCount} item{delivery.itemCount > 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-body text-xs text-muted-foreground">
                      {new Date(delivery.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-border p-4 bg-secondary/5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h3 className="font-body text-xs uppercase tracking-wider text-muted-foreground font-medium">
                          Delivery Details
                        </h3>
                        <div className="space-y-1 font-body text-sm">
                          <div className="flex items-center gap-2">
                            <Package size={14} className="text-muted-foreground" />
                            <span>{delivery.recipientName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone size={14} className="text-muted-foreground" />
                            <span>{delivery.contactNumber || "N/A"}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <MapPin size={14} className="text-muted-foreground shrink-0 mt-0.5" />
                            <span>
                              {delivery.deliveryAddress.street}, {delivery.deliveryAddress.city},{" "}
                              {delivery.deliveryAddress.state} {delivery.deliveryAddress.zip}
                            </span>
                          </div>
                          {delivery.scheduledDate && (
                            <div className="flex items-center gap-2">
                              <Clock size={14} className="text-muted-foreground" />
                              <span>
                                {new Date(delivery.scheduledDate).toLocaleDateString()} -{" "}
                                {delivery.scheduledTimeSlot}
                              </span>
                            </div>
                          )}
                          {delivery.deliveryNotes && (
                            <p className="text-xs text-muted-foreground italic mt-1">
                              Notes: {delivery.deliveryNotes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h3 className="font-body text-xs uppercase tracking-wider text-muted-foreground font-medium">
                          Status History
                        </h3>
                        <div className="space-y-2">
                          {delivery.statusHistory
                            .slice()
                            .reverse()
                            .map((entry, i) => {
                              const eSc = statusConfig[entry.status] || statusConfig.pending_pickup;
                              return (
                                <div key={i} className="flex items-start gap-2 font-body text-xs">
                                  <span className={eSc.color}>{eSc.icon}</span>
                                  <div>
                                    <span className="text-foreground font-medium">{eSc.label}</span>
                                    <span className="text-muted-foreground ml-2">
                                      {new Date(entry.timestamp).toLocaleString()}
                                    </span>
                                    {entry.note && (
                                      <p className="text-muted-foreground">{entry.note}</p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
	                    </div>

	                    <Separator />

	                    <div className="space-y-2">
	                      <h3 className="font-body text-xs uppercase tracking-wider text-muted-foreground font-medium">
	                        Assigned Rider
	                      </h3>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const assignedRiderId =
                            typeof delivery.riderId === "object" && delivery.riderId?._id
                              ? delivery.riderId._id
                              : typeof delivery.riderId === "string"
                              ? delivery.riderId
                              : "";
                          const assignableRiders = riders.filter((rider) => {
                            if (rider.riderApprovalStatus !== "approved") return false;
                            const riderHasActive = Boolean(rider.activeDelivery);
                            if (!riderHasActive) return true;
                            return rider._id === assignedRiderId;
                          });
                          return (
	                        <select
	                          className="w-full h-10 px-3 rounded-sm border border-input bg-background font-body text-sm"
	                          value={
	                            typeof delivery.riderId === "object" && delivery.riderId?._id
	                              ? delivery.riderId._id
	                              : typeof delivery.riderId === "string"
	                              ? delivery.riderId
	                              : ""
	                          }
	                          onChange={(e) =>
	                            e.target.value &&
	                            handleAssignRider(delivery.deliveryId, e.target.value)
	                          }
	                          disabled={assigningRiderId === delivery.deliveryId}
	                        >
                          <option value="">Unassigned</option>
                          {assignableRiders.map((rider) => (
                            <option key={rider._id} value={rider._id}>
                              {getRiderDisplayName(rider)}
                            </option>
                            ))}
                        </select>
                          );
                        })()}
                      </div>
                    </div>
	
	                    {delivery.deliveredAt && (
	                      <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-sm p-3">
                        <p className="font-body text-sm text-green-700 dark:text-green-400">
                          Delivered on{" "}
                          {new Date(delivery.deliveredAt).toLocaleString()}
                        </p>
                        {delivery.proofOfDelivery && (
                          <p className="font-body text-xs text-green-600 mt-1">
                            Proof: {delivery.proofOfDelivery}
                          </p>
                        )}
                      </div>
                    )}

                    {(delivery.status === "in_transit" ||
                      delivery.currentLocation ||
                      delivery.etaMinutes !== null ||
                      (delivery.currentLat !== null && delivery.currentLng !== null)) && (
                      <>
                        <Separator />
                        <div className="space-y-3">
                          <h3 className="font-body text-xs uppercase tracking-wider text-muted-foreground font-medium">
                            Live Tracking (Phase 3)
                          </h3>

                          {(delivery.currentLocation ||
                            delivery.etaMinutes !== null ||
                            (delivery.currentLat !== null && delivery.currentLng !== null)) && (
                            <p className="font-body text-xs text-muted-foreground">
                              Current: {delivery.currentLocation || "N/A"}
                              {" · "}
                              ETA: {delivery.etaMinutes !== null ? `${delivery.etaMinutes} min` : "N/A"}
                              {delivery.currentLat !== null && delivery.currentLng !== null && (
                                <>
                                  {" · "}
                                  Coords: {delivery.currentLat.toFixed(5)}, {delivery.currentLng.toFixed(5)}
                                </>
                              )}
                            </p>
                          )}

                          {delivery.riderId ? (
                            <p className="font-body text-xs text-muted-foreground">
                              Rider-managed tracking: location and ETA are updated automatically by rider.
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                              <Input
                                value={liveLocationInput}
                                onChange={(e) => setLiveLocationInput(e.target.value)}
                                placeholder="Current location (e.g., Colombo Fort)"
                                className="rounded-sm font-body text-sm"
                              />
                              <Input
                                value={liveEtaInput}
                                onChange={(e) => setLiveEtaInput(e.target.value)}
                                placeholder="ETA minutes"
                                type="number"
                                min={0}
                                className="rounded-sm font-body text-sm"
                              />
                            </div>
                          )}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <Input
                              value={liveNoteInput}
                              onChange={(e) => setLiveNoteInput(e.target.value)}
                              placeholder="Live note (optional)"
                              className="rounded-sm font-body text-sm"
                            />
                          </div>
                          <div>
                            <Button
                              size="sm"
                              onClick={() =>
                                handleLiveUpdate(delivery.deliveryId, {
                                  allowNoteOnly: Boolean(delivery.riderId),
                                })
                              }
                              disabled={liveUpdatingId === delivery.deliveryId}
                              className="rounded-sm font-body text-xs"
                            >
                              {liveUpdatingId === delivery.deliveryId
                                ? "Updating..."
                                : delivery.riderId
                                ? "Send Note"
                                : "Update Live Info"}
                            </Button>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Status Update Actions */}
                    {nextStatuses.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-3">
                          <h3 className="font-body text-xs uppercase tracking-wider text-muted-foreground font-medium">
                            Update Status
                          </h3>
                          <div className="flex gap-2">
                            <Input
                              value={statusNote}
                              onChange={(e) => setStatusNote(e.target.value)}
                              placeholder="Status note (optional)"
                              className="rounded-sm font-body text-sm flex-1"
                            />
                          </div>
                          <div className="flex gap-2">
                            {nextStatuses.map((ns) => {
                              const nsSc = statusConfig[ns];
                              return (
                                <Button
                                  key={ns}
                                  size="sm"
                                  onClick={() => handleStatusUpdate(delivery.deliveryId, ns)}
                                  className={`rounded-sm font-body text-xs ${
                                    ns === "delivered"
                                      ? "bg-green-600 hover:bg-green-700 text-white"
                                      : ns === "failed" || ns === "returned"
                                      ? "bg-red-600 hover:bg-red-700 text-white"
                                      : ""
                                  }`}
                                >
                                  {nsSc?.label || ns}
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          className="rounded-sm font-body text-xs"
        >
          Previous
        </Button>
        <span className="font-body text-sm text-muted-foreground self-center">Page {page}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={deliveries.length < 20}
          onClick={() => setPage(page + 1)}
          className="rounded-sm font-body text-xs"
        >
          Next
        </Button>
      </div>

      {assignModalRider && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setAssignModalRider(null)}
        >
          <div
            className="bg-background border border-border rounded-sm w-full max-w-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg tracking-wider text-foreground">
                Assign Delivery to {getRiderDisplayName(assignModalRider)}
              </h3>
              <Button
                size="sm"
                variant="outline"
                className="rounded-sm font-body text-xs"
                onClick={() => setAssignModalRider(null)}
              >
                Close
              </Button>
            </div>
            {assignModalRider.activeDelivery ? (
              <p className="font-body text-sm text-muted-foreground">
                This rider already has an active delivery and cannot be assigned another.
              </p>
            ) : unassignedDeliveries.length === 0 ? (
              <p className="font-body text-sm text-muted-foreground">
                No unassigned pending deliveries
              </p>
            ) : (
              <div className="space-y-3">
                {unassignedDeliveries.map((delivery) => (
                  <div
                    key={delivery.deliveryId}
                    className="border border-border rounded-sm p-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-body text-sm text-foreground">
                        {delivery.deliveryId}
                      </p>
                      <p className="font-body text-xs text-muted-foreground">
                        {delivery.deliveryAddress.city}, {delivery.deliveryAddress.state} ·{" "}
                        {delivery.itemCount} item{delivery.itemCount > 1 ? "s" : ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="rounded-sm font-body text-xs"
                      onClick={async () => {
                        await handleAssignRider(
                          delivery.deliveryId,
                          assignModalRider._id
                        );
                        setAssignModalRider(null);
                      }}
                    >
                      Assign
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


