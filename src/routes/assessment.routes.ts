import { Router } from "express";
import { Prisma, UserRole } from "@prisma/client";

import { assessmentConfig } from "../lib/certificate-eligibility";
import { getLearningAccess } from "../lib/access";
import { recordActivity } from "../lib/activity-log";
import { fail, getRequiredParam, ok } from "../lib/http";
import { prisma } from "../lib/prisma";
import {
  enforceDataScope,
  requireRoles,
  ScopedRequest,
} from "../middlewares/rbac.middleware";

const router = Router();

const assessmentInclude = {
  skillhub: {
    select: {
      id: true,
      nama: true,
      status: true,
    },
  },
  _count: {
    select: {
      attempts: true,
    },
  },
} satisfies Prisma.AssessmentInclude;

const attemptInclude = {
  assessment: {
    select: {
      id: true,
      judul: true,
      tipe: true,
      skillhub_id: true,
      konfigurasi: true,
    },
  },
  user: {
    select: {
      id: true,
      nama: true,
      email: true,
      role: true,
      status_akses: true,
      masa_aktif_mulai: true,
      masa_aktif_selesai: true,
      sekolah: {
        select: {
          id: true,
          nama: true,
          kode_sekolah: true,
        },
      },
    },
  },
} satisfies Prisma.AssessmentAttemptInclude;

function getPassingScore(config: Prisma.JsonValue | null) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return 70;
  }

  const value = (config as Record<string, unknown>).passing_score;
  return typeof value === "number" ? value : 70;
}

function getMaxAttempts(config: Prisma.JsonValue | null) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return undefined;
  }

  const value = (config as Record<string, unknown>).max_attempts;
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

type AssessmentQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correct_answer: string;
};

function getQuestions(config: Prisma.JsonValue | null): AssessmentQuestion[] {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return [];
  }

  const questions = (config as Record<string, unknown>).questions;

  if (!Array.isArray(questions)) {
    return [];
  }

  return questions.filter((question): question is AssessmentQuestion => {
    if (!question || typeof question !== "object" || Array.isArray(question)) {
      return false;
    }

    const candidate = question as Record<string, unknown>;

    return (
      typeof candidate.id === "string" &&
      typeof candidate.prompt === "string" &&
      Array.isArray(candidate.options) &&
      candidate.options.every((option) => typeof option === "string") &&
      typeof candidate.correct_answer === "string"
    );
  });
}

function gradeAnswers(
  config: Prisma.JsonValue | null,
  answers: Record<string, string>,
) {
  const questions = getQuestions(config);

  if (questions.length === 0) {
    return undefined;
  }

  const correctCount = questions.filter(
    (question) => answers[question.id] === question.correct_answer,
  ).length;

  return Math.round((correctCount / questions.length) * 100);
}

router.post(
  "/skillhubs/:skillhub_id/assessments",
  requireRoles([UserRole.admin]),
  async (req, res) => {
    const skillhubId = getRequiredParam(req.params, "skillhub_id");
    const { judul, tipe, konfigurasi } = req.body as {
      judul?: string;
      tipe?: string;
      konfigurasi?: Prisma.InputJsonValue;
    };

    if (!skillhubId) {
      return fail(res, 400, "SkillHub id is required.");
    }

    if (!judul) {
      return fail(res, 400, "Judul is required.");
    }

    try {
      const assessment = await prisma.assessment.create({
        data: {
          skillhub_id: skillhubId,
          judul: judul.trim(),
          tipe: tipe?.trim() || "quiz",
          konfigurasi: konfigurasi ?? Prisma.JsonNull,
        },
        include: assessmentInclude,
      });

      return ok(res, assessment, 201);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2003"
      ) {
        return fail(res, 404, "SkillHub not found.");
      }

      return fail(res, 500, "Internal Server Error.");
    }
  },
);

