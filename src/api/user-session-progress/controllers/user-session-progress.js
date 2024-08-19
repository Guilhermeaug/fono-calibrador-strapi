'use strict';

/**
 * user-session-progress controller
 */

const { createCoreController } = require('@strapi/strapi').factories;
const yup = require('yup');

module.exports = createCoreController('api::user-session-progress.user-session-progress', ({ strapi }) => ({
  invalidateUserSession: async (ctx) => {
    const schema = yup.object().shape({
      sessionId: yup.number().required(),
      keys: yup.array().of(yup.string()).required(),
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

    const { sessionId, keys } = ctx.request.body;

    const updateSessionProgress = {};
    for (const key of keys) {
      updateSessionProgress[key] = 'INVALID'
    }
    const res = await strapi.entityService.update('api::user-session-progress.user-session-progress', sessionId, {
      data: updateSessionProgress,
    });

    if (!res) {
      ctx.status = 500;
      ctx.body = {
        error: 'Error updating session progress',
      };
      return;
    }

    ctx.status = 200;
  }
}));

