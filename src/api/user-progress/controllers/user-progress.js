'use strict';

/**
 * user-progress controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::user-progress.user-progress', ({ strapi }) => ({
  answerService: strapi.services["api::answer.answer"],

  async submitAssessment(ctx) {
    const input = ctx.request.body;

    if (
      !input.programId ||
      !input.data
    ) {
      ctx.status = 400;
      ctx.body = {
        error: "Missing required parameters",
      };
      return;
    }

    const { programId, data } = input;

    const program = await strapi.entityService.findOne(
      "api::program.program",
      programId,
      {
        populate: {
          assessment: {
            populate: ["file"],
          },
        },
      }
    );
    if (!program) {
      ctx.status = 400;
      ctx.body = {
        error: "Program not found",
      };
    }

    const roughnessResults = []
    const breathinessResults = []
    for (const audio of data) {
      const { duration, identifier, numberOfAttempts, roughness, breathiness } = audio
      let {
        roughness: roughnessReferenceValues,
        breathiness: breathinessReferenceValues
      } = program.assessment.find((f) => f.identifier === identifier);
      roughnessReferenceValues = roughnessReferenceValues.map((v) => parseInt(v, 10));
      breathinessReferenceValues = breathinessReferenceValues.map((v) => parseInt(v, 10));

      const roughnessScore = this.answerService.computeScore({
        answer: roughness,
        values: roughnessReferenceValues
      }).score;
      const breathinessScore = this.answerService.computeScore({
        answer: breathiness,
        values: breathinessReferenceValues
      }).score;

      roughnessResults.push({
        identifier,
        answer: roughness,
        duration,
        numberOfAttempts,
        score: roughnessScore
      })
      breathinessResults.push({
        identifier,
        answer: breathiness,
        duration,
        numberOfAttempts,
        score: breathinessScore
      })
    }

    const userProgress = await strapi.db.query("api::user-progress.user-progress").findOne({
      populate: ["sessions"],
      where: {
        program: programId,
        user: ctx.state.user.id
      }
    })
    const lastSessionId = userProgress.sessions[userProgress.sessions.length - 1].id
    await strapi.entityService.update("api::user-session-progress.user-session-progress", lastSessionId, {
      data: {
        assessmentStatus: "DONE",
        assessmentRoughnessResults: roughnessResults,
        assessmentBreathinessResults: breathinessResults,
        trainingRoughnessStatus: "READY",
        trainingBreathinessStatus: "READY"
      }
    })

    ctx.body = {
      message: "Assessment submitted successfully",
    }
  },

  async submitTraining(ctx) {
    const input = ctx.request.body;

    if (
      !input.programId ||
      !["roughness", "breathiness"].includes(input.feature) ||
      !input.data
    ) {
      ctx.status = 400;
      ctx.body = {
        error: "Missing required parameters",
      };
      return;
    }

    const { programId, feature, data } = input;

    const { mainFeature, secondaryFeature } = features(feature)
    const program = await strapi.entityService.findOne(
      "api::program.program",
      programId,
      {
        populate: {
          training: {
            populate: ["file"],
          },
        },
      }
    );
    if (!program) {
      ctx.status = 400;
      ctx.body = {
        error: "Program not found",
      };
    }

    const results = []
    for (const audio of data) {
      const { duration, identifier, numberOfAttempts, value } = audio
      let referenceValues = program.training.find((f) => f.identifier === identifier)[feature];
      referenceValues = referenceValues.map((v) => parseInt(v, 10));

      const score = this.answerService.computeScore({
        answer: value,
        values: referenceValues
      }).score;

      results.push({
        identifier,
        answer: value,
        duration,
        numberOfAttempts,
        score
      })
    }

    const userProgress = await strapi.db.query("api::user-progress.user-progress").findOne({
      populate: ["sessions"],
      where: {
        program: programId,
        user: ctx.state.user.id
      }
    })
    const lastSession = userProgress.sessions[userProgress.sessions.length - 1]
    const otherFeatureNewStatus = lastSession[`training${secondaryFeature}Status`] === "DONE" ? "DONE" : "WAITING"
    await strapi.entityService.update("api::user-session-progress.user-session-progress", lastSession.id, {
      data: {
        [`training${mainFeature}Status`]: "DONE",
        [`training${mainFeature}Results`]: results,
        [`training${secondaryFeature}Status`]: otherFeatureNewStatus
      }
    })

    ctx.body = {
      message: `Training of ${feature} submitted successfully`,
    }
  }
}));

function features(feature) {
  return {
    mainFeature: feature === "roughness" ? "Roughness" : "Breathiness",
    secondaryFeature: feature === "roughness" ? "Breathiness" : "Roughness",
  }
}
