module.exports = (plugin) => {
  const register = plugin.controllers.auth.register;

  plugin.controllers.auth.register = async (ctx) => {
    await register(ctx);

    const { email, username, password, ...body } = ctx.request.body;
    const { id: userId } = ctx.response._body.user;

    const additionalData = await strapi.entityService.create("api::additional-data.additional-data", {
      data: {
        ...body,
      },
    });
    const updatedUser = strapi.entityService.update("plugin::users-permissions.user", userId, {
      data: {
        additionalData: additionalData.id,
      },
    });

    ctx.response._body.user = updatedUser;
  };

  return plugin;
};
