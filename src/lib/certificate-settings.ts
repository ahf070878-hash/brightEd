import { Prisma } from "@prisma/client";

import { prisma } from "./prisma";

export const CERTIFICATE_SETTINGS_KEY = "certificate_settings";

export type CertificateSettings = {
  title: string;
  subtitle: string;
  recipient_label: string;
  material_label: string;
  completion_label: string;
  date_source: "certificate_date" | "membership_end";
  asset_path: string | null;
};

export const defaultCertificateSettings: CertificateSettings = {
  title: "BrightEd Akademi",
  subtitle: "Sertifikat Penyelesaian",
  recipient_label: "Diberikan kepada",
  material_label: "Atas penyelesaian program",
  completion_label: "Tanggal Selesai",
  date_source: "certificate_date",
  asset_path: null,
};

function cleanText(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const cleaned = value.trim();
  return cleaned || fallback;
}

export function normalizeCertificateSettings(input: unknown): CertificateSettings {
  const source = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const dateSource = source.date_source === "membership_end" ? "membership_end" : "certificate_date";
  const assetPath = typeof source.asset_path === "string" && source.asset_path.trim()
    ? source.asset_path.trim()
    : null;

  return {
    title: cleanText(source.title, defaultCertificateSettings.title),
    subtitle: cleanText(source.subtitle, defaultCertificateSettings.subtitle),
    recipient_label: cleanText(source.recipient_label, defaultCertificateSettings.recipient_label),
    material_label: cleanText(source.material_label, defaultCertificateSettings.material_label),
    completion_label: cleanText(source.completion_label, defaultCertificateSettings.completion_label),
    date_source: dateSource,
    asset_path: assetPath,
  };
}

export async function getCertificateSettings() {
  const setting = await prisma.appSetting.findUnique({ where: { key: CERTIFICATE_SETTINGS_KEY } });
  return normalizeCertificateSettings(setting?.value);
}

export async function saveCertificateSettings(settings: CertificateSettings) {
  return prisma.appSetting.upsert({
    where: { key: CERTIFICATE_SETTINGS_KEY },
    update: { value: settings as unknown as Prisma.InputJsonValue },
    create: { key: CERTIFICATE_SETTINGS_KEY, value: settings as unknown as Prisma.InputJsonValue },
  });
}
