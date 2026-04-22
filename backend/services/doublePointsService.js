const AppSettings = require("../models/AppSettings");

const DOUBLE_POINTS_KEY = "doublePoints";

function normalizeDoublePointsValue(value) {
  const enabled = !!value?.enabled;
  const endsAtRaw = value?.endsAt;
  const endsAt = endsAtRaw ? new Date(endsAtRaw) : null;
  const validEndsAt = endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : null;
  const active = enabled && !!validEndsAt && validEndsAt > new Date();
  return {
    active,
    enabled,
    endsAt: validEndsAt ? validEndsAt.toISOString() : null,
  };
}

async function getDoublePointsSettingDocument() {
  return AppSettings.findOne({ key: DOUBLE_POINTS_KEY });
}

async function getDoublePointsStatus() {
  const setting = await getDoublePointsSettingDocument();
  if (!setting) return { active: false, enabled: false, endsAt: null };
  return normalizeDoublePointsValue(setting.value || {});
}

async function upsertDoublePointsSetting({ enabled, endsAt }) {
  const parsedEndsAt = endsAt ? new Date(endsAt) : null;
  if (enabled && (!parsedEndsAt || Number.isNaN(parsedEndsAt.getTime()))) {
    throw new Error("A valid endsAt date is required when enabling double points");
  }
  const value = {
    enabled: !!enabled,
    endsAt: parsedEndsAt ? parsedEndsAt.toISOString() : null,
  };
  await AppSettings.findOneAndUpdate(
    { key: DOUBLE_POINTS_KEY },
    { $set: { value } },
    { upsert: true, new: true }
  );
  return getDoublePointsStatus();
}

module.exports = {
  DOUBLE_POINTS_KEY,
  getDoublePointsStatus,
  upsertDoublePointsSetting,
};
