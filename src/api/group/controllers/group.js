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
      ...(user.isAdmin ? {} : { teacher: user.id }),
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

    const hasAccess = user.isAdmin || (entry && entry.teacher.id === user.id);
    if (!entry || !hasAccess) {
      return ctx.unauthorized("You are not authorized to access this entry");
    }

    return super.findOne(ctx);
  },
}));
