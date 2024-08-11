'use strict'

module.exports = {
  // afterCreate(event) {
  //   // const { result = {} } = event

  //   // if ((result?.assessmentStatus === 'WAITING' || result?.assessmentStatus === 'NOT_NEEDED') && result?.trainingRoughnessStatus === 'WAITING' && result?.trainingBreathinessStatus === 'WAITING') {
  //   //   console.warn("AfterCreate", "Sending Email do User")
  //   // }
  // },

  async beforeUpdate(event) {
    const { data, where } = event.params

    const current = await strapi.entityService.findOne("api::user-session-progress.user-session-progress", where.id)
    const currentTrainingRoughness = current.trainingRoughnessStatus
    const currentTrainingBreathiness = current.trainingBreathinessStatus
    const currentAssessment = current.assessmentStatus
    const nextTrainingRoughness = data.trainingRoughnessStatus || currentTrainingRoughness
    const nextTrainingBreathiness = data.trainingBreathinessStatus || currentTrainingBreathiness
    const nextAssessment = data.assessmentStatus || currentAssessment

    // If one of the trainingStatus goes to DONE and the other one goes to WAITING
    // Then, set a 1-day state
    if (changedFromTo(currentTrainingRoughness, nextTrainingRoughness, isReady, isDone) && isWaiting(nextTrainingBreathiness)) {
      event.state = '1-day'
    }
    if (changedFromTo(currentTrainingBreathiness, nextTrainingBreathiness, isReady, isDone) && isWaiting(nextTrainingRoughness)) {
      event.state = '1-day'
    }

    if (isDone(nextTrainingRoughness) && isDone(nextTrainingBreathiness) && isDone(nextAssessment)) {
      event.state = '7-day'
    }
  },

  async afterUpdate(event) {
    const { result = {} } = event
    const { data } = event.params

    const userProgress = await strapi.db.query("api::user-progress.user-progress").findOne({
      fields: [],
      populate: [{
        sessions: {
          fields: ['id']
        },
        program: {
          fields: ['numberOfSessions', 'id']
        }
      }],
      where: {
        sessions: {
          $in: [result.id]
        }
      }
    })

    const currentSessionsLength = userProgress.sessions.length
    const updatedUserProgress = {}
    if (result?.assessmentStatus === 'DONE' && result?.trainingRoughnessStatus === 'DONE' && result?.trainingBreathinessStatus === 'DONE') {
      if (userProgress.program.numberOfSessions === currentSessionsLength) {
        updatedUserProgress.status = 'DONE'
      } else {
        const isAssessmentNeeded = (currentSessionsLength + 1) % 3 === 0
        const newSession = strapi.entityService.create("api::user-session-progress.user-session-progress", {
          data: {
            assessmentStatus: isAssessmentNeeded ? 'WAITING' : 'NOT_NEEDED'
          }
        })
        updatedUserProgress.sessions = [...userProgress.sessions, newSession.id]
      }
    }
  }
}

function isDone(status) {
  return status === 'DONE'
}

function isReady(status) {
  return status === 'READY'
}

function isWaiting(status) {
  return status === 'WAITING'
}

function isNotNeeded(status) {
  return status === 'NOT_NEEDED'
}

function changedFromTo(current, next, from, to) {
  return current === from && next === to
}