router.put("/assessments/:id", requireRoles([UserRole.admin]), async (req, res) => {
  const id = getRequiredParam(req.params, "id");
  const { judul, tipe, konfigurasi } = req.body as {
    judul?: string;
    tipe?: string;
    konfigurasi?: Prisma.InputJsonValue | null;
  };

  if (!id) {
    return fail(res, 400, "Assessment id is required.");
  }

  try {
    const assessment = await prisma.assessment.update({
      where: { id },
      data: {
        ...(judul !== undefined ? { judul: judul.trim() } : {}),
        ...(tipe !== undefined ? { tipe: tipe.trim() || "quiz" } : {}),
        ...(konfigurasi !== undefined
          ? { konfigurasi: konfigurasi ?? Prisma.JsonNull }
          : {}),
      },
      include: assessmentInclude,
    });

    return ok(res, assessment);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return fail(res, 404, "Assessment not found.");
    }

    return fail(res, 500, "Internal Server Error.");
  }
});

router.delete("/assessments/:id", requireRoles([UserRole.admin]), async (req, res) => {
  const id = getRequiredParam(req.params, "id");

  if (!id) {
    return fail(res, 400, "Assessment id is required.");
  }

  try {
    await prisma.assessment.delete({
      where: { id },
    });

    return ok(res, { id });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return fail(res, 404, "Assessment not found.");
    }

    return fail(res, 500, "Internal Server Error.");
  }
});

router.get("/assessments/:id", enforceDataScope, async (req, res) => {
  const id = getRequiredParam(req.params, "id");

  if (!id) {
    return fail(res, 400, "Assessment id is required.");
  }

  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: assessmentInclude,
  });

  if (!assessment) {
    return fail(res, 404, "Assessment not found.");
  }

  return ok(res, assessment);
});

router.post(
  "/assessments/:id/start",
  requireRoles([UserRole.peserta]),
  async (req: ScopedRequest, res) => {
    const assessmentId = getRequiredParam(req.params, "id");

    if (!req.user) {
      return fail(res, 401, "Unauthorized");
    }

    if (!assessmentId) {
      return fail(res, 400, "Assessment id is required.");
    }

    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: {
        id: true,
        skillhub_id: true,
        konfigurasi: true,
        tipe: true,
      },
    });

    if (!assessment) {
      return fail(res, 404, "Assessment not found.");
    }

    if (assessment.tipe === "scorm" || assessmentConfig(assessment.konfigurasi).archived === true) {
      return fail(res, 403, "Take this examination inside the learning material.");
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return fail(res, 404, "User not found.");
    }

    const access = getLearningAccess(user);

    if (!access.canAccessLearningMaterial) {
      return fail(res, 403, "Learning material access has expired.");
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: {
        user_id_skillhub_id: {
          user_id: req.user.id,
          skillhub_id: assessment.skillhub_id,
        },
      },
    });

    if (!enrollment) {
      return fail(res, 403, "User is not enrolled to this SkillHub.");
    }

    const maxAttempts = getMaxAttempts(assessment.konfigurasi);

    if (maxAttempts) {
      const attemptsCount = await prisma.assessmentAttempt.count({
        where: {
          user_id: req.user.id,
          assessment_id: assessment.id,
        },
      });

      if (attemptsCount >= maxAttempts) {
        return fail(res, 403, "Maximum attempts reached.");
      }
    }

    const attempt = await prisma.assessmentAttempt.create({
      data: {
        user_id: req.user.id,
        assessment_id: assessment.id,
        skor: 0,
        status_lulus: false,
      },
      include: attemptInclude,
    });

    return ok(res, attempt, 201);
  },
);

