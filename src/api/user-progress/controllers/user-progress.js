"use strict";

/**
 * user-progress controller
 */
const { createCoreController } = require("@strapi/strapi").factories;
const yup = require("yup");
const dayjs = require("dayjs");
const { Status } = require("../constants");

module.exports = createCoreController("api::user-progress.user-progress", ({ strapi }) => ({
  answerService: strapi.services["api::answer.answer"],

  async submitAssessment(ctx) {
    const input = ctx.request.body;

    const schema = yup.object().shape({
      programId: yup.number().required(),
      startDate: yup.string().required(),
      endDate: yup.string().required(),
      audios: yup.array().of(
        yup.object().shape({
          duration: yup.number().required(),
          identifier: yup.string().required(),
          numberOfAudioClicks: yup.number().required(),
          roughness: yup.number().required(),
          breathiness: yup.number().required(),
        })
      ),
    });

    try {
      await schema.validate(input);
    } catch (error) {
      ctx.status = 400;
      ctx.body = {
        error: error.message,
      };
      return;
    }

    const { programId, startDate, endDate, audios } = input;

    const program = await strapi.entityService.findOne("api::program.program", programId, {
      populate: {
        assessment: {
          populate: ["file"],
        },
      },
    });

    if (!program) {
      ctx.status = 400;
      ctx.body = {
        error: "Program not found",
      };
    }

    const roughnessResults = [];
    const breathinessResults = [];
    for (const audio of audios) {
      const { duration, identifier, numberOfAudioClicks, roughness, breathiness } = audio;
      let { roughness: roughnessReferenceValues, breathiness: breathinessReferenceValues } = program.assessment.find(
        (f) => f.identifier === identifier
      );
      roughnessReferenceValues = roughnessReferenceValues.map((v) => parseInt(v));
      breathinessReferenceValues = breathinessReferenceValues.map((v) => parseInt(v));

      const roughnessScore = this.answerService.computeScore({
        answer: roughness,
        values: roughnessReferenceValues,
      }).score;
      const breathinessScore = this.answerService.computeScore({
        answer: breathiness,
        values: breathinessReferenceValues,
      }).score;

      roughnessResults.push({
        identifier,
        answer: roughness,
        duration,
        numberOfAudioClicks,
        score: roughnessScore,
      });
      breathinessResults.push({
        identifier,
        answer: breathiness,
        duration,
        numberOfAudioClicks,
        score: breathinessScore,
      });
    }

    const userProgress = await strapi.db.query("api::user-progress.user-progress").findOne({
      populate: ["sessions"],
      where: {
        program: programId,
        user: ctx.state.user.id,
      },
    });
    const userSessionsLength = userProgress.sessions.length;
    const lastSessionId = userProgress.sessions[userSessionsLength - 1].id;
    const res = await strapi.entityService.update("api::user-session-progress.user-session-progress", lastSessionId, {
      data: {
        assessmentRoughnessResults: {
          startDate,
          endDate,
          audios: roughnessResults,
        },
        assessmentBreathinessResults: {
          startDate,
          endDate,
          audios: breathinessResults,
        },
        assessmentStatus: "DONE",
        trainingRoughnessStatus: "READY",
        trainingBreathinessStatus: "READY",
      },
    });

    ctx.body = res;
  },

  async submitTraining(ctx) {
    const input = ctx.request.body;

    const schema = yup.object().shape({
      programId: yup.number().required(),
      feature: yup.string().required().oneOf(["roughness", "breathiness"]),
      startDate: yup.string().required(),
      endDate: yup.string().required(),
      audios: yup.array().of(
        yup.object().shape({
          duration: yup.number().required(),
          identifier: yup.string().required(),
          numberOfAttempts: yup.number().required(),
          numberOfAudioClicks: yup.number().required(),
          value: yup.number().required(),
        })
      ),
    });

    try {
      await schema.validate(input);
    } catch (error) {
      ctx.status = 400;
      ctx.body = {
        error: error.message,
      };
      return;
    }

    const { programId, feature, startDate, endDate, audios } = input;

    const userProgress = await strapi.db.query("api::user-progress.user-progress").findOne({
      populate: ["sessions"],
      where: {
        program: programId,
        user: ctx.state.user.id,
      },
    });
    const userSessionsLength = userProgress.sessions.length;
    const lastSession = userProgress.sessions[userSessionsLength - 1];
    if (["DONE", "NOT_NEEDED"].includes(lastSession.assessmentStatus) === false) {
      ctx.status = 400;
      ctx.body = {
        error: "Assessment must be done before training",
      };
      return;
    }

    const { mainFeature, secondaryFeature } = features(feature);
    const program = await strapi.entityService.findOne("api::program.program", programId, {
      populate: {
        training: {
          populate: ["file"],
        },
      },
    });

    if (!program) {
      ctx.status = 400;
      ctx.body = {
        error: "Program not found",
      };
    }

    const results = [];
    for (const audio of audios) {
      const { duration, identifier, numberOfAttempts, numberOfAudioClicks, value } = audio;
      let referenceValues = program.training.find((f) => f.identifier === identifier)[feature];
      referenceValues = referenceValues.map((v) => parseInt(v));

      const score = this.answerService.computeScore({
        answer: value,
        values: referenceValues,
      }).score;

      results.push({
        identifier,
        answer: value,
        duration,
        numberOfAttempts,
        numberOfAudioClicks,
        score,
      });
    }

    let otherFeatureNewStatus = lastSession[`training${secondaryFeature}Status`];
    if (otherFeatureNewStatus === "INVALID") {
      ctx.status = 400;
      ctx.body = {
        error: "Invalid",
      };
    } else if (userSessionsLength === program.numberOfSessions) {
      otherFeatureNewStatus = "DONE";
    } else if (userSessionsLength !== program.numberOfSessions) {
      otherFeatureNewStatus = otherFeatureNewStatus === "DONE" ? "DONE" : "WAITING";
    }

    const res = await strapi.entityService.update("api::user-session-progress.user-session-progress", lastSession.id, {
      data: {
        startDate,
        endDate,
        [`training${secondaryFeature}Status`]: otherFeatureNewStatus,
        [`training${mainFeature}Status`]: "DONE",
        [`training${mainFeature}Results`]: {
          startDate,
          endDate,
          audios: results,
        },
      },
    });

    ctx.body = res;
  },

  async alignProgress(ctx) {
    const schema = yup.object().shape({
      programId: yup.number().required(),
    });

    if (!ctx?.state?.user) {
      ctx.status = 401;
      ctx.body = {
        error: "Unauthorized",
      };
    }

    try {
      await schema.validate(ctx.request.body);
    } catch (error) {
      ctx.status = 400;
      ctx.body = {
        error: error.message,
      };
      return;
    }

    const { programId } = ctx.request.body;
    const userId = ctx.state.user.id;

    const userProgress = await strapi.db.query("api::user-progress.user-progress").findOne({
      where: {
        program: programId,
        user: userId,
      },
      populate: ["sessions"],
    });
    const lastSessionIndex = userProgress.sessions.length - 1;
    const lastSession = userProgress.sessions[lastSessionIndex];

    if (userProgress.status === Status.INVALID) {
      ctx.status = 200;
      ctx.body = userProgress;
      return;
    }

    const now = dayjs();
    const dueDate = userProgress.nextDueDate ? dayjs(userProgress.nextDueDate) : null;
    const timeoutEnd = userProgress.timeoutEndDate ? dayjs(userProgress.timeoutEndDate) : null;

    const assessmentIsOver =
      lastSession.assessmentStatus === Status.DONE || lastSession.assessmentStatus === Status.NOT_NEEDED;
    const updateStatus = (current, next) => (current !== Status.DONE && current !== Status.NOT_NEEDED ? next : current);

    switch (userProgress.status) {
      case Status.WAITING:
        // If the timeout date has passed
        if (timeoutEnd && now.isAfter(timeoutEnd)) {
          if (assessmentIsOver) {
            lastSession.trainingRoughnessStatus = updateStatus(lastSession.trainingRoughnessStatus, Status.READY);
            lastSession.trainingBreathinessStatus = updateStatus(lastSession.trainingBreathinessStatus, Status.READY);
          } else {
            lastSession.assessmentStatus = updateStatus(lastSession.assessmentStatus, Status.READY);
          }
          userProgress.status = Status.READY;
          userProgress.timeoutEndDate = null;
        }
      case Status.READY:
        // If the due date has passed
        if (dueDate && now.isAfter(dueDate)) {
          ["trainingRoughnessStatus", "trainingBreathinessStatus", "assessmentStatus"].forEach((status) => {
            if (lastSession[status] === Status.READY) {
              lastSession[status] = Status.INVALID;
            }
          });
          userProgress.status = Status.INVALID;
          userProgress.nextDueDate = null;
        }
        break;
    }

    userProgress.sessions[lastSessionIndex] = lastSession;

    await Promise.all([
      strapi.entityService.update("api::user-progress.user-progress", userProgress.id, {
        data: {
          status: userProgress.status,
          nextDueDate: userProgress.nextDueDate,
          timeoutEndDate: userProgress.timeoutEndDate,
        },
      }),
      strapi.entityService.update("api::user-session-progress.user-session-progress", lastSession.id, {
        data: {
          trainingRoughnessStatus: lastSession.trainingRoughnessStatus,
          trainingBreathinessStatus: lastSession.trainingBreathinessStatus,
          assessmentStatus: lastSession.assessmentStatus,
        },
      }),
    ]);

    ctx.body = userProgress;
    ctx.status = 200;
  },

  async restartSessions(ctx) {
    const schema = yup.object().shape({
      programId: yup.number().required(),
    });

    if (!ctx?.state?.user) {
      ctx.status = 401;
      ctx.body = {
        error: "Unauthorized",
      };
    }

    try {
      await schema.validate(ctx.request.body);
    } catch (error) {
      ctx.status = 400;
      ctx.body = {
        error: error.message,
      };
      return;
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

    const updated = await strapi.entityService.update("api::user-progress.user-progress", userProgress.id, {
      data: {
        status: Status.READY,
        nextDueDate: null,
        timeoutEndDate: null,
        favoriteFeature: null,
        sessions: {
          connect: [userSessionProgress.id],
        },
      },
    });

    ctx.status = 200;
    ctx.body = updated;
  },
}));

function features(feature) {
  return {
    mainFeature: feature === "roughness" ? "Roughness" : "Breathiness",
    secondaryFeature: feature === "roughness" ? "Breathiness" : "Roughness",
  };
}
