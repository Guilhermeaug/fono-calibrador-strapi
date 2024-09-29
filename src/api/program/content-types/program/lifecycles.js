"use strict";

const revalidationClient = require("../../../../utils/revalidationClient");

module.exports = {
  async afterUpdate(event) {
    const { where } = event.params;

    const tags = ["programs", `program-${where.id}`];
    revalidationClient.tag(tags);
  },
  async afterCreate(event) {
    revalidationClient.tag(["programs"]);
  },
};
