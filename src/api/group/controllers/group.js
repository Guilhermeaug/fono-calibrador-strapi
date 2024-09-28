"use strict";

/**
 * group controller
 */
const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::group.group", ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user;

    ctx.query.filters = {
      ...(ctx.query.filters || {}),
      teacher: user.id,
    };

    return super.find(ctx);
  },
  async findOne(ctx) {
    const user = ctx.state.user;
    const entryId = ctx.params.id;
    let entry = null;

    if (entryId) {
      entry = await strapi.entityService.findOne("api::group.group", entryId, {
        populate: {
          teacher: {
            fields: ["id"],
          },
        },
      });
    }

    if (!entry || entry.teacher.id !== user.id) {
      return ctx.unauthorized("You are not authorized to access this entry");
    }

    return super.findOne(ctx);
  },
}));
