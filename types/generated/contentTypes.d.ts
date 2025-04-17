import type { Schema, Attribute } from "@strapi/strapi";

export interface AdminPermission extends Schema.CollectionType {
  collectionName: "admin_permissions";
  info: {
    name: "Permission";
    description: "";
    singularName: "permission";
    pluralName: "permissions";
    displayName: "Permission";
  };
  pluginOptions: {
    "content-manager": {
      visible: false;
    };
    "content-type-builder": {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    actionParameters: Attribute.JSON & Attribute.DefaultTo<{}>;
    subject: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    properties: Attribute.JSON & Attribute.DefaultTo<{}>;
    conditions: Attribute.JSON & Attribute.DefaultTo<[]>;
    role: Attribute.Relation<"admin::permission", "manyToOne", "admin::role">;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<"admin::permission", "oneToOne", "admin::user"> &
      Attribute.Private;
    updatedBy: Attribute.Relation<"admin::permission", "oneToOne", "admin::user"> &
      Attribute.Private;
  };
}

export interface AdminUser extends Schema.CollectionType {
  collectionName: "admin_users";
  info: {
    name: "User";
    description: "";
    singularName: "user";
    pluralName: "users";
    displayName: "User";
  };
  pluginOptions: {
    "content-manager": {
      visible: false;
    };
    "content-type-builder": {
      visible: false;
    };
  };
  attributes: {
    firstname: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    lastname: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    username: Attribute.String;
    email: Attribute.Email &
      Attribute.Required &
      Attribute.Private &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    password: Attribute.Password &
      Attribute.Private &
      Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    resetPasswordToken: Attribute.String & Attribute.Private;
    registrationToken: Attribute.String & Attribute.Private;
    isActive: Attribute.Boolean & Attribute.Private & Attribute.DefaultTo<false>;
    roles: Attribute.Relation<"admin::user", "manyToMany", "admin::role"> & Attribute.Private;
    blocked: Attribute.Boolean & Attribute.Private & Attribute.DefaultTo<false>;
    preferedLanguage: Attribute.String;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<"admin::user", "oneToOne", "admin::user"> & Attribute.Private;
    updatedBy: Attribute.Relation<"admin::user", "oneToOne", "admin::user"> & Attribute.Private;
  };
}

export interface AdminRole extends Schema.CollectionType {
  collectionName: "admin_roles";
  info: {
    name: "Role";
    description: "";
    singularName: "role";
    pluralName: "roles";
    displayName: "Role";
  };
  pluginOptions: {
    "content-manager": {
      visible: false;
    };
    "content-type-builder": {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    code: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    description: Attribute.String;
    users: Attribute.Relation<"admin::role", "manyToMany", "admin::user">;
    permissions: Attribute.Relation<"admin::role", "oneToMany", "admin::permission">;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<"admin::role", "oneToOne", "admin::user"> & Attribute.Private;
    updatedBy: Attribute.Relation<"admin::role", "oneToOne", "admin::user"> & Attribute.Private;
  };
}

export interface AdminApiToken extends Schema.CollectionType {
  collectionName: "strapi_api_tokens";
  info: {
    name: "Api Token";
    singularName: "api-token";
    pluralName: "api-tokens";
    displayName: "Api Token";
    description: "";
  };
  pluginOptions: {
    "content-manager": {
      visible: false;
    };
    "content-type-builder": {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    description: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Attribute.DefaultTo<"">;
    type: Attribute.Enumeration<["read-only", "full-access", "custom"]> &
      Attribute.Required &
      Attribute.DefaultTo<"read-only">;
    accessKey: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    lastUsedAt: Attribute.DateTime;
    permissions: Attribute.Relation<"admin::api-token", "oneToMany", "admin::api-token-permission">;
    expiresAt: Attribute.DateTime;
    lifespan: Attribute.BigInteger;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<"admin::api-token", "oneToOne", "admin::user"> &
      Attribute.Private;
    updatedBy: Attribute.Relation<"admin::api-token", "oneToOne", "admin::user"> &
      Attribute.Private;
  };
}

export interface AdminApiTokenPermission extends Schema.CollectionType {
  collectionName: "strapi_api_token_permissions";
  info: {
    name: "API Token Permission";
    description: "";
    singularName: "api-token-permission";
    pluralName: "api-token-permissions";
    displayName: "API Token Permission";
  };
  pluginOptions: {
    "content-manager": {
      visible: false;
    };
    "content-type-builder": {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    token: Attribute.Relation<"admin::api-token-permission", "manyToOne", "admin::api-token">;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<"admin::api-token-permission", "oneToOne", "admin::user"> &
      Attribute.Private;
    updatedBy: Attribute.Relation<"admin::api-token-permission", "oneToOne", "admin::user"> &
      Attribute.Private;
  };
}

export interface AdminTransferToken extends Schema.CollectionType {
  collectionName: "strapi_transfer_tokens";
  info: {
    name: "Transfer Token";
    singularName: "transfer-token";
    pluralName: "transfer-tokens";
    displayName: "Transfer Token";
    description: "";
  };
  pluginOptions: {
    "content-manager": {
      visible: false;
    };
    "content-type-builder": {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    description: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Attribute.DefaultTo<"">;
    accessKey: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    lastUsedAt: Attribute.DateTime;
    permissions: Attribute.Relation<
      "admin::transfer-token",
      "oneToMany",
      "admin::transfer-token-permission"
    >;
    expiresAt: Attribute.DateTime;
    lifespan: Attribute.BigInteger;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<"admin::transfer-token", "oneToOne", "admin::user"> &
      Attribute.Private;
    updatedBy: Attribute.Relation<"admin::transfer-token", "oneToOne", "admin::user"> &
      Attribute.Private;
  };
}

export interface AdminTransferTokenPermission extends Schema.CollectionType {
  collectionName: "strapi_transfer_token_permissions";
  info: {
    name: "Transfer Token Permission";
    description: "";
    singularName: "transfer-token-permission";
    pluralName: "transfer-token-permissions";
    displayName: "Transfer Token Permission";
  };
  pluginOptions: {
    "content-manager": {
      visible: false;
    };
    "content-type-builder": {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    token: Attribute.Relation<
      "admin::transfer-token-permission",
      "manyToOne",
      "admin::transfer-token"
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<"admin::transfer-token-permission", "oneToOne", "admin::user"> &
      Attribute.Private;
    updatedBy: Attribute.Relation<"admin::transfer-token-permission", "oneToOne", "admin::user"> &
      Attribute.Private;
  };
}

export interface PluginUploadFile extends Schema.CollectionType {
  collectionName: "files";
  info: {
    singularName: "file";
    pluralName: "files";
    displayName: "File";
    description: "";
  };
  pluginOptions: {
    "content-manager": {
      visible: false;
    };
    "content-type-builder": {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String & Attribute.Required;
    alternativeText: Attribute.String;
    caption: Attribute.String;
    width: Attribute.Integer;
    height: Attribute.Integer;
    formats: Attribute.JSON;
    hash: Attribute.String & Attribute.Required;
    ext: Attribute.String;
    mime: Attribute.String & Attribute.Required;
    size: Attribute.Decimal & Attribute.Required;
    url: Attribute.String & Attribute.Required;
    previewUrl: Attribute.String;
    provider: Attribute.String & Attribute.Required;
    provider_metadata: Attribute.JSON;
    related: Attribute.Relation<"plugin::upload.file", "morphToMany">;
    folder: Attribute.Relation<"plugin::upload.file", "manyToOne", "plugin::upload.folder"> &
      Attribute.Private;
    folderPath: Attribute.String &
      Attribute.Required &
      Attribute.Private &
      Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<"plugin::upload.file", "oneToOne", "admin::user"> &
      Attribute.Private;
    updatedBy: Attribute.Relation<"plugin::upload.file", "oneToOne", "admin::user"> &
      Attribute.Private;
  };
}

export interface PluginUploadFolder extends Schema.CollectionType {
  collectionName: "upload_folders";
  info: {
    singularName: "folder";
    pluralName: "folders";
    displayName: "Folder";
  };
  pluginOptions: {
    "content-manager": {
      visible: false;
    };
    "content-type-builder": {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    pathId: Attribute.Integer & Attribute.Required & Attribute.Unique;
    parent: Attribute.Relation<"plugin::upload.folder", "manyToOne", "plugin::upload.folder">;
    children: Attribute.Relation<"plugin::upload.folder", "oneToMany", "plugin::upload.folder">;
    files: Attribute.Relation<"plugin::upload.folder", "oneToMany", "plugin::upload.file">;
    path: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<"plugin::upload.folder", "oneToOne", "admin::user"> &
      Attribute.Private;
    updatedBy: Attribute.Relation<"plugin::upload.folder", "oneToOne", "admin::user"> &
      Attribute.Private;
  };
}

export interface PluginContentReleasesRelease extends Schema.CollectionType {
  collectionName: "strapi_releases";
  info: {
    singularName: "release";
    pluralName: "releases";
    displayName: "Release";
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    "content-manager": {
      visible: false;
    };
    "content-type-builder": {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String & Attribute.Required;
    releasedAt: Attribute.DateTime;
    scheduledAt: Attribute.DateTime;
    timezone: Attribute.String;
    status: Attribute.Enumeration<["ready", "blocked", "failed", "done", "empty"]> &
      Attribute.Required;
    actions: Attribute.Relation<
      "plugin::content-releases.release",
      "oneToMany",
      "plugin::content-releases.release-action"
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<"plugin::content-releases.release", "oneToOne", "admin::user"> &
      Attribute.Private;
    updatedBy: Attribute.Relation<"plugin::content-releases.release", "oneToOne", "admin::user"> &
      Attribute.Private;
  };
}

export interface PluginContentReleasesReleaseAction extends Schema.CollectionType {
  collectionName: "strapi_release_actions";
  info: {
    singularName: "release-action";
    pluralName: "release-actions";
    displayName: "Release Action";
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    "content-manager": {
      visible: false;
    };
    "content-type-builder": {
      visible: false;
    };
  };
  attributes: {
    type: Attribute.Enumeration<["publish", "unpublish"]> & Attribute.Required;
    entry: Attribute.Relation<"plugin::content-releases.release-action", "morphToOne">;
    contentType: Attribute.String & Attribute.Required;
    locale: Attribute.String;
    release: Attribute.Relation<
      "plugin::content-releases.release-action",
      "manyToOne",
      "plugin::content-releases.release"
    >;
    isEntryValid: Attribute.Boolean;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      "plugin::content-releases.release-action",
      "oneToOne",
      "admin::user"
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      "plugin::content-releases.release-action",
      "oneToOne",
      "admin::user"
    > &
      Attribute.Private;
  };
}

export interface PluginUsersPermissionsPermission extends Schema.CollectionType {
  collectionName: "up_permissions";
  info: {
    name: "permission";
    description: "";
    singularName: "permission";
    pluralName: "permissions";
    displayName: "Permission";
  };
  pluginOptions: {
    "content-manager": {
      visible: false;
    };
    "content-type-builder": {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String & Attribute.Required;
    role: Attribute.Relation<
      "plugin::users-permissions.permission",
      "manyToOne",
      "plugin::users-permissions.role"
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      "plugin::users-permissions.permission",
      "oneToOne",
      "admin::user"
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      "plugin::users-permissions.permission",
      "oneToOne",
      "admin::user"
    > &
      Attribute.Private;
  };
}

export interface PluginUsersPermissionsRole extends Schema.CollectionType {
  collectionName: "up_roles";
  info: {
    name: "role";
    description: "";
    singularName: "role";
    pluralName: "roles";
    displayName: "Role";
  };
  pluginOptions: {
    "content-manager": {
      visible: false;
    };
    "content-type-builder": {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
    description: Attribute.String;
    type: Attribute.String & Attribute.Unique;
    permissions: Attribute.Relation<
      "plugin::users-permissions.role",
      "oneToMany",
      "plugin::users-permissions.permission"
    >;
    users: Attribute.Relation<
      "plugin::users-permissions.role",
      "oneToMany",
      "plugin::users-permissions.user"
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<"plugin::users-permissions.role", "oneToOne", "admin::user"> &
      Attribute.Private;
    updatedBy: Attribute.Relation<"plugin::users-permissions.role", "oneToOne", "admin::user"> &
      Attribute.Private;
  };
}

export interface PluginUsersPermissionsUser extends Schema.CollectionType {
  collectionName: "up_users";
  info: {
    name: "user";
    description: "";
    singularName: "user";
    pluralName: "users";
    displayName: "User";
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    username: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
    email: Attribute.Email &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    provider: Attribute.String;
    password: Attribute.Password &
      Attribute.Private &
      Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    resetPasswordToken: Attribute.String & Attribute.Private;
    confirmationToken: Attribute.String & Attribute.Private;
    confirmed: Attribute.Boolean & Attribute.DefaultTo<false>;
    blocked: Attribute.Boolean & Attribute.DefaultTo<false>;
    role: Attribute.Relation<
      "plugin::users-permissions.user",
      "manyToOne",
      "plugin::users-permissions.role"
    >;
    hasAcceptedTerms: Attribute.Boolean & Attribute.Required & Attribute.DefaultTo<false>;
    pacLink: Attribute.String;
    firstPacStatus: Attribute.Enumeration<["READY", "DONE", "WAITING", "INVALID", "UNAVAILABLE"]> &
      Attribute.DefaultTo<"READY">;
    finalPacStatus: Attribute.Enumeration<["READY", "DONE", "WAITING", "INVALID", "UNAVAILABLE"]> &
      Attribute.DefaultTo<"UNAVAILABLE">;
    additionalData: Attribute.Relation<
      "plugin::users-permissions.user",
      "oneToOne",
      "api::additional-data.additional-data"
    >;
    name: Attribute.String;
    userProgress: Attribute.Relation<
      "plugin::users-permissions.user",
      "oneToOne",
      "api::user-progress.user-progress"
    >;
    isAdmin: Attribute.Boolean & Attribute.DefaultTo<false>;
    groups: Attribute.Relation<"plugin::users-permissions.user", "manyToMany", "api::group.group">;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<"plugin::users-permissions.user", "oneToOne", "admin::user"> &
      Attribute.Private;
    updatedBy: Attribute.Relation<"plugin::users-permissions.user", "oneToOne", "admin::user"> &
      Attribute.Private;
  };
}

export interface PluginI18NLocale extends Schema.CollectionType {
  collectionName: "i18n_locale";
  info: {
    singularName: "locale";
    pluralName: "locales";
    collectionName: "locales";
    displayName: "Locale";
    description: "";
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    "content-manager": {
      visible: false;
    };
    "content-type-builder": {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.SetMinMax<
        {
          min: 1;
          max: 50;
        },
        number
      >;
    code: Attribute.String & Attribute.Unique;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<"plugin::i18n.locale", "oneToOne", "admin::user"> &
      Attribute.Private;
    updatedBy: Attribute.Relation<"plugin::i18n.locale", "oneToOne", "admin::user"> &
      Attribute.Private;
  };
}

export interface PluginEmailDesignerEmailTemplate extends Schema.CollectionType {
  collectionName: "email_templates";
  info: {
    singularName: "email-template";
    pluralName: "email-templates";
    displayName: "Email-template";
    name: "email-template";
  };
  options: {
    draftAndPublish: false;
    timestamps: true;
    increments: true;
    comment: "";
  };
  pluginOptions: {
    "content-manager": {
      visible: false;
    };
    "content-type-builder": {
      visible: false;
    };
  };
  attributes: {
    templateReferenceId: Attribute.Integer & Attribute.Unique;
    design: Attribute.JSON;
    name: Attribute.String;
    subject: Attribute.String;
    bodyHtml: Attribute.Text;
    bodyText: Attribute.Text;
    enabled: Attribute.Boolean & Attribute.DefaultTo<true>;
    tags: Attribute.JSON;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      "plugin::email-designer.email-template",
      "oneToOne",
      "admin::user"
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      "plugin::email-designer.email-template",
      "oneToOne",
      "admin::user"
    > &
      Attribute.Private;
  };
}

export interface ApiAdditionalDataAdditionalData extends Schema.CollectionType {
  collectionName: "additional_datas";
  info: {
    singularName: "additional-data";
    pluralName: "additional-datas";
    displayName: "Dados Adicionais";
    description: "";
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    name: Attribute.String;
    birthDate: Attribute.String;
    isMusician: Attribute.Boolean;
    musicianType: Attribute.String;
    musicianRole: Attribute.String;
    musicianTime: Attribute.String;
    job: Attribute.String;
    workUniversity: Attribute.String;
    university: Attribute.String;
    courseLevel: Attribute.String;
    voiceAreaDisciplines: Attribute.Boolean;
    graduationPeriod: Attribute.String;
    hasExperienceInAuditoryPerceptualAssessment: Attribute.Boolean;
    auditoryPerceptualAssessmentTime: Attribute.String;
    isVoiceSpecialist: Attribute.Boolean;
    auditoryPerceptualAssessmentExperience: Attribute.String;
    isAuditoryPerceptualAssessmentTrained: Attribute.Boolean;
    hasMasterDegree: Attribute.Boolean;
    hasDoctorateDegree: Attribute.Boolean;
    hasResearchExperience: Attribute.Boolean;
    hasAcademicArticle: Attribute.Boolean;
    hearing: Attribute.String;
    laterality: Attribute.String;
    learningComplaints: Attribute.Boolean;
    phone: Attribute.String;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      "api::additional-data.additional-data",
      "oneToOne",
      "admin::user"
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      "api::additional-data.additional-data",
      "oneToOne",
      "admin::user"
    > &
      Attribute.Private;
  };
}

export interface ApiEmailQueueEmailQueue extends Schema.CollectionType {
  collectionName: "emails_queue";
  info: {
    singularName: "email-queue";
    pluralName: "emails-queue";
    displayName: "Fila de Emails";
    description: "";
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    scheduledTime: Attribute.DateTime & Attribute.Required;
    templateReferenceId: Attribute.Integer & Attribute.Required;
    data: Attribute.JSON;
    to: Attribute.String & Attribute.Required;
    isStale: Attribute.Boolean & Attribute.Required & Attribute.DefaultTo<false>;
    userProgress: Attribute.Relation<
      "api::email-queue.email-queue",
      "oneToOne",
      "api::user-progress.user-progress"
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<"api::email-queue.email-queue", "oneToOne", "admin::user"> &
      Attribute.Private;
    updatedBy: Attribute.Relation<"api::email-queue.email-queue", "oneToOne", "admin::user"> &
      Attribute.Private;
  };
}

export interface ApiGroupGroup extends Schema.CollectionType {
  collectionName: "groups";
  info: {
    singularName: "group";
    pluralName: "groups";
    displayName: "Turma";
    description: "";
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    program: Attribute.Relation<"api::group.group", "oneToOne", "api::program.program">;
    students: Attribute.Relation<
      "api::group.group",
      "manyToMany",
      "plugin::users-permissions.user"
    >;
    teacher: Attribute.Relation<"api::group.group", "oneToOne", "plugin::users-permissions.user">;
    name: Attribute.String & Attribute.Required & Attribute.DefaultTo<"Sem nome">;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<"api::group.group", "oneToOne", "admin::user"> &
      Attribute.Private;
    updatedBy: Attribute.Relation<"api::group.group", "oneToOne", "admin::user"> &
      Attribute.Private;
  };
}

export interface ApiProgramProgram extends Schema.CollectionType {
  collectionName: "programs";
  info: {
    singularName: "program";
    pluralName: "programs";
    displayName: "Programa";
    description: "";
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    assessment: Attribute.Component<"general.audio", true> &
      Attribute.Required &
      Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    training: Attribute.Component<"general.audio", true> &
      Attribute.Required &
      Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    roughnessAnchor: Attribute.Component<"general.audio", true>;
    breathinessAnchor: Attribute.Component<"general.audio", true>;
    numberOfSessions: Attribute.Integer & Attribute.Required & Attribute.DefaultTo<6>;
    sessionsThreshold: Attribute.JSON &
      Attribute.CustomField<
        "plugin::multi-select.multi-select",
        ["70", "75", "80", "85", "90", "95", "100"]
      >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<"api::program.program", "oneToOne", "admin::user"> &
      Attribute.Private;
    updatedBy: Attribute.Relation<"api::program.program", "oneToOne", "admin::user"> &
      Attribute.Private;
  };
}

export interface ApiUserProgressUserProgress extends Schema.CollectionType {
  collectionName: "users_progress";
  info: {
    singularName: "user-progress";
    pluralName: "users-progress";
    displayName: "Progresso do Usu\u00E1rio";
    description: "";
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    program: Attribute.Relation<
      "api::user-progress.user-progress",
      "oneToOne",
      "api::program.program"
    >;
    sessions: Attribute.Relation<
      "api::user-progress.user-progress",
      "oneToMany",
      "api::user-session-progress.user-session-progress"
    >;
    status: Attribute.Enumeration<["READY", "WAITING", "DONE", "INVALID"]> &
      Attribute.Required &
      Attribute.DefaultTo<"READY">;
    nextDueDate: Attribute.DateTime;
    timeoutEndDate: Attribute.DateTime;
    user: Attribute.Relation<
      "api::user-progress.user-progress",
      "oneToOne",
      "plugin::users-permissions.user"
    >;
    favoriteFeature: Attribute.String;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<"api::user-progress.user-progress", "oneToOne", "admin::user"> &
      Attribute.Private;
    updatedBy: Attribute.Relation<"api::user-progress.user-progress", "oneToOne", "admin::user"> &
      Attribute.Private;
  };
}

export interface ApiUserSessionProgressUserSessionProgress extends Schema.CollectionType {
  collectionName: "user_sessions_progress";
  info: {
    singularName: "user-session-progress";
    pluralName: "user-sessions-progress";
    displayName: "Progresso na Sess\u00E3o";
    description: "";
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    assessmentStatus: Attribute.Enumeration<["NOT_NEEDED", "WAITING", "READY", "DONE", "INVALID"]> &
      Attribute.Required &
      Attribute.DefaultTo<"NOT_NEEDED">;
    trainingRoughnessStatus: Attribute.Enumeration<
      ["NOT_NEEDED", "WAITING", "READY", "DONE", "INVALID"]
    > &
      Attribute.Required &
      Attribute.DefaultTo<"WAITING">;
    trainingBreathinessStatus: Attribute.Enumeration<
      ["NOT_NEEDED", "WAITING", "READY", "DONE", "INVALID"]
    > &
      Attribute.Required &
      Attribute.DefaultTo<"WAITING">;
    assessmentRoughnessResults: Attribute.Component<"general.resultados">;
    assessmentBreathinessResults: Attribute.Component<"general.resultados">;
    trainingRoughnessResults: Attribute.Component<"general.resultados">;
    trainingBreathinessResults: Attribute.Component<"general.resultados">;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      "api::user-session-progress.user-session-progress",
      "oneToOne",
      "admin::user"
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      "api::user-session-progress.user-session-progress",
      "oneToOne",
      "admin::user"
    > &
      Attribute.Private;
  };
}

declare module "@strapi/types" {
  export module Shared {
    export interface ContentTypes {
      "admin::permission": AdminPermission;
      "admin::user": AdminUser;
      "admin::role": AdminRole;
      "admin::api-token": AdminApiToken;
      "admin::api-token-permission": AdminApiTokenPermission;
      "admin::transfer-token": AdminTransferToken;
      "admin::transfer-token-permission": AdminTransferTokenPermission;
      "plugin::upload.file": PluginUploadFile;
      "plugin::upload.folder": PluginUploadFolder;
      "plugin::content-releases.release": PluginContentReleasesRelease;
      "plugin::content-releases.release-action": PluginContentReleasesReleaseAction;
      "plugin::users-permissions.permission": PluginUsersPermissionsPermission;
      "plugin::users-permissions.role": PluginUsersPermissionsRole;
      "plugin::users-permissions.user": PluginUsersPermissionsUser;
      "plugin::i18n.locale": PluginI18NLocale;
      "plugin::email-designer.email-template": PluginEmailDesignerEmailTemplate;
      "api::additional-data.additional-data": ApiAdditionalDataAdditionalData;
      "api::email-queue.email-queue": ApiEmailQueueEmailQueue;
      "api::group.group": ApiGroupGroup;
      "api::program.program": ApiProgramProgram;
      "api::user-progress.user-progress": ApiUserProgressUserProgress;
      "api::user-session-progress.user-session-progress": ApiUserSessionProgressUserSessionProgress;
    }
  }
}
