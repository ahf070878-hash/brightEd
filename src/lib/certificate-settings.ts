import { Prisma } from "@prisma/client";

import { prisma } from "./prisma";

export const CERTIFICATE_SETTINGS_KEY = "certificate_settings";

export type CertificateTextFieldKey = "name" | "title" | "date";

export type CertificateTextFieldConfig = {
  x: number;
  y: number;
  size: number;
  color: string;
  weight: "normal" | "bold";
  align: "left" | "center" | "right";
};

export type CertificateTextConfig = Record<CertificateTextFieldKey, CertificateTextFieldConfig>;

export type CertificateSettings = {
  title: string;
  subtitle: string;
  recipient_label: string;
  material_label: string;
  completion_label: string;
  date_source: "certificate_date" | "membership_end";
  asset_path: string | null;
  text_config: CertificateTextConfig;
};

export const defaultCertificateTextConfig: CertificateTextConfig = {
  name: { x: 50, y: 52, size: 120, color: "#1A1A2E", weight: "bold", align: "center" },
  title: { x: 50, y: 63, size: 70, color: "#333366", weight: "bold", align: "center" },
  date: { x: 50, y: 73, size: 55, color: "#666666", weight: "normal", align: "center" },
};

export const defaultCertificateSettings: CertificateSettings = {
  title: "BrightEd Akademi",
  subtitle: "Sertifikat Penyelesaian",
  recipient_label: "Diberikan kepada",
  material_label: "Atas penyelesaian program",
  completion_label: "Tanggal Selesai",
  date_source: "certificate_date",
  asset_path: null,
  text_config: defaultCertificateTextConfig,
};

function cleanText(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const cleaned = value.trim();
  return cleaned || fallback;
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(Math.max(numeric, min), max);
}

function cleanColor(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }
  const cleaned = value.trim();
  return /^#[0-9a-f]{6}$/i.test(cleaned) ? cleaned : fallback;
}

function normalizeTextFieldConfig(input: unknown, fallback: CertificateTextFieldConfig): CertificateTextFieldConfig {
  const source = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const align = source.align === "left" || source.align === "right" || source.align === "center"
    ? source.align
    : fallback.align;

  return {
    x: boundedNumber(source.x, fallback.x, 0, 100),
    y: boundedNumber(source.y, fallback.y, 0, 100),
    size: boundedNumber(source.size, fallback.size, 1, 150),
    color: cleanColor(source.color, fallback.color),
    weight: source.weight === "bold" || source.weight === "normal" ? source.weight : fallback.weight,
    align,
  };
}

function normalizeCertificateTextConfig(input: unknown): CertificateTextConfig {
  const source = input && typeof input === "object" ? input as Record<string, unknown> : {};
  return {
    name: normalizeTextFieldConfig(source.name, defaultCertificateTextConfig.name),
    title: normalizeTextFieldConfig(source.title ?? source.course, defaultCertificateTextConfig.title),
    date: normalizeTextFieldConfig(source.date, defaultCertificateTextConfig.date),
  };
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
    text_config: normalizeCertificateTextConfig(source.text_config),
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

