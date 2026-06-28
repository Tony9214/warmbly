import authentication from './authentication';
import { includeBearerToken, handleApiErrors } from './lib/client';

import {
  campaignList,
  mailboxList,
  pipelineList,
  stageList,
  templateList,
} from './triggers/dropdowns';
import { newContact, newOrUpdatedContact } from './triggers/contacts';
import { newDeal, dealWon, newCrmTask } from './triggers/crm';
import { newMeeting } from './triggers/meetings';
import { newInboundEmail } from './triggers/inbox';
import { newCampaign, campaignCompleted } from './triggers/campaigns';
import { newMailbox } from './triggers/mailboxes';

import {
  createContact,
  updateContact,
  addContactToCampaign,
  createContactNote,
} from './creates/contacts';
import { sendEmail, replyToEmail, verifyEmail } from './creates/email';
import { createDeal, updateDeal, createCrmTask } from './creates/crm';
import { createCampaign, startCampaign, stopCampaign } from './creates/campaigns';
import { createTemplate } from './creates/templates';

import {
  findContact,
  findCampaign,
  findMailbox,
  findTemplate,
} from './searches';

// version + platformVersion are required by Zapier; read from package.json and
// the installed core. require avoids pulling package.json into the TS rootDir.
const packageJson = require('../package.json');
const corePackageJson = require('zapier-platform-core');

const triggers = [
  // Hidden list triggers powering dynamic dropdowns.
  campaignList,
  mailboxList,
  pipelineList,
  stageList,
  templateList,
  // User-facing polling triggers.
  newContact,
  newOrUpdatedContact,
  newDeal,
  dealWon,
  newCrmTask,
  newMeeting,
  newInboundEmail,
  newCampaign,
  campaignCompleted,
  newMailbox,
];

const creates = [
  createContact,
  updateContact,
  addContactToCampaign,
  createContactNote,
  sendEmail,
  replyToEmail,
  verifyEmail,
  createDeal,
  updateDeal,
  createCrmTask,
  createCampaign,
  startCampaign,
  stopCampaign,
  createTemplate,
];

const searches = [findContact, findCampaign, findMailbox, findTemplate];

const byKey = (items: Array<{ key: string }>): Record<string, any> =>
  items.reduce((acc: Record<string, any>, item) => {
    acc[item.key] = item;
    return acc;
  }, {});

export default {
  version: packageJson.version,
  platformVersion: corePackageJson.version,
  authentication,
  beforeRequest: [includeBearerToken],
  afterResponse: [handleApiErrors],
  triggers: byKey(triggers),
  creates: byKey(creates),
  searches: byKey(searches),
};
