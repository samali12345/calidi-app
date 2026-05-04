import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
  FileText,
  Calendar,
} from "lucide-react";
import type { Delivery } from "@/lib/types";

declare global {
  interface Window {
    google?: any;
  }
}

const statusConfig: Record<
  string,
  { icon: React.ReactNode; color: string; label: string; bgColor: string }
> = {
  pending_pickup: {
    icon: <Package size={20} />,
    color: "text-amber-600",
    label: "Pending Pickup",
    bgColor: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
  },
  in_transit: {
    icon: <Truck size={20} />,
    color: "text-blue-600",
    label: "In Transit",
    bgColor: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
  },
  delivered: {
    icon: <CheckCircle size={20} />,
    color: "text-green-600",
    label: "Delivered",
    bgColor: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800",
  },
  failed: {
    icon: <XCircle size={20} />,
    color: "text-red-600",
    label: "Failed",
    bgColor: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
  },
  returned: {
    icon: <RotateCcw size={20} />,
    color: "text-gray-600",
    label: "Returned",
    bgColor: "bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800",
  },
};

const methodLabels: Record<string, string> = {
  standard: "Standard Delivery (5-7 days)",
  express: "Express Delivery (2-3 days)",
  "same-day": "Same-Day Delivery",
};

const timeSlotLabels: Record<string, string> = {
  any: "Any Time",
  morning: "Morning (9 AM - 12 PM)",
  afternoon: "Afternoon (12 PM - 5 PM)",
  evening: "Evening (5 PM - 9 PM)",
};

const vehicleEmojiByType: Record<string, string> = {
  bike: "🏍️",
  threewheel: "🛺",
  van: "🚚",
};

