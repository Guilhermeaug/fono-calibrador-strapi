"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

const { Features } = require("../../../constants");
const { validateYupSchema } = require("../../../helpers");
const revalidationClient = require("../../../utils/revalidation-client");
const { emailTemplateReference } = require("../../email/constants");
const { Status } = require("../constants");
const schemas = require("./schemas");

const dayjs = require("dayjs");

const updateStatus = (current, next) =>
  current !== Status.DONE && current !== Status.NOT_NEEDED ? next : current;

async function scheduleEmailToQueue(data) {
  return strapi.entityService.create("api::email-queue.email-queue", {
    data,
  });
}

function formatEmailDate(date) {
  const dateObj = dayjs(date);
  return {
    day: dateObj.format("DD/MM"),
    hour: dateObj.hour(),
  };
}

module.exports = createCoreController("api::user-progress.user-progress", ({ strapi }) => ({
  answerService: strapi.services["api::answer.answer"],
  userProgressService: strapi.services["api::user-progress.user-progress"],
  emailService: strapi.services["api::email.email"],

  async submitAssessment(ctx) {
    const input = ctx.request.body;
    const auth = ctx.state.user;

    if (!auth) {
      return ctx.unauthorized();
    }

    const errors = await validateYupSchema(schemas.submitAssessmentSchema, input);
    if (errors) {
      return ctx.badRequest(errors);
    }

    const [userProgress, program] = await Promise.all([
      strapi.db.query("api::user-progress.user-progress").findOne({
        populate: ["sessions"],
        where: {
          program: input.programId,
          user: auth.id,
        },
      }),
      strapi.entityService.findOne("api::program.program", input.programId, {
        populate: ["assessment"],
      }),
    ]);

    if (!program || !program.assessment || !userProgress || userProgress.status !== Status.READY) {
      return ctx.badRequest("Cannot process the request " + auth.id);
    }

    strapi.log.info("Submitting assessment for user " + auth.id);

    const { roughnessResults, breathinessResults } = this.answerService.computeAssessmentResults({
      audios: input.audios,
      assessment: program.assessment,
    });

    const userSessionsLength = userProgress.sessions.length;
    const lastSession = userProgress.sessions.pop();

    const getTrainingStatus = (feature) =>
      userSessionsLength === 1 || userSessionsLength === program.numberOfSessions
        ? Status.READY
        : userProgress.favoriteFeature === feature
        ? Status.READY
        : Status.WAITING;

    const updatedSession = {
      assessmentRoughnessResults: {
        startDate: input.startDate,
        endDate: input.endDate,
        audios: roughnessResults,
      },
      assessmentBreathinessResults: {
        startDate: input.startDate,
        endDate: input.endDate,
        audios: breathinessResults,
      },
      assessmentStatus: Status.DONE,
      trainingRoughnessStatus: getTrainingStatus(Features.Roughness),
      trainingBreathinessStatus: getTrainingStatus(Features.Breathiness),
    };

    const [res] = await Promise.all([
      strapi.entityService.update(
        "api::user-session-progress.user-session-progress",
        lastSession.id,
        {
          data: updatedSession,
        }
      ),
      strapi.entityService.update("api::user-progress.user-progress", userProgress.id, {
        data: {
          status: Status.READY,
          nextDueDate: dayjs(input.startDate).add(1, "day").toISOString(),
          nextTimeoutEndDate: null,
        },
      }),
    ]);

    return ctx.send(res, 200);
  },

  async submitTraining(ctx) {
    const input = ctx.request.body;
    const auth = ctx.state.user;

    if (!auth) {
      return ctx.unauthorized();
    }

    const errors = await validateYupSchema(schemas.submitTrainingSchema, input);
    if (errors) {
      return ctx.badRequest(errors);
    }

    const [userProgress, program] = await Promise.all([
      strapi.db.query("api::user-progress.user-progress").findOne({
        populate: {
          sessions: {
            populate: [
              "assessmentRoughnessResults",
              "trainingRoughnessResults",
              "trainingBreathinessResults",
            ],
          },
        },
        where: {
          program: input.programId,
          user: auth.id,
        },
      }),
      strapi.entityService.findOne("api::program.program", input.programId, {
        populate: ["training"],
      }),
    ]);

    if (!program || !program.training || !userProgress || userProgress.status !== Status.READY) {
      return ctx.badRequest("Cannot process the request " + auth.id);
    }

    strapi.log.info("Submitting training for user " + auth.id);

    const userSessionsLength = userProgress.sessions.length;
    const isLastSession = userSessionsLength === program.numberOfSessions;
    const lastSession = userProgress.sessions.pop();
    const favoriteFeature = userProgress.favoriteFeature ?? input.feature;

    if ([Status.DONE, Status.NOT_NEEDED].includes(lastSession.assessmentStatus) === false) {
      return ctx.badRequest("Assessment is not done");
    }

    const results = this.answerService.computeTrainingResults({
      audios: input.audios,
      training: program.training,
      feature: input.feature,
    });

    const updatedSession = {};
    const commom = {
      startDate: input.startDate,
      endDate: input.endDate,
      audios: results,
    };
    if (input.feature === Features.Roughness) {
      updatedSession.trainingRoughnessResults = commom;
      updatedSession.trainingRoughnessStatus = Status.DONE;
      updatedSession.trainingBreathinessStatus = isLastSession
        ? updateStatus(lastSession.trainingBreathinessStatus, Status.READY)
        : updateStatus(lastSession.trainingBreathinessStatus, Status.WAITING);
    } else if (input.feature === Features.Breathiness) {
      updatedSession.trainingBreathinessResults = commom;
      updatedSession.trainingBreathinessStatus = Status.DONE;
      updatedSession.trainingRoughnessStatus = isLastSession
        ? updateStatus(lastSession.trainingRoughnessStatus, Status.READY)
        : updateStatus(lastSession.trainingRoughnessStatus, Status.WAITING);
    }

    const statuses = {
      roughness: updatedSession.trainingRoughnessStatus,
      breathiness: updatedSession.trainingBreathinessStatus,
      assessment: lastSession.assessmentStatus,
    };
    const statusValues = Object.values(statuses);
    const areAllStatusFinished = statusValues.every(
      (status) => status === Status.DONE || status === Status.NOT_NEEDED
    );
    const isAnyStatusReady = statusValues.includes(Status.READY);
    const trainingStatuses = [statuses.roughness, statuses.breathiness];
    const isAnyTrainingWaiting = trainingStatuses.includes(Status.WAITING);
    const isAnyTrainingReady = trainingStatuses.includes(Status.READY);

    const getFavoriteFeatureStartDate = () => {
      if (favoriteFeature === Features.Roughness) {
        return lastSession.trainingRoughnessResults.startDate;
      } else if (favoriteFeature === Features.Breathiness) {
        return lastSession.trainingBreathinessResults.startDate;
      }
    };

    const calculateDueDate = () => {
      if (isAnyTrainingWaiting || isAnyTrainingReady) {
        return dayjs(input.startDate).add(3, "day").toISOString();
      }
      if (areAllStatusFinished && !isLastSession) {
        const lastWeekSessionMarker = lastSession.assessmentRoughnessResults?.startDate
          ? dayjs(lastSession.assessmentRoughnessResults?.startDate)
          : dayjs(getFavoriteFeatureStartDate());
        return dayjs(lastWeekSessionMarker).add(9, "day").toISOString();
      }
      return null;
    };

    const calculateTimeoutEndDate = () => {
      if (isAnyTrainingWaiting) {
        return dayjs(input.startDate).add(1, "day").subtract(1, "hour").toISOString();
      }
      if (areAllStatusFinished && !isLastSession) {
        const lastWeekSessionMarker = lastSession.assessmentRoughnessResults?.startDate
          ? dayjs(lastSession.assessmentRoughnessResults?.startDate)
          : dayjs(getFavoriteFeatureStartDate());
        return dayjs(lastWeekSessionMarker).add(7, "day").subtract(1, "hour").toISOString();
      }
    };

    const newUserStatus =
      areAllStatusFinished && isLastSession
        ? Status.DONE
        : isAnyStatusReady
        ? Status.READY
        : Status.WAITING;
    const nextDueDate = calculateDueDate();
    const timeoutEndDate = calculateTimeoutEndDate();

    const needToCreateExtraSession = !isLastSession && areAllStatusFinished;
    let newSessionId;
    if (needToCreateExtraSession) {
      const isAssessmentNeeded = (userSessionsLength + 1) % 3 === 0;
      const newSession = await strapi.entityService.create(
        "api::user-session-progress.user-session-progress",
        {
          data: {
            trainingRoughnessStatus: Status.WAITING,
            trainingBreathinessStatus: Status.WAITING,
            assessmentStatus: isAssessmentNeeded ? Status.WAITING : Status.NOT_NEEDED,
          },
        }
      );
      newSessionId = newSession.id;
    }

    const { email, name } = auth;

    let emailSchedulePromise = Promise.resolve();
    if (timeoutEndDate) {
      emailSchedulePromise = scheduleEmailToQueue({
        to: email,
        scheduledTime: timeoutEndDate,
        templateReferenceId: emailTemplateReference.reminder,
        data: { user: { name } },
        userProgress: { connect: [userProgress.id] },
      });
      this.emailService.sendEmailTemplate(email, emailTemplateReference.cooldown, {
        user: { name },
        startDate: formatEmailDate(timeoutEndDate),
        endDate: formatEmailDate(nextDueDate),
      });
    }

    const [res] = await Promise.all([
      strapi.entityService.update(
        "api::user-session-progress.user-session-progress",
        lastSession.id,
        { data: updatedSession }
      ),
      strapi.entityService.update("api::user-progress.user-progress", userProgress.id, {
        data: {
          status: newUserStatus,
          nextDueDate,
          timeoutEndDate,
          favoriteFeature,
          ...(newSessionId && { sessions: { connect: [newSessionId] } }),
        },
      }),
      emailSchedulePromise,
    ]);

    return ctx.send(res, 200);
  },

  async alignProgress(ctx) {
    const input = ctx.request.body;
    const auth = ctx.state.user;

    if (!auth) {
      return ctx.unauthorized();
    }

    const errors = await validateYupSchema(schemas.alignProgressSchema, input);
    if (errors) {
      strapi.log.error(errors);
      return ctx.badRequest(errors);
    }

    strapi.log.info("Aligning progress for user " + auth.id);

    const userProgress = await strapi.db.query("api::user-progress.user-progress").findOne({
      where: {
        program: input.programId,
        user: auth.id,
      },
      populate: ["sessions"],
    });
    if (!userProgress) {
      strapi.log.error("User progress not found " + auth.id);
      return ctx.badRequest("Cannot process the request " + auth.id);
    }

    const now = dayjs();
    const nextDueDate = userProgress.nextDueDate && dayjs(userProgress.nextDueDate);
    const timeoutEndDate = userProgress.timeoutEndDate && dayjs(userProgress.timeoutEndDate);

    if (nextDueDate && now.isAfter(nextDueDate)) {
      const updatedUserProgress = await this.userProgressService.invalidate(userProgress.id);
      return ctx.send(updatedUserProgress, 200);
    }

    if (timeoutEndDate && userProgress.status === Status.WAITING && now.isAfter(timeoutEndDate)) {
      const updatedUserProgress = await this.userProgressService.unlock(userProgress.id);
      return ctx.send(updatedUserProgress, 200);
    }

    strapi.log.info("Progress is already aligned for user " + auth.id);
    return ctx.send(userProgress, 200);
  },

  async restartSessions(ctx) {
    const auth = ctx.state.user;

    if (!auth) {
      return ctx.unauthorized();
    }

    const errors = await validateYupSchema(schemas.restartSessionSchema, ctx.request.body);
    if (errors) {
      return ctx.badRequest(errors);
    }

    const { programId } = ctx.request.body;
    const userId = ctx.state.user.id;

    const userProgress = await strapi.db.query("api::user-progress.user-progress").findOne({
      fields: ["id"],
      where: {
        program: programId,
        user: userId,
      },
      populate: {
        sessions: {
          fields: ["id"],
        },
      },
    });

    const [userSessionProgress] = await Promise.all([
      strapi.entityService.create("api::user-session-progress.user-session-progress", {
        data: {
          assessmentStatus: "READY",
        },
      }),
      strapi.db.query("api::user-session-progress.user-session-progress").deleteMany({
        where: {
          id: {
            $in: userProgress.sessions.map((s) => s.id),
          },
        },
      }),
    ]);

    const updated = await strapi.entityService.update(
      "api::user-progress.user-progress",
      userProgress.id,
      {
        data: {
          status: Status.READY,
          nextDueDate: null,
          timeoutEndDate: null,
          favoriteFeature: null,
          sessions: {
            connect: [userSessionProgress.id],
          },
        },
      }
    );

    ctx.status = 200;
    ctx.body = updated;
  },

  async revalidateUser(ctx) {
    const input = ctx.request.body;

    const errors = await validateYupSchema(schemas.revalidateSchema, input);
    if (errors) {
      strapi.log.error(errors);
      return ctx.badRequest(errors);
    }

    strapi.log.info("Revalidating user " + input.userId);

    const userProgress = await strapi.db.query("api::user-progress.user-progress").findOne({
      fields: ["id"],
      where: {
        program: input.programId,
        user: input.userId,
      },
      populate: {
        sessions: {
          fields: ["id"],
        },
      },
    });
    const updatedUserProgress = await this.userProgressService.revalidate(userProgress.id);
    revalidationClient.tag([`group-${input.groupId}`]);
    return ctx.send(updatedUserProgress, 200);
  },

  async clearTimeout(ctx) {
    const input = ctx.request.body;

    const errors = await validateYupSchema(schemas.clearTimeoutSchema, ctx.request.body);
    if (errors) {
      return ctx.badRequest(errors);
    }

    const { programId = 1, userId } = input;

    let userProgress = await strapi.db.query("api::user-progress.user-progress").findOne({
      where: {
        program: programId,
        user: userId,
      },
      populate: ["sessions"],
    });

    if (userProgress.status === Status.WAITING) {
      strapi.log.info("Clearing timeout for user " + userId);
      userProgress = await this.userProgressService.unlock(userProgress.id);
    }

    return ctx.send(userProgress, 200);
  },
}));
