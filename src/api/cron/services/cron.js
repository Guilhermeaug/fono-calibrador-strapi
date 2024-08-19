'use strict';

/**
 * cron service
 */
const { env } = require("@strapi/utils");
const axios = require('axios');

module.exports = () => ({
  scheduleVerify: async (data) => {
    try {
      await axios.post(`${env("CRON_API")}/verify`, data)
    } catch (error) {
      return error;
    }
  },
  scheduleRememberEmail: async (data) => {
    try {
      await axios.post(`${env("CRON_API")}/send-email`, data)
    } catch (error) {
      return error;
    }
  },
  scheduleStatusTransition: async (data) => {
    try {
      await axios.post(`${env("CRON_API")}/transition`, data)
    } catch (error) {
      return error;
    }
  }
});