function makeVehicleMarkerIcon(vehicleType: string) {
  const emoji = vehicleEmojiByType[vehicleType] || vehicleEmojiByType.bike;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="0 0 46 46">
      <circle cx="23" cy="23" r="20" fill="#111827" stroke="#ffffff" stroke-width="2" />
      <text x="23" y="29" text-anchor="middle" font-size="18">${emoji}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export default function DeliveryTracking() {
  const { deliveryId } = useParams<{ deliveryId: string }>();
  const { user, token, loading } = useAuth();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loadingDelivery, setLoadingDelivery] = useState(true);
  const [streamConnected, setStreamConnected] = useState(false);
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [googleMapReady, setGoogleMapReady] = useState(false);
  const [routeStatusMessage, setRouteStatusMessage] = useState("");
  const previousStatusRef = useRef<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const riderMarkerRef = useRef<any>(null);
  const destinationMarkerRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const googleMapsKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || "";

  const fetchDelivery = useCallback(async (showErrorToast = true) => {
    if (!token || !deliveryId) return;
    try {
      const data = await apiFetch<Delivery>(`/deliveries/${deliveryId}`, { token });
      setDelivery(data);
      if (!previousStatusRef.current) {
        previousStatusRef.current = data.status;
      }
    } catch {
      if (showErrorToast) toast.error("Failed to load delivery");
    } finally {
      setLoadingDelivery(false);
    }
  }, [token, deliveryId]);

  useEffect(() => {
    fetchDelivery(true);
  }, [fetchDelivery]);

  useEffect(() => {
    if (!token || !deliveryId) return;

    const streamUrl = `http://127.0.0.1:5000/api/deliveries/${deliveryId}/stream?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(streamUrl);

    const onSnapshot = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.delivery) {
          setDelivery(payload.delivery);
          previousStatusRef.current = payload.delivery.status;
          setLoadingDelivery(false);
        }
      } catch (err) {
        console.error("Failed to parse snapshot event:", err);
      }
    };

    const onUpdate = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        const nextDelivery = payload?.delivery;
        if (!nextDelivery) return;

        const oldStatus = previousStatusRef.current;
        setDelivery(nextDelivery);
        setLoadingDelivery(false);
        setStreamConnected(true);

        if (oldStatus && oldStatus !== nextDelivery.status) {
          toast.success(`Delivery status updated: ${nextDelivery.status.replace(/_/g, " ")}`);
        }
        previousStatusRef.current = nextDelivery.status;
      } catch (err) {
        console.error("Failed to parse update event:", err);
      }
    };

    eventSource.addEventListener("delivery_snapshot", onSnapshot);
    eventSource.addEventListener("delivery_update", onUpdate);
    eventSource.onopen = () => setStreamConnected(true);
    eventSource.onerror = () => {
      setStreamConnected(false);
      eventSource.close();
    };

    return () => {
      setStreamConnected(false);
      eventSource.close();
    };
  }, [token, deliveryId]);

  // Fallback polling when live stream is not connected.
  useEffect(() => {
    if (!token || !deliveryId || streamConnected) return;
    const id = setInterval(() => {
      fetchDelivery(false);
    }, 30000);
    return () => clearInterval(id);
  }, [token, deliveryId, streamConnected, fetchDelivery]);

  useEffect(() => {
    if (!googleMapsKey) return;
    if (window.google?.maps) {
      setGoogleMapReady(true);
      return;
    }

    const scriptId = "google-maps-js";
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => setGoogleMapReady(true));
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      googleMapsKey
    )}&libraries=geometry`;
    script.onload = () => setGoogleMapReady(true);
    script.onerror = () => setRouteStatusMessage("Google Maps failed to load.");
    document.head.appendChild(script);
  }, [googleMapsKey]);

  useEffect(() => {
    if (!delivery || !googleMapReady || !window.google?.maps) return;

    const hasLiveCoords = delivery.currentLat !== null && delivery.currentLng !== null;
    const hasDestinationCoords =
      delivery.destinationLat !== null && delivery.destinationLng !== null;

    if (!hasLiveCoords || !hasDestinationCoords) {
      setRoutePoints([]);
      if (hasLiveCoords && !hasDestinationCoords) {
        setRouteStatusMessage("Destination could not be resolved for route drawing.");
      } else {
        setRouteStatusMessage("");
      }
      return;
    }

    if (delivery.routePolyline && window.google.maps.geometry?.encoding) {
      const decoded = window.google.maps.geometry.encoding.decodePath(
        delivery.routePolyline
      );
      const points = decoded
        .map((p: any) => [Number(p.lat()), Number(p.lng())] as [number, number])
        .filter((p: [number, number]) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
      if (points.length > 1) {
        setRoutePoints(points);
        setRouteStatusMessage("Live route active.");
        return;
      }
    }

    setRoutePoints([
      [delivery.currentLat as number, delivery.currentLng as number],
      [delivery.destinationLat as number, delivery.destinationLng as number],
    ]);
    setRouteStatusMessage("Using direct line fallback.");
  }, [
    delivery?.currentLat,
    delivery?.currentLng,
    delivery?.destinationLat,
    delivery?.destinationLng,
    delivery?.routePolyline,
    googleMapReady,
  ]);

  useEffect(() => {
    if (!delivery || !googleMapReady || !window.google?.maps || !mapContainerRef.current) return;
    if (delivery.currentLat === null || delivery.currentLng === null) return;

    const gmaps = window.google.maps;
    const riderPos = { lat: delivery.currentLat, lng: delivery.currentLng };
    const vehicleType = delivery.vehicleType || "bike";
    const destinationPos =
      delivery.destinationLat !== null && delivery.destinationLng !== null
        ? { lat: delivery.destinationLat, lng: delivery.destinationLng }
        : null;

    if (!mapRef.current) {
      mapRef.current = new gmaps.Map(mapContainerRef.current, {
        center: riderPos,
        zoom: 14,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
    }

    if (!riderMarkerRef.current) {
      riderMarkerRef.current = new gmaps.Marker({
        position: riderPos,
        map: mapRef.current,
        title: `Courier current location (${vehicleType})`,
        icon: {
          url: makeVehicleMarkerIcon(vehicleType),
          scaledSize: new gmaps.Size(38, 38),
        },
      });
    } else {
      riderMarkerRef.current.setPosition(riderPos);
      riderMarkerRef.current.setIcon({
        url: makeVehicleMarkerIcon(vehicleType),
        scaledSize: new gmaps.Size(38, 38),
      });
      riderMarkerRef.current.setTitle(`Courier current location (${vehicleType})`);
    }

    if (destinationPos) {
      if (!destinationMarkerRef.current) {
        destinationMarkerRef.current = new gmaps.Marker({
          position: destinationPos,
          map: mapRef.current,
          title: "Delivery destination",
          icon: "https://maps.google.com/mapfiles/ms/icons/orange-dot.png",
        });
      } else {
        destinationMarkerRef.current.setPosition(destinationPos);
        destinationMarkerRef.current.setMap(mapRef.current);
      }
    } else if (destinationMarkerRef.current) {
      destinationMarkerRef.current.setMap(null);
    }

    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
      routePolylineRef.current = null;
    }
    if (routePoints.length > 1) {
      routePolylineRef.current = new gmaps.Polyline({
        path: routePoints.map((p) => ({ lat: p[0], lng: p[1] })),
        geodesic: true,
        strokeColor: "#111827",
        strokeOpacity: 0.8,
        strokeWeight: 4,
      });
      routePolylineRef.current.setMap(mapRef.current);
    }

    const bounds = new gmaps.LatLngBounds();
    bounds.extend(riderPos);
    if (destinationPos) bounds.extend(destinationPos);
    if (routePoints.length > 1) {
      routePoints.forEach((p) => bounds.extend({ lat: p[0], lng: p[1] }));
    }
    mapRef.current.fitBounds(bounds, 28);
  }, [delivery, googleMapReady, routePoints]);

  if (!loading && !user) return <Navigate to="/auth" />;

  if (loadingDelivery) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </main>
    );
  }

  if (!delivery) {
    return (
      <main className="min-h-[70vh] flex flex-col items-center justify-center px-6 py-16 space-y-4">
        <Package size={48} className="text-muted-foreground" />
        <p className="font-body text-muted-foreground">Delivery not found</p>
        <Button asChild variant="outline" className="rounded-sm font-body uppercase tracking-widest text-sm">
          <Link to="/orders">Back to Orders</Link>
        </Button>
      </main>
    );
  }

  const sc = statusConfig[delivery.status] || statusConfig.pending_pickup;
  const steps = ["pending_pickup", "in_transit", "delivered"];
  const currentStepIndex = steps.indexOf(delivery.status);
  const isFailed = delivery.status === "failed" || delivery.status === "returned";
  const hasLiveCoords = delivery.currentLat !== null && delivery.currentLng !== null;
  const hasDestinationCoords =
    delivery.destinationLat !== null && delivery.destinationLng !== null;

  return (
    <main className="min-h-[70vh] py-12 px-6">
      <div className="container mx-auto max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-wider text-foreground">
              Delivery Tracking
            </h1>
            <p className="font-body text-sm text-muted-foreground mt-1">
              {delivery.deliveryId}
            </p>
          </div>
          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-sm text-sm font-body border ${sc.bgColor} ${sc.color}`}>
            {sc.icon}
            {sc.label}
          </span>
        </div>

        {/* Progress Bar */}
        {!isFailed && (
          <div className="mb-10">
            <div className="flex items-center justify-between relative">
              {steps.map((step, i) => {
                const stepSc = statusConfig[step];
                const isCompleted = i <= currentStepIndex;
                const isCurrent = i === currentStepIndex;
                return (
                  <div key={step} className="flex flex-col items-center z-10 relative">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                        isCompleted
                          ? "bg-foreground border-foreground text-background"
                          : "bg-background border-border text-muted-foreground"
                      } ${isCurrent ? "ring-2 ring-offset-2 ring-foreground" : ""}`}
                    >
                      {stepSc.icon}
                    </div>
                    <p className={`font-body text-xs mt-2 ${isCompleted ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {stepSc.label}
                    </p>
                  </div>
                );
              })}
              {/* Connecting line */}
              <div className="absolute top-5 left-[10%] right-[10%] h-0.5 bg-border -z-0">
                <div
                  className="h-full bg-foreground transition-all"
                  style={{ width: `${Math.min(100, (currentStepIndex / (steps.length - 1)) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Delivery Info */}
          <div className="border border-border rounded-sm p-6 space-y-4">
            <h2 className="font-display text-lg tracking-wider text-foreground">Delivery Info</h2>
            <div className="space-y-3 font-body text-sm">
              <div className="flex items-start gap-2">
                <MapPin size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-foreground">{delivery.deliveryAddress.street}</p>
                  <p className="text-muted-foreground">
                    {delivery.deliveryAddress.city}, {delivery.deliveryAddress.state} {delivery.deliveryAddress.zip}
                  </p>
                  <p className="text-muted-foreground">{delivery.deliveryAddress.country}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Package size={16} className="text-muted-foreground shrink-0" />
                <span className="text-foreground">{delivery.recipientName}</span>
              </div>
              {delivery.contactNumber && (
                <div className="flex items-center gap-2">
                  <Phone size={16} className="text-muted-foreground shrink-0" />
                  <span className="text-foreground">{delivery.contactNumber}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Truck size={16} className="text-muted-foreground shrink-0" />
                <span className="text-foreground">{methodLabels[delivery.deliveryMethod] || delivery.deliveryMethod}</span>
              </div>
              {delivery.vehicleType && delivery.vehicleType !== "unknown" && (
                <div className="flex items-center gap-2">
                  <Truck size={16} className="text-muted-foreground shrink-0" />
                  <span className="text-foreground">
                    Vehicle: {delivery.vehicleType}
                  </span>
                </div>
              )}
              {(delivery.currentLocation || delivery.etaMinutes !== null || delivery.liveUpdatedAt) && (
                <div className="space-y-1 pt-1">
                  {delivery.currentLocation && (
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-muted-foreground shrink-0" />
                      <span className="text-foreground">Current location: {delivery.currentLocation}</span>
                    </div>
                  )}
                  {delivery.etaMinutes !== null && (
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-muted-foreground shrink-0" />
                      <span className="text-foreground">ETA: about {delivery.etaMinutes} min</span>
                    </div>
                  )}
                  {delivery.liveUpdatedAt && (
                    <p className="text-xs text-muted-foreground">
                      Live updated: {new Date(delivery.liveUpdatedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
              {delivery.scheduledDate && (
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-muted-foreground shrink-0" />
                  <span className="text-foreground">
                    {new Date(delivery.scheduledDate).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                    {" - "}
                    {timeSlotLabels[delivery.scheduledTimeSlot] || delivery.scheduledTimeSlot}
                  </span>
                </div>
              )}
              {!delivery.scheduledDate && delivery.scheduledTimeSlot !== "any" && (
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-muted-foreground shrink-0" />
                  <span className="text-foreground">
                    {timeSlotLabels[delivery.scheduledTimeSlot]}
                  </span>
                </div>
              )}
              {delivery.deliveryNotes && (
                <div className="flex items-start gap-2">
                  <FileText size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-muted-foreground italic">{delivery.deliveryNotes}</span>
                </div>
              )}
            </div>

            {delivery.deliveredAt && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="font-body text-sm text-green-600 font-medium">
                    Delivered on {new Date(delivery.deliveredAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {delivery.proofOfDelivery && (
                    <p className="font-body text-xs text-muted-foreground">
                      Proof: {delivery.proofOfDelivery}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Status History */}
          <div className="border border-border rounded-sm p-6 space-y-4">
            <h2 className="font-display text-lg tracking-wider text-foreground">Status History</h2>
            <div className="space-y-4">
              {delivery.statusHistory
                .slice()
                .reverse()
                .map((entry, i) => {
                  const entrySc = statusConfig[entry.status] || statusConfig.pending_pickup;
                  return (
                    <div key={i} className="flex gap-3">
                      <div className={`shrink-0 mt-0.5 ${entrySc.color}`}>
                        {entrySc.icon}
                      </div>
                      <div>
                        <p className="font-body text-sm font-medium text-foreground">
                          {entrySc.label}
                        </p>
                        <p className="font-body text-xs text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        {entry.note && (
                          <p className="font-body text-xs text-muted-foreground mt-1">
                            {entry.note}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {hasLiveCoords && (
          <div className="mt-6 border border-border rounded-sm p-6 space-y-4">
            <h2 className="font-display text-lg tracking-wider text-foreground">Live Map</h2>
            <div className="h-72 rounded-sm overflow-hidden border border-border">
              {googleMapsKey ? (
                <div ref={mapContainerRef} className="h-full w-full" />
              ) : (
                <div className="h-full w-full flex items-center justify-center font-body text-sm text-muted-foreground">
                  Add VITE_GOOGLE_MAPS_API_KEY to enable Google Map.
                </div>
              )}
            </div>
            <p className="font-body text-xs text-muted-foreground">
              Coordinates: {delivery.currentLat?.toFixed(6)}, {delivery.currentLng?.toFixed(6)}
            </p>
            {hasDestinationCoords && (
              <p className="font-body text-xs text-muted-foreground">
                Destination: {delivery.destinationLat?.toFixed(6)},{" "}
                {delivery.destinationLng?.toFixed(6)}
              </p>
            )}
            {routeStatusMessage && (
              <p className="font-body text-xs text-muted-foreground">
                {routeStatusMessage}
              </p>
            )}
            <a
              href={`https://www.google.com/maps?q=${delivery.currentLat},${delivery.currentLng}`}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-xs font-body uppercase tracking-widest text-foreground underline"
            >
              Open In Google Maps
            </a>
          </div>
        )}

        {/* Order Summary */}
        <div className="mt-6 border border-border rounded-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-body text-sm text-muted-foreground">Order</p>
              <p className="font-display text-sm font-medium text-foreground">{delivery.orderId}</p>
            </div>
            <div className="text-right">
              <p className="font-body text-sm text-muted-foreground">{delivery.itemCount} item{delivery.itemCount > 1 ? "s" : ""}</p>
              <p className="font-display text-sm font-medium text-foreground">LKR {delivery.orderTotal.toLocaleString()}</p>
            </div>
          </div>
          {delivery.deliveryFee > 0 && (
            <p className="font-body text-xs text-muted-foreground mt-2">
              Delivery fee: LKR {delivery.deliveryFee.toLocaleString()}
            </p>
          )}
        </div>

        <div className="flex gap-4 mt-8 justify-center">
          <Button asChild variant="outline" className="rounded-sm font-body uppercase tracking-widest text-sm">
            <Link to="/orders">Back to Orders</Link>
          </Button>
          <Button asChild className="bg-foreground text-background hover:bg-foreground/90 rounded-sm font-body uppercase tracking-widest text-sm">
            <Link to="/shop">Continue Shopping</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
