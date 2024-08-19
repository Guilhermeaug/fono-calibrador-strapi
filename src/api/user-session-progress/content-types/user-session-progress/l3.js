"use strict";

const dayjs = require('dayjs');

const Status = {
  DONE: "DONE",
  READY: "READY",
  WAITING: "WAITING",
  NOT_NEEDED: "NOT_NEEDED",
  INVALID: "INVALID",
};

const TIMEOUTS = {
  ONE_DAY: { days: 1 },
  TWO_DAYS: { days: 2 },
  SEVEN_DAYS: { days: 7 },
  EIGHT_DAYS: { days: 8 },
  ONE_MINUTE: { minutes: 1 },
  TWO_MINUTES: { minutes: 2 },
  THREE_MINUTES: { minutes: 3 },
};

const EmailTemplateReference = {
  PROGRAM_COMPLETED: 4,
  ONE_DAY_COOLDOWN: 2,
  SEVEN_DAY_COOLDOWN: 3,
  REMINDER: 5,
};

const isStatus = (status, expected) => status === expected;

const changedStatus = (current, next, from, to) => current === from && next === to;

const getNextTimeout = (timeout) => dayjs().add(timeout).toDate();

async function findUserProgressBySessionId(sessionId) {
  try {
    return await strapi.db.query("api::user-progress.user-progress").findOne({
      populate: {
        sessions: true,
        program: true,
        user: { populate: { additionalData: true } },
      },
      where: { sessions: { $in: [sessionId] } },
    });
  } catch (error) {
    console.error("Error fetching user progress:", error);
    return null;
  }
}

const setEventState = (event, state) => { event.state = state; };

async function handleStatusTransition(event) {
  const { data, where } = event.params;
  const current = await strapi.entityService.findOne("api::user-session-progress.user-session-progress", where.id);

  const currentStates = {
    roughness: current.trainingRoughnessStatus,
    breathiness: current.trainingBreathinessStatus,
    assessment: current.assessmentStatus,
  };

  const nextStates = {
    roughness: data.trainingRoughnessStatus || currentStates.roughness,
    breathiness: data.trainingBreathinessStatus || currentStates.breathiness,
    assessment: data.assessmentStatus || currentStates.assessment,
  };

  if (changedStatus(currentStates.roughness, nextStates.roughness, Status.READY, Status.DONE) && isStatus(nextStates.breathiness, Status.WAITING)) {
    setEventState(event, "1-day:cooldown;trainingBreathinessStatus");
  } else if (changedStatus(currentStates.breathiness, nextStates.breathiness, Status.READY, Status.DONE) && isStatus(nextStates.roughness, Status.WAITING)) {
    setEventState(event, "1-day:cooldown;trainingRoughnessStatus");
  } else if (Object.values(nextStates).every(status => status === Status.DONE || status === Status.NOT_NEEDED)) {
    setEventState(event, "7-day:cooldown");
  } else if (Object.values(nextStates).includes(Status.INVALID)) {
    setEventState(event, "invalidate-user");
  }
}

async function handleAfterUpdate(event) {
  const { result = {}, params: { where } } = event;
  const emailService = strapi.services["api::email.email"];
  const cronService = strapi.services["api::cron.cron"];
  const userProgress = await findUserProgressBySessionId(result.id);

  if (!userProgress) return;

  const { email, additionalData: { name } } = userProgress.user;
  const userPayload = { name };
  const currentSessionsLength = userProgress.sessions.length;
  const updatedUserProgress = {};

  const [eventName, eventKey] = String(event.state).split(";");

  const statuses = {
    roughness: result.trainingRoughnessStatus,
    breathiness: result.trainingBreathinessStatus,
    assessment: result.assessmentStatus,
  };

  updatedUserProgress.status = Object.values(statuses).includes(Status.INVALID)
    ? Status.INVALID
    : Object.values(statuses).includes(Status.READY)
      ? Status.READY
      : Status.WAITING;

  if (eventName === "1-day:cooldown") {
    handleCooldown(emailService, cronService, email, userPayload, where.id, eventKey, TIMEOUTS.ONE_MINUTE, TIMEOUTS.TWO_MINUTES, updatedUserProgress, EmailTemplateReference.ONE_DAY_COOLDOWN);
  } else if (eventName === "7-day:cooldown") {
    await handleSevenDayCooldown(emailService, cronService, strapi, userProgress, currentSessionsLength, userPayload, where.id, updatedUserProgress);
  } else if (eventName === "invalidate-user") {
    console.warn("AfterUpdate - Invalidating User Progress");
  }

  if (Object.keys(updatedUserProgress).length > 0) {
    await strapi.entityService.update("api::user-progress.user-progress", userProgress.id, { data: updatedUserProgress });
  }
}

