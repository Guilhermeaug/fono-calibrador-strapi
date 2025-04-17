const utils = require("@strapi/utils");
const { Status } = require("../../api/user-progress/constants");
const { CollectionsIdentifier } = require("../../constants");

const { sanitize } = utils;

module.exports = (plugin) => {
  const register = plugin.controllers.auth.register;

  plugin.controllers.auth.register = async (ctx) => {
    try {
      await register(ctx);

      const { email, username, password, ...body } = ctx.request.body;
      const { id: userId } = ctx.response._body.user;

      await strapi.db.transaction(async ({ commit, rollback }) => {
        try {
          const additionalData = await strapi.entityService.create(
            CollectionsIdentifier.AdditionalData,
            {
              data: body,
            }
          );
          const userSessionProgress = await strapi.entityService.create(
            CollectionsIdentifier.UserSessionProgress,
            {
              data: {
                assessmentStatus: Status.READY,
              },
            }
          );
          await strapi.entityService.create(CollectionsIdentifier.UserProgress, {
            data: {
              program: 1,
              user: {
                connect: [userId],
              },
              sessions: { connect: [userSessionProgress.id] },
            },
          });
          const updatedUser = await strapi.entityService.update(
            CollectionsIdentifier.User,
            userId,
            {
              data: {
                additionalData: { connect: [additionalData.id] },
                groups: { connect: [1] },
              },
            }
          );

          ctx.response._body.user = updatedUser;

          commit();
        } catch (error) {
          rollback();
          throw error;
        }
      });

      strapi.log.info(`User registered successfully: ${userId}`);
    } catch (error) {
      strapi.log.error(`Error during user registration: ${error.message}`);

      // If original registration succeeded but our extended process failed
      if (ctx.response._body && ctx.response._body.user) {
        const userId = ctx.response._body.user.id;
        try {
          await strapi.entityService.delete("plugin::users-permissions.user", userId);
          strapi.log.info(`Cleaned up partial user registration: ${userId}`);
        } catch (cleanupError) {
          strapi.log.error(`Failed to clean up partial user: ${cleanupError.message}`);
        }
      }

      return ctx.badRequest("Registration process failed", { error: error.message });
    }
  };

  plugin.controllers.user.find = async (ctx) => {
    const sanitizeOutput = async (user, ctx) => {
      const schema = strapi.getModel("plugin::users-permissions.user");
      const { auth } = ctx.state;

      return sanitize.contentAPI.output(user, schema, { auth });
    };

    const sanitizeQuery = async (query, ctx) => {
      const schema = strapi.getModel("plugin::users-permissions.user");
      const { auth } = ctx.state;

      let sanitizedQuery = await sanitize.contentAPI.query(query, schema, { auth });
      sanitizedQuery = { ...sanitizedQuery, ...sanitizedQuery.pagination };

      return sanitizedQuery;
    };

    const sanitizedQuery = await sanitizeQuery(ctx.query, ctx);

    const { results, pagination } = await strapi.entityService.findPage(
      "plugin::users-permissions.user",
      sanitizedQuery
    );

    const sanitizedResults = await Promise.all(results.map((user) => sanitizeOutput(user, ctx)));

    return ctx.send({
      data: sanitizedResults,
      meta: { pagination },
    });
  };

  return plugin;
};
