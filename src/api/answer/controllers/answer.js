"use strict";

module.exports = {
  async index(ctx, next) {
    const answerService = strapi.services["api::answer.answer"];

    const input = ctx.request.body;
    if (
      !input.programId ||
      !input.feature ||
      !input.fileIdentifier ||
      input.answer === null ||
      input.session === null ||
      !["roughness", "breathiness"].includes(input.feature)
    ) {
      ctx.status = 400;
      ctx.body = {
        error: "Missing required parameters",
      };
      return;
    }

    const { programId, feature, fileIdentifier, answer, session } = input;

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

    const threshold = program.sessionsThreshold[session - 1]
    const referenceValues = program.training
      .find((f) => f.identifier === fileIdentifier)[feature]
      .map((v) => parseInt(v, 10));

    const result = await answerService.computeScore({
      answer,
      values: referenceValues,
      threshold,
    });

    if (result === null) {
      ctx.status = 400;
      ctx.body = {
        error: "Cannot compute score",
      };
      return;
    }

    ctx.body = result;
  },
};
