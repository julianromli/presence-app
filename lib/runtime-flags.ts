const TRUE_FLAG_VALUES = new Set(["1", "true", "yes", "on"]);

function normalizeFlagValue(value?: string | null) {
  return value?.trim().toLowerCase();
}

function isTruthyFlag(value?: string | null) {
  const normalized = normalizeFlagValue(value);
  return normalized ? TRUE_FLAG_VALUES.has(normalized) : false;
}

export function shouldEnableSentry({
  nodeEnv = process.env.NODE_ENV,
  sentryFlag = process.env.NEXT_PUBLIC_ENABLE_SENTRY ?? process.env.ENABLE_SENTRY,
}: {
  nodeEnv?: string | undefined;
  sentryFlag?: string | null | undefined;
} = {}) {
  if (normalizeFlagValue(sentryFlag)) {
    return isTruthyFlag(sentryFlag);
  }

  return nodeEnv === "production";
}

export function shouldLoadReactGrabScripts({
  nodeEnv = process.env.NODE_ENV,
  reactGrabFlag = process.env.NEXT_PUBLIC_ENABLE_REACT_GRAB_DEVTOOLS,
}: {
  nodeEnv?: string | undefined;
  reactGrabFlag?: string | null | undefined;
} = {}) {
  return nodeEnv === "development" && isTruthyFlag(reactGrabFlag);
}

export function shouldUseLightweightMarketingHome({
  nodeEnv = process.env.NODE_ENV,
  fullMarketingHomeFlag = process.env.NEXT_PUBLIC_ENABLE_FULL_MARKETING_HOME_DEV,
}: {
  nodeEnv?: string | undefined;
  fullMarketingHomeFlag?: string | null | undefined;
} = {}) {
  return nodeEnv === "development" && !isTruthyFlag(fullMarketingHomeFlag);
}
