'use strict';

/**
 * email-queue service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::email-queue.email-queue');
