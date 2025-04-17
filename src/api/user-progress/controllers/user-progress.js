"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

const { CollectionsIdentifier, CustomServicesIdentifier } = require("../../../constants");
// Removed validateYupSchema as it's not used directly here anymore
const schemas = require("./schemas");

module.exports = createCoreController("api::user-progress.user-progress", ({ strapi }) => ({
  userProgressService: strapi.services[CollectionsIdentifier.UserProgress],
  submissionService: strapi.services[CustomServicesIdentifier.Submission],

  async submitAssessment(ctx) {
    if (!this.userProgressService._validateAuth(ctx)) return;

    const input = ctx.request.body;
    try {
      await schemas.submitAssessmentSchema.validate(input, { abortEarly: false });
    } catch (e) {
      return ctx.badRequest("Validation errors", { errors: e.errors });
    }

    const auth = ctx.state.user;

    try {
      const updatedSession = await this.submissionService.processAssessmentSubmission(auth, input);
      return ctx.send(updatedSession, 200);
    } catch (error) {
      strapi.log.error(
        `Error in submitAssessment controller for user ${auth.id}: ${error.message}`,
        error.stack
      );
      if (
        error.message.startsWith("Cannot process assessment") ||
        error.message.startsWith("User progress is missing")
      ) {
        return ctx.badRequest(error.message);
      }
      return ctx.internalServerError(
        `An error occurred while processing the assessment: ${error.message}`
      );
    }
  },

  async submitTraining(ctx) {
    if (!this.userProgressService._validateAuth(ctx)) return;

    const input = ctx.request.body;
    try {
      await schemas.submitTrainingSchema.validate(input, { abortEarly: false });
    } catch (e) {
      return ctx.badRequest("Validation errors", { errors: e.errors });
    }

    const auth = ctx.state.user;

    try {
      const updatedSession = await this.submissionService.processTrainingSubmission(auth, input);
      return ctx.send(updatedSession, 200);
    } catch (error) {
      strapi.log.error(
        `Error in submitTraining controller for user ${auth.id}: ${error.message}`,
        error.stack
      );
      if (
        error.message.startsWith("Cannot process training") ||
        error.message.startsWith("User progress is missing") ||
        error.message.startsWith("Assessment must be completed")
      ) {
        return ctx.badRequest(error.message);
      }
      return ctx.internalServerError(
        `An error occurred while processing the training: ${error.message}`
      );
    }
  },

  async alignProgress(ctx) {
    if (!this.userProgressService._validateAuth(ctx)) return;

    const input = ctx.request.body;
    try {
      await schemas.alignProgressSchema.validate(input, { abortEarly: false });
    } catch (e) {
      strapi.log.error("Validation errors in alignProgress:", e.errors);
      return ctx.badRequest("Validation errors", { errors: e.errors });
    }

    const auth = ctx.state.user;

    const { programId } = input;
    const userId = auth.id;

    try {
      const updatedUserProgress = await this.userProgressService.alignProgress({
        userId,
        programId,
      });

      if (!updatedUserProgress) {
        return ctx.internalServerError("User progress not found or could not be aligned.");
      }

      return ctx.send(updatedUserProgress, 200);
    } catch (error) {
      strapi.log.error(
        `Error in alignProgress controller for user ${userId}: ${error.message}`,
        error.stack
      );
      return ctx.internalServerError(`An error occurred while aligning progress: ${error.message}`);
    }
  },

  async restartSessions(ctx) {
    if (!this.userProgressService._validateAuth(ctx)) return;

    const input = ctx.request.body;
    try {
      await schemas.restartSessionSchema.validate(input, { abortEarly: false });
    } catch (e) {
      return ctx.badRequest("Validation errors", { errors: e.errors });
    }

    const auth = ctx.state.user;
    const { programId } = input;
    const userId = auth.id;

    try {
      const updatedUserProgress = await this.userProgressService.restartUserProgress({
        userId,
        programId,
      });
      return ctx.send(updatedUserProgress, 200);
    } catch (error) {
      strapi.log.error(
        `Error in restartSessions controller for user ${userId}, program ${programId}: ${error.message}`,
        error.stack
      );
      if (error.message.includes("User progress not found")) {
        return ctx.notFound(error.message);
      }
      return ctx.internalServerError(
        `An error occurred while restarting sessions: ${error.message}`
      );
    }
  },

  async revalidateUser(ctx) {
    const input = ctx.request.body;
    try {
      await schemas.revalidateSchema.validate(input, { abortEarly: false });
    } catch (e) {
      return ctx.badRequest("Validation errors", { errors: e.errors });
    }

    const { userId, programId } = input;

    try {
      const updatedUserProgress = await this.userProgressService.revalidate({ userId, programId });
      return ctx.send(updatedUserProgress, 200);
    } catch (error) {
      strapi.log.error(
        `Error in revalidateUser controller for user ${userId}, program ${programId}: ${error.message}`,
        error.stack
      );
      if (error.message.includes("User progress not found")) {
        return ctx.notFound(error.message); // Use 404 for not found
      }
      return ctx.internalServerError(`An error occurred during revalidation: ${error.message}`);
    }
  },

  async clearTimeout(ctx) {
    const input = ctx.request.body;
    try {
      await schemas.clearTimeoutSchema.validate(input, { abortEarly: false });
    } catch (e) {
      return ctx.badRequest("Validation errors", { errors: e.errors });
    }

    const { userId, programId = 1 } = input;

    try {
      const userProgress = await this.userProgressService.clearUserTimeout({ userId, programId });
      return ctx.send(userProgress, 200);
    } catch (error) {
      strapi.log.error(
        `Error in clearTimeout controller for user ${userId}, program ${programId}: ${error.message}`,
        error.stack
      );
      if (error.message.includes("User progress not found")) {
        return ctx.notFound(error.message); // Use 404 for not found
      }
      return ctx.internalServerError(`An error occurred while clearing timeout: ${error.message}`);
    }
  },
}));
