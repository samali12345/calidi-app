const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchJsonWithRetry = async (url, options = {}, attempts = 3) => {
  let lastError = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return await response.json();
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      lastError = err;
    }

    if (i < attempts - 1) {
      await wait(250 * (i + 1));
    }
  }

  throw lastError || new Error("Request failed");
};

const getGoogleMapsServerKey = () =>
  process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "";

const parseDurationSeconds = (durationText) => {
  if (typeof durationText !== "string") return null;
  const normalized = durationText.trim().toLowerCase();
  if (!normalized.endsWith("s")) return null;
  const value = Number(normalized.slice(0, -1));
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
};

async function geocodeAddressGoogle(query) {
  const apiKey = getGoogleMapsServerKey();
  const q = typeof query === "string" ? query.trim() : "";
  if (!apiKey || !q) return null;

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    q
  )}&key=${encodeURIComponent(apiKey)}`;

  let data = null;
  try {
    data = await fetchJsonWithRetry(url, { headers: { Accept: "application/json" } }, 3);
  } catch {
    return null;
  }

  if (data?.status !== "OK" || !Array.isArray(data.results) || data.results.length === 0) {
    return null;
  }

  const lat = Number(data.results[0]?.geometry?.location?.lat);
  const lng = Number(data.results[0]?.geometry?.location?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return {
    lat,
    lng,
    formattedAddress: data.results[0]?.formatted_address || "",
  };
}

async function computeRouteGoogle({
  originLat,
  originLng,
  destinationLat,
  destinationLng,
}) {
  const apiKey = getGoogleMapsServerKey();
  if (!apiKey) return null;

  if (
    !Number.isFinite(originLat) ||
    !Number.isFinite(originLng) ||
    !Number.isFinite(destinationLat) ||
    !Number.isFinite(destinationLng)
  ) {
    return null;
  }

  const body = {
    origin: {
      location: {
        latLng: {
          latitude: originLat,
          longitude: originLng,
        },
      },
    },
    destination: {
      location: {
        latLng: {
          latitude: destinationLat,
          longitude: destinationLng,
        },
      },
    },
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
    polylineQuality: "OVERVIEW",
    computeAlternativeRoutes: false,
    languageCode: "en-US",
    units: "METRIC",
  };

  const url = "https://routes.googleapis.com/directions/v2:computeRoutes";
  let data = null;
  try {
    data = await fetchJsonWithRetry(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
        },
        body: JSON.stringify(body),
      },
      3
    );
  } catch {
    return null;
  }

  const route = Array.isArray(data?.routes) ? data.routes[0] : null;
  if (!route) return null;

  const seconds = parseDurationSeconds(route.duration);
  const etaMinutes = seconds === null ? null : Math.max(1, Math.ceil(seconds / 60));

  return {
    etaMinutes,
    distanceMeters: Number.isFinite(route.distanceMeters) ? route.distanceMeters : null,
    encodedPolyline: route?.polyline?.encodedPolyline || "",
  };
}

module.exports = {
  geocodeAddressGoogle,
  computeRouteGoogle,
};