function handleCooldown(emailService, cronService, email, userPayload, sessionId, eventKey, transitionTimeout, verifyTimeout, updatedUserProgress, emailTemplateReference) {
  console.warn("AfterUpdate - Sending Email to User (cooldown)");

  console.log({email, emailTemplateReference, userPayload})
  emailService.sendEmailTemplate(email, emailTemplateReference, {
    user: userPayload,
    startDate: formatDate(dayjs().add(1, 'day')),
    endDate: formatDate(dayjs().add(2, 'day').add(1, 'hour')),
  });

  cronService.scheduleVerify({
    schedule: getNextTimeout(verifyTimeout),
    userSessionId: sessionId,
    state: { $eq: { [eventKey]: Status.DONE } },
  });

  cronService.scheduleStatusTransition({
    schedule: getNextTimeout(transitionTimeout),
    userSessionId: sessionId,
    state: { [eventKey]: Status.READY },
  });

  cronService.scheduleRememberEmail({
    schedule: getNextTimeout(transitionTimeout),
    userSessionId: sessionId,
    emailTemplate: {
      templateReferenceId: EmailTemplateReference.REMINDER,
      to: email,
      data: { user: userPayload },
    },
    state: { [eventKey]: Status.DONE },
  });
}

async function handleSevenDayCooldown(emailService, cronService, strapi, userProgress, currentSessionsLength, userPayload, sessionId, updatedUserProgress) {
  const { numberOfSessions } = userProgress.program;
  const isAssessmentNeeded = (currentSessionsLength + 1) % 3 === 0;

  if (numberOfSessions === currentSessionsLength) {
    updatedUserProgress.status = Status.DONE;
    strapi.log.warn("AfterUpdate", "Sending Email to User - Program Done");
    emailService.sendEmailTemplate(userProgress.user.email, EmailTemplateReference.PROGRAM_COMPLETED, { user: userPayload });
  } else {
    console.warn("AfterUpdate", "Sending Email to User (7-day:cooldown)");
    const newSessionAssessmentStatus = isAssessmentNeeded ? Status.WAITING : Status.NOT_NEEDED;

    const newSession = await strapi.entityService.create("api::user-session-progress.user-session-progress", {
      data: { assessmentStatus: newSessionAssessmentStatus },
    });

    updatedUserProgress.sessions = [...userProgress.sessions.map(s => s.id), newSession.id];

    emailService.sendEmailTemplate(userProgress.user.email, EmailTemplateReference.SEVEN_DAY_COOLDOWN, {
      user: userPayload,
      startDate: formatDate(dayjs().add(7, 'day')),
      endDate: formatDate(dayjs().add(8, 'day').add(1, 'hour')),
    });

    scheduleTasks(cronService, newSession.id, isAssessmentNeeded, userProgress.user.email, userPayload);
  }
}

function scheduleTasks(cronService, sessionId, isAssessmentNeeded, email, userPayload) {
  const verifyState = isAssessmentNeeded
    ? { $eq: { assessmentStatus: Status.DONE }, $or: { trainingRoughnessStatus: Status.DONE, trainingBreathinessStatus: Status.DONE } }
    : { $or: { trainingRoughnessStatus: Status.DONE, trainingBreathinessStatus: Status.DONE } };

  cronService.scheduleVerify({
    schedule: getNextTimeout(TIMEOUTS.THREE_MINUTES),
    userSessionId: sessionId,
    state: verifyState,
  });

  const transitionState = isAssessmentNeeded
    ? { assessmentStatus: Status.READY }
    : { trainingRoughnessStatus: Status.READY, trainingBreathinessStatus: Status.READY };

  cronService.scheduleStatusTransition({
    schedule: getNextTimeout(TIMEOUTS.ONE_MINUTE),
    userSessionId: sessionId,
    state: transitionState,
  });

  cronService.scheduleRememberEmail({
    schedule: getNextTimeout(TIMEOUTS.ONE_MINUTE),
    userSessionId: sessionId,
    emailTemplate: {
      templateReferenceId: EmailTemplateReference.REMINDER,
      to: email,
      data: { user: userPayload },
    },
    state: { assessmentStatus: Status.DONE },
  });
}

function formatDate(date) {
  return {
    day: date.format('DD/MM'),
    hour: date.hour()
  };
}

module.exports = {
  async beforeUpdate(event) {
    await handleStatusTransition(event);
  },
  async afterUpdate(event) {
    await handleAfterUpdate(event);
  },
};
