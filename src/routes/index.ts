import { Router } from "express";

import activityLogRouter from "./activity-log.routes";
import assessmentRouter from "./assessment.routes";
import authRouter from "./auth.routes";
import certificateRouter from "./certificate.routes";
import courseRouter from "./course.routes";
import enrollmentRouter from "./enrollment.routes";
import lessonRouter from "./lesson.routes";
import notificationRouter from "./notification.routes";
import scormRouter from "./scorm.routes";
import settingsRouter from "./settings.routes";
import sekolahRouter from "./sekolah.routes";
import skillhubRouter from "./skillhub.routes";
import usersRouter from "./users.routes";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    app: "BrightEd LMS Backend",
    status: "ok",
  });
});

router.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
  });
});

router.use("/auth", authRouter);
router.use(activityLogRouter);
router.use("/sekolah", sekolahRouter);
router.use(settingsRouter);
router.use(notificationRouter);
router.use("/users", usersRouter);
router.use("/enrollments", enrollmentRouter);
router.use("/skillhubs", skillhubRouter);
router.use(courseRouter);
router.use(lessonRouter);
router.use(assessmentRouter);
router.use(scormRouter);
router.use(certificateRouter);

export default router;
