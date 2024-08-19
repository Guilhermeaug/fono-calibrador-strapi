'use strict';

/**
 * email-queue controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::email-queue.email-queue');