router.post(
  "/assessment-attempts/:attempt_id/submit",
  requireRoles([UserRole.peserta]),
  async (req: ScopedRequest, res) => {
    const attemptId = getRequiredParam(req.params, "attempt_id");
    const { skor, answers } = req.body as {
      skor?: number;
      answers?: Record<string, string>;
    };

    if (!req.user) {
      return fail(res, 401, "Unauthorized");
    }

    if (!attemptId) {
      return fail(res, 400, "Attempt id is required.");
    }

    const attempt = await prisma.assessmentAttempt.findFirst({
      where: {
        id: attemptId,
        user_id: req.user.id,
      },
      include: {
        assessment: {
          select: {
            konfigurasi: true,
            tipe: true,
          },
        },
      },
    });

    if (!attempt) {
      return fail(res, 404, "Attempt not found.");
    }

    if (attempt.assessment.tipe === "scorm" || assessmentConfig(attempt.assessment.konfigurasi).archived === true) {
      return fail(res, 403, "Take this examination inside the learning material.");
    }

    if (attempt.waktu_selesai) {
      return fail(res, 400, "Attempt has already been submitted.");
    }

    if (getQuestions(attempt.assessment.konfigurasi).length > 0 && (!answers || typeof answers !== "object" || Array.isArray(answers))) {
      return fail(res, 400, "Submit your answers. A manual score is not accepted for this assessment.");
    }
    const scoreFromAnswers =
      answers && typeof answers === "object"
        ? gradeAnswers(attempt.assessment.konfigurasi, answers)
        : undefined;
    const finalScore = scoreFromAnswers ?? skor;

    if (typeof finalScore !== "number" || finalScore < 0 || finalScore > 100) {
      return fail(
        res,
        400,
        "Skor must be a number between 0 and 100, or answers must match configured questions.",
      );
    }

    const passingScore = getPassingScore(attempt.assessment.konfigurasi);
    const updatedAttempt = await prisma.assessmentAttempt.update({
      where: { id: attempt.id },
      data: {
        skor: finalScore,
        status_lulus: finalScore >= passingScore,
        waktu_selesai: new Date(),
      },
      include: attemptInclude,
    });

    await recordActivity(req, {
      action: "assessment.submitted",
      entityType: "assessment_attempt",
      entityId: updatedAttempt.id,
      description: `Siswa ${updatedAttempt.user.nama} submit assessment ${updatedAttempt.assessment.judul} dengan skor ${Number(updatedAttempt.skor).toFixed(0)}.`,
      metadata: {
        attempt_id: updatedAttempt.id,
        user_id: updatedAttempt.user_id,
        assessment_id: updatedAttempt.assessment_id,
        skillhub_id: updatedAttempt.assessment.skillhub_id,
        skor: Number(updatedAttempt.skor),
        status_lulus: updatedAttempt.status_lulus,
      },
    });

    return ok(res, updatedAttempt);
  },
);

router.get(
  "/assessment-attempts",
  enforceDataScope,
  async (req: ScopedRequest, res) => {
    const assessmentId =
      typeof req.query.assessment_id === "string"
        ? req.query.assessment_id
        : undefined;
    const skillhubId =
      typeof req.query.skillhub_id === "string" ? req.query.skillhub_id : undefined;
    const statusLulus =
      req.query.status_lulus === "true"
        ? true
        : req.query.status_lulus === "false"
          ? false
          : undefined;

    const attempts = await prisma.assessmentAttempt.findMany({
      where: {
        AND: [
          req.dataScope?.assessmentAttemptWhereClause ?? {},
          assessmentId ? { assessment_id: assessmentId } : {},
          skillhubId
            ? {
                assessment: {
                  skillhub_id: skillhubId,
                },
              }
            : {},
          statusLulus !== undefined ? { status_lulus: statusLulus } : {},
        ],
      },
      include: attemptInclude,
      orderBy: { created_at: "desc" },
    });

    return ok(res, attempts);
  },
);

router.get(
  "/assessment-attempts/:attempt_id/result",
  enforceDataScope,
  async (req: ScopedRequest, res) => {
    const attemptId = getRequiredParam(req.params, "attempt_id");

    if (!attemptId) {
      return fail(res, 400, "Attempt id is required.");
    }

    const attempt = await prisma.assessmentAttempt.findFirst({
      where: {
        AND: [
          { id: attemptId },
          req.dataScope?.assessmentAttemptWhereClause ?? {},
        ],
      },
      include: attemptInclude,
    });

    if (!attempt) {
      return fail(res, 404, "Attempt not found.");
    }

    return ok(res, attempt);
  },
);

router.get(
  "/assessments/:id/history",
  enforceDataScope,
  async (req: ScopedRequest, res) => {
    const assessmentId = getRequiredParam(req.params, "id");

    if (!assessmentId) {
      return fail(res, 400, "Assessment id is required.");
    }

    const attempts = await prisma.assessmentAttempt.findMany({
      where: {
        AND: [
          { assessment_id: assessmentId },
          req.dataScope?.assessmentAttemptWhereClause ?? {},
        ],
      },
      include: attemptInclude,
      orderBy: { created_at: "desc" },
    });

    return ok(res, attempts);
  },
);

export default router;
