const { Status } = require("../../api/user-progress/constants");

module.exports = (plugin) => {
  const register = plugin.controllers.auth.register;

  plugin.controllers.auth.register = async (ctx) => {
    await register(ctx);

    const { email, username, password, ...body } = ctx.request.body;
    const { id: userId } = ctx.response._body.user;

    const additionalData = await strapi.entityService.create(
      "api::additional-data.additional-data",
      {
        data: body,
      }
    );
    const userSessionProgress = await strapi.entityService.create(
      "api::user-session-progress.user-session-progress",
      {
        data: {
          assessmentStatus: Status.READY,
        },
      }
    );

    await strapi.entityService.create("api::user-progress.user-progress", {
      data: {
        program: 1,
        user: {
          connect: [userId],
        },
        sessions: { connect: [userSessionProgress.id] },
      },
    });
    const updatedUser = await strapi.entityService.update(
      "plugin::users-permissions.user",
      userId,
      {
        data: {
          additionalData: { connect: [additionalData.id] },
        },
      }
    );
    await strapi.entityService.update("api::group.group", 1, {
      data: {
        students: {
          connect: [userId],
        },
      },
    });

    ctx.response._body.user = updatedUser;
  };

  return plugin;
};
