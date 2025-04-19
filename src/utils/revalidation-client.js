'use strict'

const { env } = require("@strapi/utils");
const axios = require("axios");

const appUrl = env("APP_URL", "http://localhost:3000");
const revalidateToken = env("REVALIDATE_TOKEN", "revalidate-token");

module.exports = {
  async tag(tags) {
    const url = `${appUrl}/api/revalidateTags?secret=${revalidateToken}`;
    await axios.post(url, { tags });
  },

  async path(path, type) {
    const url = `${appUrl}/api/revalidatePath?secret=${revalidateToken}`;
    await axios.post(url, { path, type });
  }
}
