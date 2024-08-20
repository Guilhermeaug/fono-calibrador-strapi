module.exports = (plugin) => {
  const register = plugin.controllers.auth.register;

  plugin.controllers.auth.register = async (ctx) => {
    await register(ctx);

    const { email, username, password, ...body } = ctx.request.body;
    const { id: userId } = ctx.response._body.user;

    const [additionalData, userSessionProgress] = await Promise.all([
      strapi.entityService.create("api::additional-data.additional-data", {
        data: {
          ...body,
        },
      }),
      strapi.entityService.create("api::user-session-progress.user-session-progress", {
        data: {
          assessmentStatus: "READY",
        },
      }),
    ]);
    const [_, updatedUser] = await Promise.all([
      strapi.entityService.create("api::user-progress.user-progress", {
        data: {
          user: userId,
          program: 1,
          sessions: [userSessionProgress.id],
        },
      }),
      strapi.entityService.update("plugin::users-permissions.user", userId, {
        data: {
          additionalData: additionalData.id,
        },
      }),
    ]);

    ctx.response._body.user = updatedUser;
  };

  return plugin;
};
