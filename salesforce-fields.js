/**
 * Salesforce Field API Names
 * 
 * This file contains all the Salesforce object and field API names used in the application.
 * Centralizing these names makes it easier to maintain and update if field names change.
 */

// Salesforce Object API Names
const OBJECT_NAMES = {
  JOB: 'TR1__Job__c',
  OPPORTUNITY_DISCUSSED: 'TR1__Opportunity_Discussed__c'
};

// TR1__Job__c Fields
const JOB_FIELDS = {
  ID: 'Id',
  RECORD_TYPE_ID: 'RecordTypeId',
  OPPORTUNITY_DISCUSSED_Q1: 'Opportunity_Discussed_Question_1__c',
  OPPORTUNITY_DISCUSSED_Q2: 'Opportunity_Discussed_Question_2__c',
  OPPORTUNITY_DISCUSSED_Q3: 'Opportunity_Discussed_Question_3__c',
  STATUS: 'TR1__Status__c',
  CONFIDENTIAL_SEARCH: 'Confidential_Search__c',
  TODAYS_PRIORITY: 'Today_s_Priority__c',
  OPEN_DATE: 'TR1__Open_Date__c',
  DIVISION: 'TR1__Division__c',
  INDUSTRY: 'TR1__Industry__c',
  STATE_AREA: 'TR1__State_Area__c',
  REGIONAL_AREA: 'TR1__Regional_Area__c',
  CITY: 'TR1__City__c',
  COUNTRY: 'Country__c',
  POST_SALARY: 'Post_Salary__c',
  SALARY_LOW: 'TR1__Salary_Low__c',
  SALARY_HIGH: 'TR1__Salary_High__c',
  JOB_NUMBER: 'TR1__Job_Number__c',
  TYPE_OF_WORK: 'Type_of_work__c',
  SOURCING_RECRUITER: 'TR1__Sourcing_Recruiter__c',
  JOB_PUBLIC_NAME: 'Job_Public_Name__c',
  EXTERNAL_JOB_TITLE: 'TR1__External_Job_Title__c',
  CLIENT_DESCRIPTION: 'TR1__Client_Description__c',
  EXPERIENCE_REQUIREMENTS: 'TR1__Experience_Requirements__c',
  EDUCATION_REQUIREMENTS: 'TR1__Education_Requirements__c',
  RESPONSIBILITIES: 'TR1__Responsibilities__c',
  LINKEDIN_POST_URL: 'LinkedIn_Post_URL__c',
  ASAP_WEBSITE_LINK: 'ASAP_Website_Link__c',
  STANDARDIZED_JOB_DESCRIPTION: 'Standardized_Job_Description__c',
  VMS_LAST_PAYLOAD: 'TR1__VMS_Last_Payload__c'
};

// TR1__Opportunity_Discussed__c Fields
const OPPORTUNITY_DISCUSSED_FIELDS = {
  ID: 'Id',
  JOB: 'TR1__Job__c',
  INTERNAL_Q1: 'Internal_Q_1__c',
  INTERNAL_ANSWER1: 'Internal_Answer_1__c'
};

// Hardcoded Record IDs
const RECORD_IDS = {
  JOB_ID: 'a0W1R00000ABy0WUAT',
  OPPORTUNITY_DISCUSSED_ID: 'a0bPM00000SepV7YAJ'
};

// SOQL Queries
const QUERIES = {
  GET_JOB: `SELECT ${Object.values(JOB_FIELDS).join(',')} 
    FROM ${OBJECT_NAMES.JOB} 
    WHERE ${JOB_FIELDS.ID} = '${RECORD_IDS.JOB_ID}'`,
    
  GET_OPPORTUNITY_DISCUSSED: `SELECT ${OPPORTUNITY_DISCUSSED_FIELDS.ID}, 
    ${OPPORTUNITY_DISCUSSED_FIELDS.JOB}, 
    ${OPPORTUNITY_DISCUSSED_FIELDS.INTERNAL_Q1}, 
    ${OPPORTUNITY_DISCUSSED_FIELDS.INTERNAL_ANSWER1} 
    FROM ${OBJECT_NAMES.OPPORTUNITY_DISCUSSED} 
    WHERE ${OPPORTUNITY_DISCUSSED_FIELDS.ID} = '${RECORD_IDS.OPPORTUNITY_DISCUSSED_ID}'`
};

module.exports = {
  OBJECT_NAMES,
  JOB_FIELDS,
  OPPORTUNITY_DISCUSSED_FIELDS,
  RECORD_IDS,
  QUERIES
}; 