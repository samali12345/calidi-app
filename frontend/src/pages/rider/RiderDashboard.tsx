import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import type {
  Delivery,
  RiderEarning,
  RiderWallet,
  RiderWalletSummary,
} from "@/lib/types";
import { Truck, Clock, Package, MapPin, Phone } from "lucide-react";

type RiderTab = "active" | "history";

const statusBadge: Record<string, string> = {
  pending_pickup:
    "text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400",
  in_transit: "text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400",
  delivered:
    "text-green-600 bg-green-50 dark:bg-green-950/30 dark:text-green-400",
  failed: "text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400",
  returned: "text-gray-600 bg-gray-50 dark:bg-gray-900/30 dark:text-gray-400",
};

export default function RiderDashboard() {
  const { user, token, loading, refreshUser } = useAuth();
  const [tab, setTab] = useState<RiderTab>("active");
  const [activeDelivery, setActiveDelivery] = useState<Delivery | null>(null);
  const [availableJobs, setAvailableJobs] = useState<Delivery[]>([]);
  const [history, setHistory] = useState<Delivery[]>([]);
  const [wallet, setWallet] = useState<RiderWallet | null>(null);
  const [walletSummary, setWalletSummary] = useState<RiderWalletSummary | null>(null);
  const [earnings, setEarnings] = useState<RiderEarning[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [vehicleTypeSaving, setVehicleTypeSaving] = useState(false);
  const [vehicleTypeInput, setVehicleTypeInput] = useState<
    "bike" | "threewheel" | "van"
  >("bike");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [etaInput, setEtaInput] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [deliveryProof, setDeliveryProof] = useState("");
  const [gpsTrackingState, setGpsTrackingState] = useState<
    "idle" | "tracking" | "unsupported" | "denied" | "error"
  >("idle");

  const geoWatchIdRef = useRef<number | null>(null);
  const autoSyncTimerRef = useRef<number | null>(null);
  const latestCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastAutoSyncAtRef = useRef(0);
  const gpsStartedToastShownRef = useRef(false);

  const canMarkPickedUp = activeDelivery?.status === "pending_pickup";
  const canMarkDelivered = activeDelivery?.status === "in_transit";
  const mapsDirectionsUrl = useMemo(() => {
    if (!activeDelivery) return "";

    if (
      activeDelivery.destinationLat !== null &&
      activeDelivery.destinationLng !== null
    ) {
      return `https://www.google.com/maps/dir/?api=1&destination=${activeDelivery.destinationLat},${activeDelivery.destinationLng}&travelmode=driving`;
    }

    const destinationText = [
      activeDelivery.deliveryAddress?.street,
      activeDelivery.deliveryAddress?.city,
      activeDelivery.deliveryAddress?.state,
      activeDelivery.deliveryAddress?.zip,
      activeDelivery.deliveryAddress?.country,
    ]
      .filter(Boolean)
      .join(", ");

    if (!destinationText) return "";
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      destinationText
    )}&travelmode=driving`;
  }, [activeDelivery]);

  const fetchData = async () => {
    if (!token) return;
    setLoadingData(true);
    try {
      const [active, jobs, mine, walletPayload, earningsList] = await Promise.all([
        apiFetch<Delivery | null>("/rider/active-delivery", { token }),
        apiFetch<Delivery[]>("/rider/available-deliveries", { token }),
        apiFetch<Delivery[]>("/rider/my-deliveries", { token }),
        apiFetch<{ wallet: RiderWallet; summary: RiderWalletSummary }>("/rider/wallet", {
          token,
        }),
        apiFetch<RiderEarning[]>("/rider/earnings?limit=100", { token }),
      ]);
      setActiveDelivery(active);
      setAvailableJobs(jobs);
      setHistory(mine.filter((d) => d.status === "delivered" || d.status === "failed"));
      setWallet(walletPayload.wallet);
      setWalletSummary(walletPayload.summary);
      setEarnings(earningsList);
      if (active) {
        setLocationInput(active.currentLocation || "");
        setEtaInput(active.etaMinutes !== null && active.etaMinutes !== undefined ? String(active.etaMinutes) : "");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load rider dashboard");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  useEffect(() => {
    const current = user?.vehicleType;
    if (current === "bike" || current === "threewheel" || current === "van") {
      setVehicleTypeInput(current);
    } else {
      setVehicleTypeInput("bike");
    }
  }, [user?.vehicleType]);

  const handleAvailabilityToggle = async () => {
    if (!token || !user) return;
    setAvailabilitySaving(true);
    try {
      await apiFetch("/rider/availability", {
        method: "PUT",
        token,
        body: { isAvailable: !user.isAvailable },
      });
      await refreshUser();
      toast.success(`You are now ${!user.isAvailable ? "available" : "unavailable"}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update availability");
    } finally {
      setAvailabilitySaving(false);
    }
  };

  const handleVehicleTypeSave = async () => {
    if (!token) return;
    setVehicleTypeSaving(true);
    try {
      await apiFetch("/rider/vehicle-type", {
        method: "PUT",
        token,
        body: { vehicleType: vehicleTypeInput },
      });
      await refreshUser();
      await fetchData();
      toast.success("Vehicle type updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update vehicle type");
    } finally {
      setVehicleTypeSaving(false);
    }
  };

  const handleAccept = async (deliveryId: string) => {
    if (!token) return;
    try {
      await apiFetch(`/rider/accept/${deliveryId}`, { method: "POST", token });
      toast.success("Delivery accepted");
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to accept delivery");
    }
  };

  const handleUpdateStatus = async (status: "in_transit" | "delivered") => {
    if (!token || !activeDelivery) return;
    if (status === "delivered" && !deliveryProof.trim()) {
      toast.error("Add proof of delivery before marking delivered");
      return;
    }
    setUpdatingStatus(true);
    try {
      await apiFetch(`/rider/update-status/${activeDelivery.deliveryId}`, {
        method: "PUT",
        token,
        body: {
          status,
          note: statusNote,
          proofOfDelivery: status === "delivered" ? deliveryProof.trim() : undefined,
        },
      });
      setStatusNote("");
      if (status === "delivered") {
        setDeliveryProof("");
      }
      toast.success(
        status === "in_transit" ? "Marked as picked up" : "Marked as delivered"
      );
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const pushLocationUpdate = async (options?: {
    silent?: boolean;
    coords?: { lat: number; lng: number } | null;
  }) => {
    if (!token || !activeDelivery) return;
    if (!options?.silent) {
      setUpdatingLocation(true);
    }
    try {
      const body: Record<string, unknown> = {};
      if (!options?.silent) {
        body.currentLocation = locationInput || undefined;
        body.etaMinutes = etaInput !== "" ? Number(etaInput) : undefined;
      }
      if (options?.coords) {
        body.currentLat = options.coords.lat;
        body.currentLng = options.coords.lng;
      }

      const updated = await apiFetch<Delivery>(
        `/rider/update-location/${activeDelivery.deliveryId}`,
        {
          method: "PUT",
          token,
          body,
        }
      );

      setActiveDelivery((prev) =>
        prev
          ? {
              ...prev,
              ...updated,
              orderDetails: prev.orderDetails,
            }
          : prev
      );

      if (!options?.silent) {
        toast.success("Location updated");
      }
    } catch (err: any) {
      if (!options?.silent) {
        toast.error(err.message || "Failed to update location");
      }
    } finally {
      if (!options?.silent) {
        setUpdatingLocation(false);
      }
    }
  };

  const handleUpdateLocation = async () => {
    await pushLocationUpdate();
  };

  useEffect(() => {
    if (!token || !activeDelivery || activeDelivery.status !== "in_transit") {
      if (
        geoWatchIdRef.current !== null &&
        typeof navigator !== "undefined" &&
        navigator.geolocation
      ) {
        navigator.geolocation.clearWatch(geoWatchIdRef.current);
      }
      geoWatchIdRef.current = null;
      if (autoSyncTimerRef.current !== null) {
        window.clearInterval(autoSyncTimerRef.current);
      }
      autoSyncTimerRef.current = null;
      latestCoordsRef.current = null;
      lastAutoSyncAtRef.current = 0;
      gpsStartedToastShownRef.current = false;
      setGpsTrackingState("idle");
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsTrackingState("unsupported");
      return;
    }

    setGpsTrackingState("idle");
    geoWatchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        latestCoordsRef.current = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        if (!gpsStartedToastShownRef.current) {
          gpsStartedToastShownRef.current = true;
          toast.success("GPS live tracking started");
        }
        setGpsTrackingState("tracking");
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setGpsTrackingState("denied");
        } else {
          setGpsTrackingState("error");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 20000,
      }
    );

    const syncNow = async () => {
      const coords = latestCoordsRef.current;
      if (!coords) return;
      const now = Date.now();
      if (now - lastAutoSyncAtRef.current < 15000) return;
      lastAutoSyncAtRef.current = now;
      await pushLocationUpdate({ silent: true, coords });
    };

    syncNow();
    autoSyncTimerRef.current = window.setInterval(syncNow, 15000);

    return () => {
      if (geoWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchIdRef.current);
      }
      geoWatchIdRef.current = null;
      if (autoSyncTimerRef.current !== null) {
        window.clearInterval(autoSyncTimerRef.current);
      }
      autoSyncTimerRef.current = null;
    };
  }, [token, activeDelivery?.deliveryId, activeDelivery?.status]);

  const sortedHistory = useMemo(
    () =>
      [...history].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [history]
  );

  if (loading) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center">
        <p className="font-body text-muted-foreground">Loading...</p>
      </main>
    );
  }

  if (!user) return <Navigate to="/auth" />;
  if (user.role !== "rider") return <Navigate to="/" />;
  if (user.riderApprovalStatus !== "approved") {
    return <Navigate to="/rider/application-status" />;
  }

  return (
    <main className="min-h-[70vh] py-12 px-6">
      <div className="container mx-auto max-w-4xl space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-wider text-foreground">
              Rider Dashboard
            </h1>
            <p className="font-body text-sm text-muted-foreground mt-1">
              {user.name || user.email}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-body text-xs uppercase tracking-widest text-muted-foreground">
              {user.isAvailable ? "Available" : "Unavailable"}
            </span>
            <Button
              variant={user.isAvailable ? "outline" : "default"}
              size="sm"
              disabled={availabilitySaving}
              onClick={handleAvailabilityToggle}
              className="rounded-sm font-body text-xs uppercase tracking-widest"
            >
              {availabilitySaving ? "Saving..." : user.isAvailable ? "Set Unavailable" : "Set Available"}
            </Button>
          </div>
        </div>

        <div className="border border-border rounded-sm p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="font-body text-xs uppercase tracking-widest text-muted-foreground">
              Vehicle Type
            </p>
            <p className="font-body text-xs text-muted-foreground mt-1">
              This controls the live vehicle icon shown to customers.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="h-10 px-3 rounded-sm border border-input bg-background font-body text-sm"
              value={vehicleTypeInput}
              onChange={(e) =>
                setVehicleTypeInput(e.target.value as "bike" | "threewheel" | "van")
              }
            >
              <option value="bike">Bike</option>
              <option value="threewheel">Threewheel</option>
              <option value="van">Van</option>
            </select>
            <Button
              size="sm"
              disabled={vehicleTypeSaving}
              onClick={handleVehicleTypeSave}
              className="rounded-sm font-body text-xs uppercase tracking-widest"
            >
              {vehicleTypeSaving ? "Saving..." : "Save Vehicle"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-border rounded-sm p-5">
            <p className="font-body text-xs uppercase tracking-widest text-muted-foreground">
              Available Jobs
            </p>
            <p className="font-display text-2xl text-foreground mt-2">
              {availableJobs.length}
            </p>
          </div>
          <div className="border border-border rounded-sm p-5">
            <p className="font-body text-xs uppercase tracking-widest text-muted-foreground">
              Active Delivery
            </p>
            <p className="font-display text-2xl text-foreground mt-2">
              {activeDelivery ? activeDelivery.deliveryId.slice(-6) : "None"}
            </p>
          </div>
          <div className="border border-border rounded-sm p-5">
            <p className="font-body text-xs uppercase tracking-widest text-muted-foreground">
              Last Location Update
            </p>
            <p className="font-display text-sm text-foreground mt-3">
              {activeDelivery?.liveUpdatedAt
                ? new Date(activeDelivery.liveUpdatedAt).toLocaleString()
                : "-"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="border border-border rounded-sm p-5">
            <p className="font-body text-xs uppercase tracking-widest text-muted-foreground">
              Wallet Available
            </p>
            <p className="font-display text-2xl text-foreground mt-2">
              LKR {(wallet?.availableBalance || 0).toLocaleString()}
            </p>
          </div>
          <div className="border border-border rounded-sm p-5">
            <p className="font-body text-xs uppercase tracking-widest text-muted-foreground">
              Total Earned
            </p>
            <p className="font-display text-2xl text-foreground mt-2">
              LKR {(wallet?.totalEarned || 0).toLocaleString()}
            </p>
          </div>
          <div className="border border-border rounded-sm p-5">
            <p className="font-body text-xs uppercase tracking-widest text-muted-foreground">
              Today Earnings
            </p>
            <p className="font-display text-2xl text-foreground mt-2">
              LKR {(walletSummary?.todayEarnings || 0).toLocaleString()}
            </p>
          </div>
          <div className="border border-border rounded-sm p-5">
            <p className="font-body text-xs uppercase tracking-widest text-muted-foreground">
              Last Credited
            </p>
            <p className="font-display text-sm text-foreground mt-3">
              {wallet?.lastCreditedAt
                ? new Date(wallet.lastCreditedAt).toLocaleString()
                : "-"}
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setTab("active")}
            className={`font-body text-xs uppercase tracking-wider px-3 py-1.5 rounded-sm transition-colors ${
              tab === "active"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setTab("history")}
            className={`font-body text-xs uppercase tracking-wider px-3 py-1.5 rounded-sm transition-colors ${
              tab === "history"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            My History
          </button>
        </div>

        {loadingData ? (
          <p className="font-body text-muted-foreground py-8 text-center">Loading...</p>
        ) : tab === "history" ? (
          <div className="space-y-4">
            <div className="border border-border rounded-sm overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left font-body text-xs uppercase tracking-wider text-muted-foreground p-3">
                      Date
                    </th>
                    <th className="text-left font-body text-xs uppercase tracking-wider text-muted-foreground p-3">
                      Delivery
                    </th>
                    <th className="text-left font-body text-xs uppercase tracking-wider text-muted-foreground p-3">
                      Amount
                    </th>
                    <th className="text-center font-body text-xs uppercase tracking-wider text-muted-foreground p-3">
                      Wallet Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {earnings.map((earning) => (
                    <tr key={earning._id} className="border-b border-border last:border-0">
                      <td className="p-3 font-body text-sm text-foreground">
                        {new Date(earning.creditedAt).toLocaleDateString()}
                      </td>
                      <td className="p-3 font-body text-sm text-foreground">
                        {earning.deliveryId}
                      </td>
                      <td className="p-3 font-body text-sm text-foreground">
                        LKR {earning.amount.toLocaleString()}
                      </td>
                      <td className="p-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-body text-green-600 bg-green-50 dark:bg-green-950/30 dark:text-green-400">
                          {earning.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {earnings.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center font-body text-sm text-muted-foreground">
                        No earnings yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="border border-border rounded-sm overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left font-body text-xs uppercase tracking-wider text-muted-foreground p-3">
                      Date
                    </th>
                    <th className="text-left font-body text-xs uppercase tracking-wider text-muted-foreground p-3">
                      Order
                    </th>
                    <th className="text-left font-body text-xs uppercase tracking-wider text-muted-foreground p-3">
                      Address
                    </th>
                    <th className="text-center font-body text-xs uppercase tracking-wider text-muted-foreground p-3">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedHistory.map((delivery) => (
                    <tr key={delivery.deliveryId} className="border-b border-border last:border-0">
                      <td className="p-3 font-body text-sm text-foreground">
                        {new Date(delivery.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3 font-body text-sm text-foreground">
                        {delivery.orderId}
                      </td>
                      <td className="p-3 font-body text-sm text-muted-foreground">
                        {delivery.deliveryAddress.city}, {delivery.deliveryAddress.state}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-body ${
                            statusBadge[delivery.status] || statusBadge.pending_pickup
                          }`}
                        >
                          {delivery.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {sortedHistory.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center font-body text-sm text-muted-foreground">
                        No delivery history yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeDelivery ? (
          <div className="border border-border rounded-sm p-6 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-lg tracking-wider text-foreground">
                Active Delivery
              </h2>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-body ${
                  statusBadge[activeDelivery.status] || statusBadge.pending_pickup
                }`}
              >
                {activeDelivery.status}
              </span>
            </div>
            <div className="space-y-2 font-body text-sm">
              <div className="flex items-center gap-2 text-foreground">
                <Package size={14} className="text-muted-foreground" />
                {activeDelivery.recipientName}
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin size={14} className="mt-0.5" />
                <span>
                  {activeDelivery.deliveryAddress.street}, {activeDelivery.deliveryAddress.city},{" "}
                  {activeDelivery.deliveryAddress.state} {activeDelivery.deliveryAddress.zip}
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone size={14} />
                {activeDelivery.contactNumber || "N/A"}
              </div>
              <p className="text-muted-foreground">
                Items: {activeDelivery.orderDetails?.itemCount || activeDelivery.itemCount}
              </p>
              {activeDelivery.orderDetails?.items?.length ? (
                <div className="space-y-1">
                  {activeDelivery.orderDetails.items.map((item, idx) => (
                    <p key={`${item.name}-${idx}`} className="text-xs text-muted-foreground">
                      {item.name} ({item.size}) x{item.quantity}
                    </p>
                  ))}
                </div>
              ) : null}
              {mapsDirectionsUrl && (
                <div className="pt-1">
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="rounded-sm font-body text-xs uppercase tracking-widest"
                  >
                    <a href={mapsDirectionsUrl} target="_blank" rel="noreferrer">
                      Open Navigation
                    </a>
                  </Button>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">
                Status Note
              </Label>
              <Input
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="Optional status note"
                className="rounded-sm font-body text-sm"
              />
              <div className="flex gap-2">
                {canMarkPickedUp && (
                  <Button
                    onClick={() => handleUpdateStatus("in_transit")}
                    disabled={updatingStatus}
                    className="rounded-sm font-body text-xs uppercase tracking-widest"
                  >
                    {updatingStatus ? "Updating..." : "Mark as Picked Up"}
                  </Button>
                )}
                {canMarkDelivered && (
                  <div className="w-full space-y-2">
                    <Input
                      value={deliveryProof}
                      onChange={(e) => setDeliveryProof(e.target.value)}
                      placeholder="Proof of delivery (photo ref, signature, OTP, etc.)"
                      className="rounded-sm font-body text-sm"
                    />
                    <Button
                      onClick={() => handleUpdateStatus("delivered")}
                      disabled={updatingStatus}
                      className="rounded-sm font-body text-xs uppercase tracking-widest bg-green-600 hover:bg-green-700 text-white"
                    >
                      {updatingStatus ? "Updating..." : "Mark as Delivered"}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="font-body text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Location Update
              </h3>
              {activeDelivery.status === "in_transit" && (
                <p className="font-body text-xs text-muted-foreground">
                  GPS Tracking:{" "}
                  {gpsTrackingState === "tracking"
                    ? "Live"
                    : gpsTrackingState === "denied"
                    ? "Permission denied (manual update only)"
                    : gpsTrackingState === "unsupported"
                    ? "Not supported on this browser/device"
                    : gpsTrackingState === "error"
                    ? "Signal unavailable (manual update only)"
                    : "Starting..."}
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Input
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  placeholder="Current location"
                  className="rounded-sm font-body text-sm md:col-span-2"
                />
                <Input
                  value={etaInput}
                  onChange={(e) => setEtaInput(e.target.value)}
                  placeholder="ETA minutes"
                  type="number"
                  min={0}
                  className="rounded-sm font-body text-sm"
                />
              </div>
              <Button
                onClick={handleUpdateLocation}
                disabled={updatingLocation}
                size="sm"
                className="rounded-sm font-body text-xs uppercase tracking-widest"
              >
                {updatingLocation ? "Updating..." : "Update Location"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="font-display text-lg tracking-wider text-foreground">
              Available Jobs
            </h2>
            {availableJobs.length === 0 ? (
              <p className="font-body text-sm text-muted-foreground border border-border rounded-sm p-6 text-center">
                No available deliveries right now
              </p>
            ) : (
              availableJobs.map((job) => (
                <div key={job.deliveryId} className="border border-border rounded-sm p-4 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-body text-sm font-medium text-foreground">
                      {job.orderId.slice(-6)}
                    </p>
                    <p className="font-body text-xs text-muted-foreground">
                      {job.orderDetails?.zone || `${job.deliveryAddress.city}, ${job.deliveryAddress.state}`}
                    </p>
                    <p className="font-body text-xs text-muted-foreground">
                      {job.orderDetails?.itemCount || job.itemCount} items
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleAccept(job.deliveryId)}
                    className="rounded-sm font-body text-xs uppercase tracking-widest"
                  >
                    Accept
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </main>
  );
}
