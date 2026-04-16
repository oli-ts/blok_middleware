/**
 * @typedef {'user'|'admin'} Role
 */

/**
 * @typedef {Object} Profile
 * @property {string} id
 * @property {Role} role
 * @property {string} [full_name]
 * @property {string} [department]
 */

/**
 * @typedef {Object} Project
 * @property {string} id
 * @property {string} title
 * @property {string} [region]
 * @property {number} [value_numeric]
 * @property {string} [stage]
 * @property {string} [sector]
 * @property {number} [fm_score]
 * @property {string[]} [relevance_tags]
 * @property {string} status
 * @property {string} [source_ref]
 * @property {string} [start_date]
 */

/**
 * @typedef {Object} Contact
 * @property {string} id
 * @property {string} [first_name]
 * @property {string} [last_name]
 * @property {string} [job_title]
 * @property {string} [email]
 * @property {string} [phone]
 * @property {string[]} [phone_numbers]
 * @property {string} [linkedin_url]
 * @property {string} [company_id]
 * @property {string} [office_id]
 * @property {string} [source]
 * @property {string} [external_contact_id]
 * @property {string} [source_system]
 * @property {string} [source_ref]
 * @property {'verified'|'unverified'|'needs_review'|'duplicate'|'ready'} validation_state
 * @property {number} [confidence_score]
 * @property {string} [duplicate_state]
 * @property {string} [crm_sync_status]
 */

/**
 * @typedef {Object} Company
 * @property {string} id
 * @property {string} name
 * @property {string} [sector]
 * @property {string} [website]
 * @property {string} [crm_org_id]
 * @property {string} [external_company_id]
 * @property {string} [source_system]
 * @property {string} [source_ref]
 * @property {string} [source_last_seen_at]
 * @property {string} [description]
 * @property {string} [phone]
 * @property {number} [employee_count]
 * @property {string} [headquarters_address]
 */

/**
 * @typedef {Object} Office
 * @property {string} id
 * @property {string} company_id
 * @property {string} [name]
 * @property {string} [address]
 * @property {string} [region]
 * @property {string} [external_office_id]
 * @property {string} [source_system]
 * @property {string} [source_ref]
 * @property {string} [source_last_seen_at]
 */

/**
 * @typedef {Object} CrmPushJob
 * @property {string} id
 * @property {string} status
 * @property {string} target
 * @property {string} [summary]
 * @property {string} [started_at]
 * @property {string} [completed_at]
 */

/**
 * @typedef {Object} CrmPushJobItem
 * @property {string} id
 * @property {string} job_id
 * @property {'project'|'contact'|'company'} source_entity
 * @property {string} source_id
 * @property {'deal'|'person'|'org'} target_type
 * @property {string} status
 * @property {string} [error_message]
 */
