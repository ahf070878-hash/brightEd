import { Prisma } from "@prisma/client";

import { prisma } from "./prisma";

export const SECURITY_SETTINGS_KEY = "security_settings";

export type SecuritySettings = {
  session_hours: number;
  password_min_length: number;
};

export const defaultSecuritySettings: SecuritySettings = {
  session_hours: 8,
  password_min_length: 8,
};

function boundedNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function normalizeSecuritySettings(source: unknown): SecuritySettings {
  const input = source && typeof source === "object" ? source as Partial<SecuritySettings> : {};
  return {
    session_hours: boundedNumber(input.session_hours, defaultSecuritySettings.session_hours, 1, 24),
    password_min_length: boundedNumber(input.password_min_length, defaultSecuritySettings.password_min_length, 8, 32),
  };
}

export async function getSecuritySettings() {
  const setting = await prisma.appSetting.findUnique({ where: { key: SECURITY_SETTINGS_KEY } });
  return normalizeSecuritySettings(setting?.value);
}

export async function saveSecuritySettings(settings: SecuritySettings) {
  const normalized = normalizeSecuritySettings(settings);
  return prisma.appSetting.upsert({
    where: { key: SECURITY_SETTINGS_KEY },
    update: { value: normalized as unknown as Prisma.InputJsonValue },
    create: { key: SECURITY_SETTINGS_KEY, value: normalized as unknown as Prisma.InputJsonValue },
  });
}
