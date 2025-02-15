module.exports = {
  async up() {
    await strapi.db.transaction(async () => {
      await strapi.db.query("plugin::users-permissions.user").updateMany({
        data: {
          isAdmin: false,
        },
      });
    });
  },
};
