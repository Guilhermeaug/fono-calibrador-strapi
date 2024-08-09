"use strict";

module.exports = {
  async index(ctx, next) {
    const answerService = strapi.services["api::answer.answer"];

    const input = ctx.request.body;

    if (
      !input.programId ||
      !input.section ||
      !input.feature ||
      !input.fileIdentifier ||
      !input.answer === null ||
      !input.session === null ||
      !["roughness", "breathiness"].includes(input.feature) ||
      !["assessment", "training"].includes(input.section)
    ) {
      ctx.status = 400;
      ctx.body = {
        error: "Missing required parameters",
      };
      return;
    }

    const { programId, section, feature, fileIdentifier, answer, session } = input;

    const result = await answerService.computeScore({
      programId,
      section,
      feature,
      fileIdentifier,
      answer,
      session
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
