'use strict';

/**
 * email-queue router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::email-queue.email-queue');
