CREATE SCHEMA readmodel;

-- CATALOG
CREATE TABLE readmodel.eservice(
  id uuid,
  producer_id uuid,
  name varchar,
  description varchar,
  technology varchar,
  -- descriptors
  created_at timestamp with time zone,
  -- to do riskAnalysis
  mode varchar,
  version integer,
  PRIMARY KEY(id)
);

CREATE TABLE readmodel.descriptor(
  id uuid,
  eservice_id uuid references readmodel.eservice(id) ON DELETE CASCADE,
  version varchar,
  description varchar,
  -- interface
  -- docs
  state varchar,
  audience varchar ARRAY,
  voucher_lifespan integer,
  daily_calls_per_consumer integer,
  daily_calls_total integer,
  agreement_approval_policy varchar,
  created_at timestamp with time zone,
  server_urls varchar ARRAY,
  published_at timestamp with time zone,
  suspended_at timestamp with time zone,
  deprecated_at timestamp with time zone,
  archived_at timestamp with time zone,
  -- attributes
  PRIMARY KEY(id)
);

CREATE TABLE readmodel.descriptor_document(
  id uuid,
  descriptor_id uuid REFERENCES readmodel.descriptor(id) ON DELETE CASCADE,
  name varchar,
  content_type varchar,
  pretty_name varchar,
  path varchar,
  checksum varchar,
  upload_date timestamp with time zone,
  document_kind varchar, -- differs from model
  PRIMARY KEY(id)

);

CREATE TABLE readmodel.descriptor_attribute(
  attribute_id uuid,
  descriptor_id uuid REFERENCES readmodel.descriptor(id) ON DELETE CASCADE,
  explicit_attribute_verification boolean,
  kind varchar, -- differs from model
  group_set integer,
  PRIMARY KEY(attribute_id, descriptor_id)
);

/*
certified: [[a], [b,c], [d]]

a | certified | 1
b | certified | 2
c | certified | 2
d | certified | 3

*/
CREATE TABLE readmodel.eservice_risk_analysis(
  risk_analysis_id uuid,
  eservice_id uuid REFERENCES readmodel.eservice(id) ON DELETE CASCADE,
  name varchar,
  created_at timestamp with time zone,
  risk_analysis_form_id uuid,
  risk_analysis_form_version varchar,
  PRIMARY KEY(risk_analysis_id)
);

-- CREATE TABLE readmodel.risk_analysis_single_answer(
--   id uuid,
--   risk_analysis_form_id uuid,
--   key varchar,
--   value varchar
-- );
-- 
-- CREATE TABLE readmodel.risk_analysis_multi_answer(
--   id uuid,
--   risk_analysis_form_id uuid,
--   key varchar,
--   value varchar ARRAY
-- );



-- alternative: one table for the answers: value always array, adding a type "single/multi"
CREATE TABLE readmodel.eservice_risk_analysis_answer(
  id uuid,
  risk_analysis_form_id uuid,
  kind varchar, -- SINGLE/MULTI
  key varchar,
  value varchar ARRAY,
  PRIMARY KEY(id)
);


-- AGREEMENT
CREATE TABLE readmodel.agreement(
  id uuid,
  eservice_id uuid,
  descriptor_id uuid,
  producer_id uuid,
  consumer_id uuid,
  state varchar,
  suspended_by_consumer timestamp with time zone,
  suspended_by_producer timestamp with time zone,
  suspended_by_platform timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  consumer_notes varchar,
  rejection_reason varchar,
  suspended_at timestamp with time zone,
  submission_by uuid,
  submission_at timestamp with time zone,
  activation_by uuid,
  activation_at timestamp with time zone,
  rejection_by uuid,
  rejection_at timestamp with time zone,
  suspension_by_producer_by uuid,
  suspension_by_producer_at timestamp with time zone,
  suspension_by_consumer_by uuid,
  suspension_by_consumer_at timestamp with time zone,
  upgrade_by uuid,
  upgrade_at timestamp with time zone,
  archiving_by uuid,
  archiving_at timestamp with time zone
  );

CREATE TABLE readmodel.agreement_attribute(
  attribute_id uuid,
  agreement_id uuid,
  kind varchar
);

CREATE TABLE readmodel.agreement_consumer_document(
  id uuid,
  agreement_id uuid,
  name varchar,
  pretty_name varchar,
  content_type varchar,
  path varchar,
  created_at timestamp with time zone,
  kind varchar --consumerDoc / contract
);


-- ATTRIBUTE
CREATE TABLE readmodel.attribute(
  id uuid,
  code varchar,
  kind varchar,
  description varchar,
  origin varchar,
  name varchar,
  creation_time timestamp with time zone
);


-- PURPOSE
CREATE TABLE readmodel.purpose(
  id uuid,
  eserviceId uuid,
  consumerId uuid,
  -- versions
  suspended_by_consumer boolean,
  suspende_by_producer boolean,
  title varchar,
  description varchar,
  -- riskAnalysisForm TODO
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  is_free_of_charge boolean,
  free_of_charge_reason boolean
);


CREATE TABLE readmodel.purpose_version(
  id uuid,
  state varchar,
  risk_analysis_id_ uuid,
  risk_analysis_content_type varchar,
  risk_analysis_path varchar,
  risk_analysis_created_at timestamp with time zone,
  daily_calls integer,
  rejection_reason varchar,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  first_activation_at timestamp with time zone,
  suspended_at timestamp with time zone
)
