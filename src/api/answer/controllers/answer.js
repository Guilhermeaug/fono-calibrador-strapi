"use strict";

/**
 * answer controller
 */
module.exports = {
  /**
   * Fetches program with training data
   * @param {number} programId - Program ID
   * @returns {Promise<Object|null>} - Program data or null
   */
  async _fetchProgram(programId) {
    return strapi.entityService.findOne("api::program.program", programId, {
      populate: {
        training: {
          populate: ["file"],
        },
      },
    });
  },

  /**
   * Validates input for answer processing
   * @param {Object} input - Input data
   * @returns {boolean} - True if valid input
   */
  _validateInput(input) {
    return (
      input.programId !== undefined &&
      input.feature &&
      input.fileIdentifier &&
      input.answer !== null &&
      input.session !== null &&
      ["roughness", "breathiness"].includes(input.feature)
    );
  },

  /**
   * Sends error response
   * @param {Object} ctx - Koa context
   * @param {number} status - HTTP status code
   * @param {string} message - Error message
   */
  _sendError(ctx, status, message) {
    ctx.status = status;
    ctx.body = {
      error: message,
    };
  },

  /**
   * Processes an answer against reference values to compute a score
   * @param {Object} ctx - Koa context
   * @param {Function} next - Koa next function
   * @returns {Promise<Object>} - Response with score
   */
  async index(ctx, next) {
    try {
      const answerService = strapi.services["api::answer.answer"];
      const input = ctx.request.body;

      if (!this._validateInput(input)) {
        return this._sendError(ctx, 400, "Missing or invalid required parameters");
      }

      const { programId, feature, fileIdentifier, answer, session } = input;

      const program = await this._fetchProgram(programId);
      if (!program) {
        return this._sendError(ctx, 400, "Program not found");
      }

      const threshold = program.sessionsThreshold[session - 1];

      const trainingItem = program.training.find((f) => f.identifier === fileIdentifier);
      if (!trainingItem) {
        return this._sendError(ctx, 400, "Training file not found");
      }

      const referenceValues = trainingItem[feature].map((v) => parseInt(v, 10));

      const result = await answerService.computeScore({
        answer,
        values: referenceValues,
        threshold,
      });

      if (result === null) {
        return this._sendError(ctx, 400, "Cannot compute score");
      }

      ctx.body = result;
    } catch (error) {
      strapi.log.error(`Error processing answer: ${error.message}`);
      return this._sendError(ctx, 500, "An error occurred while processing the answer");
    }
  },
};
