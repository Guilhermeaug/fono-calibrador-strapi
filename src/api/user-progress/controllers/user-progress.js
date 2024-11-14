"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

const { Features } = require("../../../constants");
const { validateYupSchema } = require("../../../helpers");
const { Status } = require("../constants");
const schemas = require("./schemas");

const dayjs = require("dayjs");

const updateStatus = (current, next) =>
  current !== Status.DONE && current !== Status.NOT_NEEDED ? next : current;

module.exports = createCoreController("api::user-progress.user-progress", ({ strapi }) => ({
  answerService: strapi.services["api::answer.answer"],
  userProgressService: strapi.services["api::user-progress.user-progress"],

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
      return ctx.badRequest("Cannot process the request");
    }

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

    return ctx.ok(res);
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
        populate: ["sessions"],
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
      return ctx.badRequest("Cannot process the request");
    }

    const userSessionsLength = userProgress.sessions.length;
    const isLastSession = userSessionsLength === program.numberOfSessions;
    const lastSession = userProgress.sessions.pop();

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

    const calculateDueDate = () => {
      if (isAnyTrainingWaiting || isAnyTrainingReady) {
        return dayjs(input.startDate).add(2, "day").toISOString();
      }
      if (areAllStatusDone && !isLastSession) {
        return dayjs(lastSession.assessmentRoughnessResults.startDate).add(8, "day").toISOString();
      }
      return null;
    };

    const calculateTimeoutEndDate = () => {
      if (isAnyTrainingWaiting) {
        return dayjs(input.startDate).add(1, "day").startOf("hour").toISOString();
      }
      if (areAllStatusDone && !isLastSession) {
        return dayjs(lastSession.assessmentRoughnessResults.startDate)
          .add(7, "day")
          .startOf("hour")
          .toISOString();
      }
      return null;
    };

    const statuses = {
      roughness: updatedSession.trainingRoughnessStatus,
      breathiness: updatedSession.trainingBreathinessStatus,
      assessment: lastSession.assessmentStatus,
    };
    const statusValues = Object.values(statuses);
    const areAllStatusDone = statusValues.every((status) => status === Status.DONE);
    const isAnyStatusReady = statusValues.includes(Status.READY);
    const trainingStatuses = [statuses.roughness, statuses.breathiness];
    const isAnyTrainingWaiting = trainingStatuses.includes(Status.WAITING);
    const isAnyTrainingReady = trainingStatuses.includes(Status.READY);

    const newUserStatus =
      areAllStatusDone && isLastSession
        ? Status.DONE
        : isAnyStatusReady
        ? Status.READY
        : Status.WAITING;
    const nextDueDate = calculateDueDate();
    const timeoutEndDate = calculateTimeoutEndDate();

    const needToCreateExtraSession = !isLastSession && areAllStatusDone;
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
          ...(newSessionId && { sessions: { connect: [newSessionId] } }),
        },
      }),
    ]);

    return ctx.ok(res);
  },

  async alignProgress(ctx) {
    const input = ctx.request.body;
    const auth = ctx.state.user;

    if (!auth) {
      return ctx.unauthorized();
    }

    const errors = await validateYupSchema(schemas.alignProgressSchema, input);
    if (errors) {
      return ctx.badRequest(errors);
    }

    const userProgress = await strapi.db.query("api::user-progress.user-progress").findOne({
      where: {
        program: input.programId,
        user: auth.id,
      },
      populate: ["sessions"],
    });
    if (!userProgress) {
      return ctx.badRequest("Cannot process the request");
    }
    if (userProgress.status === Status.INVALID) {
      return ctx.ok(userProgress);
    }

    const lastSessionIndex = userProgress.sessions.length - 1;
    const lastSession = userProgress.sessions[lastSessionIndex];

    const now = dayjs();
    const nextDueDate = userProgress.nextDueDate && dayjs(userProgress.nextDueDate);
    const timeoutEndDate = userProgress.timeoutEndDate && dayjs(userProgress.timeoutEndDate);

    const isAssessmentComplete = [Status.Done, Status.NOT_NEEDED].includes(
      lastSession.assessmentStatus
    );

    const updateStatuses = () => {
      if (userProgress.favoriteFeature === Features.Roughness) {
        if (lastSession.trainingRoughnessStatus === Status.WAITING) {
          return { trainingRoughnessStatus: Status.READY };
        }
        return { trainingBreathinessStatus: Status.READY };
      } else if (userProgress.favoriteFeature === Features.Breathiness) {
        if (lastSession.trainingBreathinessStatus === Status.WAITING) {
          return { trainingBreathinessStatus: Status.READY };
        }
        return { trainingRoughnessStatus: Status.READY };
      }

      return { trainingRoughnessStatus: Status.READY, trainingBreathinessStatus: Status.READY };
    };

    const handleStatusWaiting = async () => {
      if (nextDueDate && now.isAfter(nextDueDate)) {
        const invalidatedUser = await this.userProgressService.invalidate(userProgress.id);
        return ctx.ok(invalidatedUser);
      }

      if (timeoutEndDate && now.isAfter(timeoutEndDate)) {
        const updatedSessionData = isAssessmentComplete
          ? updateStatuses()
          : { assessmentStatus: Status.READY };
        const updatedUserProgressData = {
          status: Status.READY,
          timeoutEndDate: null,
        };
        return { updatedSessionData, updatedUserProgressData };
      }
    };

    const handleStatusReady = async () => {
      if (nextDueDate && now.isAfter(nextDueDate)) {
        const invalidatedUser = await this.userProgressService.invalidate(userProgress.id);
        return ctx.ok(invalidatedUser);
      }
    };

    let updatedUserProgress = {};
    let updatedSession = {};
    switch (userProgress.status) {
      case Status.WAITING:
        const waitingResult = await handleStatusWaiting();
        if (waitingResult && typeof waitingResult === "object") {
          updatedSession = waitingResult.updatedSessionData;
          updatedUserProgress = waitingResult.updatedUserProgressData;
        } else {
          return;
        }
        break;
      case Status.READY:
        await handleStatusReady();
        break;
      default:
        break;
    }

    userProgress.sessions[lastSessionIndex] = {
      ...lastSession,
      ...updatedSession,
    };

    const updatePromises = [];
    if (Object.keys(updatedSession).length) {
      updatePromises.push(
        strapi.entityService.update(
          "api::user-session-progress.user-session-progress",
          lastSession.id,
          { data: updatedSession }
        )
      );
    }
    if (Object.keys(updatedUserProgress).length) {
      updatePromises.push(
        strapi.entityService.update("api::user-progress.user-progress", userProgress.id, {
          data: updatedUserProgress,
        })
      );
    }
    await Promise.all(updatePromises);

    return ctx.ok(userProgress);
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

  async clearTimeout(ctx) {
    const input = ctx.request.body;

    const errors = await validateYupSchema(schemas.clearTimeoutSchema, ctx.request.body);
    if (errors) {
      return ctx.badRequest(errors);
    }

    const { programId = 1, userId } = input;

    const userProgress = await strapi.db.query("api::user-progress.user-progress").findOne({
      where: {
        program: programId,
        user: userId,
      },
      populate: ["sessions"],
    });
    const updatedUserProgress = {};

    if (userProgress.status === Status.WAITING) {
      updatedUserProgress.status = Status.READY;
      updatedUserProgress.timeoutEndDate = null;
    }

    ctx.status = 200;
    if (Object.keys(updatedUserProgress).length === 0) {
      ctx.body = userProgress;
      return;
    }

    const lastSessionIndex = userProgress.sessions.length - 1;
    const lastSession = userProgress.sessions[lastSessionIndex];

    if (lastSession.assessmentStatus === Status.WAITING) {
      lastSession.assessmentStatus = Status.READY;
    } else {
      lastSession.trainingRoughnessStatus =
        lastSession.trainingRoughnessStatus === Status.WAITING
          ? Status.READY
          : lastSession.trainingRoughnessStatus;
      lastSession.trainingBreathinessStatus =
        lastSession.trainingBreathinessStatus === Status.WAITING
          ? Status.READY
          : lastSession.trainingBreathinessStatus;
    }

    await strapi.entityService.update(
      "api::user-session-progress.user-session-progress",
      lastSession.id,
      {
        data: {
          assessmentStatus: lastSession.assessmentStatus,
          trainingRoughnessStatus: lastSession.trainingRoughnessStatus,
          trainingBreathinessStatus: lastSession.trainingBreathinessStatus,
        },
      }
    );
    const updated = await strapi.entityService.update(
      "api::user-progress.user-progress",
      userProgress.id,
      {
        data: {
          status: updatedUserProgress.status,
          timeoutEndDate: updatedUserProgress.timeoutEndDate,
        },
      }
    );

    ctx.body = updated;
  },
}));
