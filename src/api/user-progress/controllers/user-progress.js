"use strict";

/**
 * user-progress controller
 */
const { createCoreController } = require("@strapi/strapi").factories;
const yup = require("yup");

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

  async acceptTerms(ctx) {
    const schema = yup.object().shape({
      userId: yup.number().required(),
    });

    try {
      await schema.validate(ctx.request.body);
    } catch (error) {
      ctx.status = 400;
      ctx.body = {
        error: error.message,
      };
      return;
    }

    const { userId } = ctx.request.body;

    await strapi.entityService.update("plugin::users-permissions.user", userId, {
      data: {
        hasAcceptedTerms: true,
      },
    });

    ctx.body = {
      message: "Terms accepted successfully",
    };
  },

  async acceptPac(ctx) {
    const schema = yup.object().shape({
      userId: yup.number().required(),
    });

    try {
      await schema.validate(ctx.request.body);
    } catch (error) {
      ctx.status = 400;
      ctx.body = {
        error: error.message,
      };
      return;
    }

    const { userId } = ctx.request.body;

    await strapi.entityService.update("plugin::users-permissions.user", userId, {
      data: {
        hasCompletedPac: true,
      },
    });

    const userSessionProgress = await strapi.entityService.create("api::user-session-progress.user-session-progress", {
      data: {
        assessmentStatus: "READY",
      },
    });
    await strapi.entityService.create("api::user-progress.user-progress", {
      data: {
        user: userId,
        program: 1,
        sessions: [userSessionProgress.id],
      },
    });

    ctx.body = {
      message: "Pac accepted successfully",
    };
  },
}));

function features(feature) {
  return {
    mainFeature: feature === "roughness" ? "Roughness" : "Breathiness",
    secondaryFeature: feature === "roughness" ? "Breathiness" : "Roughness",
  };
}
