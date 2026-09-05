CREATE FUNCTION product_private.product_phase3_relationship_types(
  p_family_key text, p_subtype_key text
) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT '{"TERMINATION:MUTUAL_CONSENT":["QUALIFIES"],"TERMINATION:OUTSIDE_DATE":["QUALIFIES","EXCEPTS","EXTENDS"],"TERMINATION:VOTE_FAILURE":["QUALIFIES","EXCEPTS"],"TERMINATION:BREACH":["QUALIFIES","EXCEPTS","REQUIRES"],"TERMINATION:LEGAL_RESTRAINT":["QUALIFIES","EXCEPTS"],"TERMINATION:SUPERIOR_PROPOSAL":["QUALIFIES","REQUIRES","TRIGGERS"],"TERMINATION:RECOMMENDATION_CHANGE":["QUALIFIES","TRIGGERS"],"TERMINATION:NO_SOLICITATION_BREACH":["QUALIFIES","TRIGGERS"],"TERMINATION_FEE:FEE_AMOUNT":["DEFINED_BY"],"TERMINATION_FEE:FEE_TRIGGER":["TRIGGERS","REQUIRES","QUALIFIES"],"TERMINATION_FEE:TAIL_PERIOD":["QUALIFIES","TRIGGERS"],"TERMINATION_FEE:EXPENSE_REIMBURSEMENT":["QUALIFIES","ALTERNATIVE_TO"],"TERMINATION_FEE:LATE_INTEREST":["QUALIFIES"],"NO_SHOP:PROHIBITED_ACTION":["QUALIFIES"],"NO_SHOP:EXCEPTION_PREREQUISITE":["EXCEPTS","REQUIRES"],"NO_SHOP:NOTICE_PERIOD":["TRIGGERS","QUALIFIES"],"NO_SHOP:INITIAL_MATCH_PERIOD":["REQUIRES","QUALIFIES"],"NO_SHOP:SUBSEQUENT_MATCH_PERIOD":["REQUIRES","QUALIFIES"],"NO_SHOP:RECOMMENDATION_CHANGE":["EXCEPTS","REQUIRES"],"EMPLOYEE_MATTERS:EMPLOYEE_COMPENSATION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"EMPLOYEE_MATTERS:SERVICE_CREDIT":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"EMPLOYEE_MATTERS:WELFARE_RELIEF":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"EMPLOYEE_MATTERS:RETIREMENT_PLAN_ACTION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"GENERAL_COVENANTS:ACCESS":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"GENERAL_COVENANTS:LITIGATION_NOTIFICATION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"GENERAL_COVENANTS:GENERAL_NOTIFICATION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"GENERAL_COVENANTS:SECTION_16":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"GENERAL_COVENANTS:DELISTING":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"GENERAL_COVENANTS:TAKEOVER_LAW":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"GENERAL_COVENANTS:MERGER_SUB_OBLIGATION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"GENERAL_COVENANTS:PUBLICITY":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"GENERAL_COVENANTS:RESIGNATION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"GENERAL_COVENANTS:CVR":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"GENERAL_COVENANTS:LISTING":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"CLOSING_CONDITIONS:STOCKHOLDER_APPROVAL":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"CLOSING_CONDITIONS:REGULATORY_APPROVAL":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"CLOSING_CONDITIONS:LEGAL_RESTRAINT":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"CLOSING_CONDITIONS:S4_EFFECTIVENESS":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"CLOSING_CONDITIONS:BRINGDOWN":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"CLOSING_CONDITIONS:OFFICER_CERTIFICATE":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"CLOSING_CONDITIONS:FRUSTRATION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"CLOSING_CONDITIONS:TAX_OPINION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"MAE_DEFINITION:DEFINITION_INSTANCE":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"MAE_DEFINITION:DEFINITION_PRONG":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"MAE_DEFINITION:EXCLUSION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"MAE_DEFINITION:DISPROPORTIONALITY_CARVEBACK":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"MAE_DEFINITION:UNDERLYING_CAUSE_RESTORATION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"KEY_DEFINED_TERMS:ACQUISITION_PROPOSAL":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"KEY_DEFINED_TERMS:SUPERIOR_PROPOSAL":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"KEY_DEFINED_TERMS:INTERVENING_EVENT":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"KEY_DEFINED_TERMS:KNOWLEDGE":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"KEY_DEFINED_TERMS:WILLFUL_BREACH":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"REPRESENTATIONS:STATUS_REPRESENTATION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"REPRESENTATIONS:COMPLIANCE_REPRESENTATION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"REPRESENTATIONS:DOCUMENT_REPRESENTATION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"REPRESENTATIONS:CONTRACT_REPRESENTATION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"REPRESENTATIONS:FINANCIAL_REPRESENTATION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"REPRESENTATIONS:NEGATIVE_REPRESENTATION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"INTERIM_OPERATING:RESTRICTIVE_COVENANT":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"INTERIM_OPERATING:AFFIRMATIVE_COVENANT":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"INTERIM_OPERATING:CONSENT_STANDARD":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"INTERIM_OPERATING:THRESHOLD":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"INTERIM_OPERATING:EXCEPTION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"DNO_INDEMNIFICATION:INDEMNIFICATION_AND_EXCULPATION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"DNO_INDEMNIFICATION:EXPENSE_ADVANCEMENT":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"DNO_INDEMNIFICATION:CHARTER_AND_CONTRACT_CONTINUATION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"DNO_INDEMNIFICATION:DNO_INSURANCE_TAIL":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"DNO_INDEMNIFICATION:CLAIMS_PROCEDURE":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"DNO_INDEMNIFICATION:SUCCESSOR_ASSUMPTION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"DNO_INDEMNIFICATION:THIRD_PARTY_ENFORCEMENT":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"NO_OTHER_REPS_FRAUD:NO_OTHER_REPRESENTATIONS_DISCLAIMER":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"NO_OTHER_REPS_FRAUD:NON_RELIANCE_ACKNOWLEDGMENT":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"NO_OTHER_REPS_FRAUD:FRAUD_CARVEOUT":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"NO_OTHER_REPS_FRAUD:INDEPENDENT_INVESTIGATION_ACKNOWLEDGMENT":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"ANTITRUST_REGULATORY:EFFORTS":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"ANTITRUST_REGULATORY:FILING_OBLIGATION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"ANTITRUST_REGULATORY:FILING_DEADLINE":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"ANTITRUST_REGULATORY:BURDEN":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"ANTITRUST_REGULATORY:LITIGATION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"ANTITRUST_REGULATORY:TIMING_AGREEMENT":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"ANTITRUST_REGULATORY:STRATEGY_CONTROL":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"ANTITRUST_REGULATORY:CONSULTATION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"ANTITRUST_REGULATORY:COOPERATION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"ANTITRUST_REGULATORY:INFORMATION_SHARING":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"ANTITRUST_REGULATORY:NON_IMPEDIMENT":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"ANTITRUST_REGULATORY:REGULATORY_REQUEST_RESPONSE":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"APPRAISAL_DISSENTERS_RIGHTS:APPRAISAL_STATUS":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"APPRAISAL_DISSENTERS_RIGHTS:APPRAISAL_ENTITLEMENT":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"APPRAISAL_DISSENTERS_RIGHTS:WITHDRAWAL_RECONVERSION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"APPRAISAL_DISSENTERS_RIGHTS:APPRAISAL_NOTICE":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"APPRAISAL_DISSENTERS_RIGHTS:NEGOTIATION_CONTROL":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"APPRAISAL_DISSENTERS_RIGHTS:SETTLEMENT_CONSENT":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"CAPITALISATION:AUTHORISED_CAPITAL":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"CAPITALISATION:ISSUED_AND_OUTSTANDING":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"CAPITALISATION:RESERVED_OR_ISSUABLE_SECURITIES":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"CAPITALISATION:EQUITY_AWARD_INVENTORY":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"CAPITALISATION:PARTNERSHIP_OR_SUBSIDIARY_EQUITY":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"CAPITALISATION:CAPITALISATION_ABSENCE":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"CAPITALISATION:VALID_ISSUANCE_STATUS":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"CONSIDERATION:CONSIDERATION_PACKAGE":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"CONSIDERATION:CASH_COMPONENT":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"CONSIDERATION:STOCK_COMPONENT":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"CONSIDERATION:CVR_COMPONENT":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"CONSIDERATION:ELECTION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"CONSIDERATION:APPRAISAL_LINK":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"CONSIDERATION:EXCLUSION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"CONSIDERATION:EQUITY_AWARD":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"CONSIDERATION:WITHHOLDING":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"CONSIDERATION:EXCHANGE_MECHANICS":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"DIVIDENDS:DIVIDEND_COORDINATION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"DIVIDENDS:PERMITTED_PRE_CLOSING_DISTRIBUTION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"DIVIDENDS:UNPAID_DECLARED_DISTRIBUTION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"DIVIDENDS:CONSIDERATION_ADJUSTMENT_LINK":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"DIVIDENDS:INTERIM_RESTRICTION_LINK":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"FINANCING_COVENANTS:OBTAIN_FINANCING":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"FINANCING_COVENANTS:ALTERNATIVE_FINANCING":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"FINANCING_COVENANTS:TARGET_COOPERATION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"FINANCING_COVENANTS:PAYOFF":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"FINANCING_COVENANTS:NO_FINANCING_CONDITION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"FINANCING_COVENANTS:NOTE_OFFER_OR_CONSENT":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"FINANCING_COVENANTS:COST_AND_RISK_ALLOCATION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"GUARANTY_FINANCING_PARTY:PERFORMANCE_GUARANTY":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"GUARANTY_FINANCING_PARTY:LIMITED_GUARANTY_DELIVERY_OR_STATUS_REP":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"GUARANTY_FINANCING_PARTY:GUARANTY_NO_DEFAULT_REP":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"GUARANTY_FINANCING_PARTY:FINANCING_SOURCE_PROTECTION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"MATERIAL_CONTRACTS:MATERIAL_CONTRACT_CATEGORY_CRITERION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"MATERIAL_CONTRACTS:MATERIAL_CONTRACT_DISCLOSURE_LIST":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"MATERIAL_CONTRACTS:MATERIAL_CONTRACT_STATUS_REPRESENTATION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"MATERIAL_CONTRACTS:MATERIAL_CONTRACT_BREACH_TERMINATION_RIGHT":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"MERGER_STRUCTURE_CLOSING:TRANSACTION_STEP":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"MERGER_STRUCTURE_CLOSING:TRANSACTION_PLAN":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"MERGER_STRUCTURE_CLOSING:CLOSING":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"MERGER_STRUCTURE_CLOSING:EFFECTIVE_TIME":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"MERGER_STRUCTURE_CLOSING:LEGAL_EFFECT":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"MERGER_STRUCTURE_CLOSING:GOVERNANCE_SUCCESSION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"MERGER_STRUCTURE_CLOSING:ORGANISATIONAL_DOCUMENT":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"MERGER_STRUCTURE_CLOSING:BOARD_DESIGNATION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"MISC_BOILERPLATE:GOVERNING_LAW":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"MISC_BOILERPLATE:FORUM":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"MISC_BOILERPLATE:ASSIGNMENT":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"MISC_BOILERPLATE:AMENDMENT_WAIVER":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"MISC_BOILERPLATE:NOTICE":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"MISC_BOILERPLATE:ENTIRE_AGREEMENT":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"MISC_BOILERPLATE:THIRD_PARTY_BENEFICIARY":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"MISC_BOILERPLATE:SEVERABILITY":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"MISC_BOILERPLATE:COUNTERPARTS":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"MISC_BOILERPLATE:SURVIVAL":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"MISC_BOILERPLATE:CONSTRUCTION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"MISC_BOILERPLATE:EXPENSES":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"PROXY_MEETING:DOCUMENT_FILING":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"PROXY_MEETING:MEETING_CALL_OR_HOLD":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"PROXY_MEETING:RECORD_DATE_OR_BROKER_SEARCH":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"PROXY_MEETING:RECOMMENDATION_INCLUSION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"PROXY_MEETING:ADJOURNMENT":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"PROXY_MEETING:SUBSIDIARY_APPROVAL":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"SPECIFIC_PERFORMANCE_REMEDIES:GENERAL_EQUITABLE_RELIEF":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"SPECIFIC_PERFORMANCE_REMEDIES:CLOSING_ENFORCEMENT":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"SPECIFIC_PERFORMANCE_REMEDIES:NON_OBJECTION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"SPECIFIC_PERFORMANCE_REMEDIES:BOND_SECURITY_WAIVER":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"SPECIFIC_PERFORMANCE_REMEDIES:REMEDY_COORDINATION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"SPECIFIC_PERFORMANCE_REMEDIES:REMEDY_ACTION_EXTENSION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"SPECIFIC_PERFORMANCE_REMEDIES:COST_SHIFT":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"TAX_MATTERS:INTENDED_TAX_TREATMENT":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"TAX_MATTERS:TAX_TREATMENT_PROTECTION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"TAX_MATTERS:TAX_REPORTING_CONSISTENCY":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"TAX_MATTERS:TAX_OPINION_COOPERATION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"TAX_MATTERS:TRANSFER_TAX_ALLOCATION":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"TAX_MATTERS:WITHHOLDING_MECHANIC":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"TAX_MATTERS:FIRPTA_CERTIFICATE":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"],"TAX_MATTERS:TAX_INTEGRATION_OR_SPECIAL_MECHANIC":["QUALIFIES","EXCEPTS","TRIGGERS","DEFINED_BY","ALTERNATIVE_TO","EXTENDS","REQUIRES"]}'::jsonb -> (p_family_key || ':' || p_subtype_key)
$$;

REVOKE ALL ON FUNCTION product_private.product_phase3_relationship_types(text, text)
  FROM PUBLIC, anon, authenticated, service_role;

ALTER FUNCTION product_private.product_phase3_validate_review(uuid, jsonb, boolean)
  RENAME TO product_phase3_validate_review_before_relationship_review;

CREATE FUNCTION product_private.product_phase3_validate_review(
  p_run_id uuid, p_state jsonb, p_for_publish boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE legacy_state jsonb;
DECLARE legacy_relationships jsonb;
BEGIN
  IF pg_catalog.jsonb_typeof(p_state->'items') IS DISTINCT FROM 'array' THEN
    PERFORM product_private.product_phase3_validate_review_before_relationship_review(
      p_run_id, p_state, p_for_publish
    );
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_state->'items') item
    WHERE (
        item->>'kind' IN ('EXCEPTION_LINK', 'RELATIONSHIP', 'USER_RELATIONSHIP')
        AND (
          coalesce(pg_catalog.jsonb_typeof(item->'original'), '') <> 'object'
          OR (
            item->'edited_relationship' IS NOT NULL
            AND item->'edited_relationship' <> 'null'::jsonb
            AND pg_catalog.jsonb_typeof(item->'edited_relationship') <> 'object'
          )
        )
      )
      OR (
        coalesce(item->>'kind', '') NOT IN (
          'EXCEPTION_LINK', 'RELATIONSHIP', 'USER_RELATIONSHIP'
        )
        AND (
          item ? 'edited_relationship'
          OR item->'original'->>'schema_version' IN (
            'PRODUCT_FACT_LINK/V1', 'PRODUCT_USER_RELATIONSHIP/V1'
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'invalid relationship review item' USING ERRCODE = '22023';
  END IF;

  IF (SELECT count(*) FROM pg_catalog.jsonb_array_elements(p_state->'items')) <>
      (SELECT count(DISTINCT item->>'item_id')
        FROM pg_catalog.jsonb_array_elements(p_state->'items') item)
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(p_state->'items') item
      WHERE item->>'kind' IN ('EXCEPTION_LINK', 'RELATIONSHIP', 'USER_RELATIONSHIP')
        AND (
          item->>'schema_version' IS DISTINCT FROM 'PRODUCT_REVIEW_ITEM/V1'
          OR coalesce(item->>'decision', '') NOT IN (
            'PENDING', 'ACCEPTED', 'EDITED', 'REJECTED', 'UNRESOLVED'
          )
          OR item->>'item_id' IS DISTINCT FROM pg_catalog.encode(extensions.digest(
            pg_catalog.convert_to((item->>'kind') || chr(31) || (item->>'source_id'), 'UTF8'),
            'sha256'::text
          ), 'hex')
          OR coalesce(pg_catalog.jsonb_typeof(item->'original'), '') <> 'object'
          OR CASE item->>'kind'
            WHEN 'EXCEPTION_LINK' THEN NOT EXISTS (
              SELECT 1 FROM public.product_fact_links link
              WHERE link.run_id = p_run_id
                AND link.fact_link_id = item->>'source_id'
                AND link.relationship_type = 'EXCEPTS'
                AND link.payload = item->'original'
            )
            WHEN 'RELATIONSHIP' THEN NOT EXISTS (
              SELECT 1 FROM public.product_fact_links link
              WHERE link.run_id = p_run_id
                AND link.fact_link_id = item->>'source_id'
                AND link.relationship_type <> 'EXCEPTS'
                AND link.payload = item->'original'
            )
            WHEN 'USER_RELATIONSHIP' THEN
              EXISTS (
                SELECT 1 FROM public.product_fact_links link
                WHERE link.run_id = p_run_id AND link.fact_link_id = item->>'source_id'
              )
              OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(item->'original')) <> 6
              OR item->'original'->>'schema_version' IS DISTINCT FROM 'PRODUCT_USER_RELATIONSHIP/V1'
              OR coalesce(pg_catalog.jsonb_typeof(item->'original'->'source_span_ids'), '') <> 'array'
              OR CASE
                WHEN pg_catalog.jsonb_typeof(item->'original'->'source_span_ids') = 'array' THEN
                  item->>'source_id' IS DISTINCT FROM pg_catalog.encode(extensions.digest(
                    pg_catalog.convert_to(
                      'PRODUCT_USER_RELATIONSHIP/V1' || chr(31) || (p_state->>'draft_analysis_id')
                      || chr(31) || (item->'original'->>'from_proposal_id')
                      || chr(31) || (item->'original'->>'to_proposal_id')
                      || chr(31) || (item->'original'->>'relationship_type')
                      || chr(31) || (item->'original'->>'source_closure_id')
                      || chr(31) || coalesce((
                        SELECT pg_catalog.string_agg(span_id, ',' ORDER BY span_id)
                        FROM pg_catalog.jsonb_array_elements_text(
                          item->'original'->'source_span_ids'
                        ) selected(span_id)
                      ), ''),
                      'UTF8'
                    ), 'sha256'::text
                  ), 'hex')
                ELSE true
              END
              OR (
                (
                  item->'edited_relationship' IS NULL
                  OR item->'edited_relationship' = 'null'::jsonb
                )
                AND (
                  item->>'source_closure_id'
                    IS DISTINCT FROM item->'original'->>'source_closure_id'
                  OR item->'source_span_ids'
                    IS DISTINCT FROM item->'original'->'source_span_ids'
                )
              )
            ELSE true
          END
          OR (
            item->'edited_relationship' IS NOT NULL
            AND item->'edited_relationship' <> 'null'::jsonb
            AND (
              pg_catalog.jsonb_typeof(item->'edited_relationship') <> 'object'
              OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(
                item->'edited_relationship'
              )) <> 5
              OR item->>'decision' = 'PENDING'
              OR item->>'source_closure_id'
                IS DISTINCT FROM item->'edited_relationship'->>'source_closure_id'
              OR item->'source_span_ids'
                IS DISTINCT FROM item->'edited_relationship'->'source_span_ids'
            )
          )
          OR (
            item->>'kind' <> 'USER_RELATIONSHIP'
            AND item->>'decision' = 'EDITED'
            AND (
              item->'edited_relationship' IS NULL
              OR item->'edited_relationship' = 'null'::jsonb
            )
          )
          OR (
            item->>'kind' IN ('EXCEPTION_LINK', 'RELATIONSHIP')
            AND (
              item->'edited_relationship' IS NULL
              OR item->'edited_relationship' = 'null'::jsonb
            )
            AND (
              p_for_publish
              OR item->>'decision' IN ('ACCEPTED', 'EDITED')
            )
            AND item->'source_span_ids'
              IS DISTINCT FROM item->'original'->'source_span_ids'
          )
        )
    ) THEN
    RAISE EXCEPTION 'invalid relationship review item' USING ERRCODE = '22023';
  END IF;

  IF p_for_publish AND EXISTS (
    SELECT 1
    FROM public.product_fact_links link
    WHERE link.run_id = p_run_id
      AND (
        SELECT count(*)
        FROM pg_catalog.jsonb_array_elements(p_state->'items') item
        WHERE item->>'source_id' = link.fact_link_id
          AND item->>'kind' = CASE WHEN link.relationship_type = 'EXCEPTS'
            THEN 'EXCEPTION_LINK' ELSE 'RELATIONSHIP' END
          AND item->'original' = link.payload
      ) <> 1
  ) THEN
    RAISE EXCEPTION 'required relationship review item is missing' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_state->'items') item
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN pg_catalog.jsonb_typeof(item->'edited_relationship') = 'object'
          THEN item->'edited_relationship'
        ELSE item->'original'
      END AS value
    ) effective
    WHERE item->>'kind' IN ('EXCEPTION_LINK', 'RELATIONSHIP', 'USER_RELATIONSHIP')
      AND item->>'decision' IN ('ACCEPTED', 'EDITED')
      AND (
        coalesce(pg_catalog.jsonb_typeof(effective.value), '') <> 'object'
        OR coalesce(effective.value->>'from_proposal_id', '') = ''
        OR coalesce(effective.value->>'to_proposal_id', '') = ''
        OR effective.value->>'from_proposal_id' = effective.value->>'to_proposal_id'
        OR coalesce(effective.value->>'relationship_type', '') NOT IN (
          'QUALIFIES', 'EXCEPTS', 'TRIGGERS', 'DEFINED_BY',
          'ALTERNATIVE_TO', 'EXTENDS', 'REQUIRES'
        )
        OR coalesce(item->>'source_closure_id', '') = ''
        OR coalesce(pg_catalog.jsonb_typeof(item->'source_span_ids'), '') <> 'array'
      )
  ) THEN
    RAISE EXCEPTION 'invalid effective relationship' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_state->'items') item
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN pg_catalog.jsonb_typeof(item->'edited_relationship') = 'object'
          THEN item->'edited_relationship'
        ELSE item->'original'
      END AS value
    ) effective
    WHERE item->>'kind' IN ('EXCEPTION_LINK', 'RELATIONSHIP', 'USER_RELATIONSHIP')
      AND item->>'decision' IN ('ACCEPTED', 'EDITED')
      AND (
        pg_catalog.jsonb_array_length(item->'source_span_ids') = 0
        OR pg_catalog.jsonb_array_length(item->'source_span_ids') <>
          (SELECT count(DISTINCT span_id)
            FROM pg_catalog.jsonb_array_elements_text(item->'source_span_ids') selected(span_id))
        OR NOT EXISTS (
          SELECT 1 FROM public.product_source_closures closure
          WHERE closure.run_id = p_run_id
            AND closure.source_closure_id = item->>'source_closure_id'
        )
        OR EXISTS (
          SELECT 1
          FROM pg_catalog.jsonb_array_elements_text(item->'source_span_ids') selected(span_id)
          WHERE NOT EXISTS (
            SELECT 1 FROM public.product_source_closure_spans closure_span
            WHERE closure_span.run_id = p_run_id
              AND closure_span.source_closure_id = item->>'source_closure_id'
              AND closure_span.span_id = selected.span_id
          )
        )
        OR (SELECT count(*)
          FROM pg_catalog.jsonb_array_elements(p_state->'items') endpoint
          WHERE endpoint->>'kind' IN ('PROPOSAL', 'USER_FACT')
            AND endpoint->>'source_id' = effective.value->>'from_proposal_id') <> 1
        OR (SELECT count(*)
          FROM pg_catalog.jsonb_array_elements(p_state->'items') endpoint
          WHERE endpoint->>'kind' IN ('PROPOSAL', 'USER_FACT')
            AND endpoint->>'source_id' = effective.value->>'to_proposal_id') <> 1
      )
  ) THEN
    RAISE EXCEPTION 'relationship endpoint or source mismatch' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_state->'items') item
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN pg_catalog.jsonb_typeof(item->'edited_relationship') = 'object'
          THEN item->'edited_relationship'
        ELSE item->'original'
      END AS value
    ) effective
    JOIN pg_catalog.jsonb_array_elements(p_state->'items') origin
      ON origin->>'kind' IN ('PROPOSAL', 'USER_FACT')
      AND origin->>'source_id' = effective.value->>'from_proposal_id'
    JOIN public.product_analysis_runs run ON run.run_id = p_run_id
    WHERE item->>'kind' IN ('EXCEPTION_LINK', 'RELATIONSHIP', 'USER_RELATIONSHIP')
      AND item->>'decision' IN ('ACCEPTED', 'EDITED')
      AND (
        run.schema_version <> 'LEGAL_SCHEMA/V1'
        OR product_private.product_phase3_relationship_types(
          origin->'original'->>'family_key',
          origin->'original'->>'subtype_key'
        ) IS NULL
        OR NOT product_private.product_phase3_relationship_types(
          origin->'original'->>'family_key',
          origin->'original'->>'subtype_key'
        ) ? (effective.value->>'relationship_type')
      )
  ) THEN
    RAISE EXCEPTION 'relationship type is not allowed by the originating fact subtype'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_state->'items') left_item
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN pg_catalog.jsonb_typeof(left_item->'edited_relationship') = 'object'
          THEN left_item->'edited_relationship'
        ELSE left_item->'original'
      END AS value
    ) left_effective
    JOIN pg_catalog.jsonb_array_elements(p_state->'items') right_item
      ON right_item->>'kind' IN ('EXCEPTION_LINK', 'RELATIONSHIP', 'USER_RELATIONSHIP')
      AND right_item->>'decision' IN ('ACCEPTED', 'EDITED')
      AND right_item->>'item_id' > left_item->>'item_id'
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN pg_catalog.jsonb_typeof(right_item->'edited_relationship') = 'object'
          THEN right_item->'edited_relationship'
        ELSE right_item->'original'
      END AS value
    ) right_effective
    WHERE left_item->>'kind' IN ('EXCEPTION_LINK', 'RELATIONSHIP', 'USER_RELATIONSHIP')
      AND left_item->>'decision' IN ('ACCEPTED', 'EDITED')
      AND left_effective.value->>'from_proposal_id'
        = right_effective.value->>'from_proposal_id'
      AND left_effective.value->>'to_proposal_id'
        = right_effective.value->>'to_proposal_id'
      AND left_effective.value->>'relationship_type'
        = right_effective.value->>'relationship_type'
      AND left_item->>'source_closure_id' = right_item->>'source_closure_id'
      AND (
        SELECT pg_catalog.jsonb_agg(span_id ORDER BY span_id)
        FROM pg_catalog.jsonb_array_elements_text(left_item->'source_span_ids') selected(span_id)
      ) = (
        SELECT pg_catalog.jsonb_agg(span_id ORDER BY span_id)
        FROM pg_catalog.jsonb_array_elements_text(right_item->'source_span_ids') selected(span_id)
      )
  ) THEN
    RAISE EXCEPTION 'duplicate effective relationship' USING ERRCODE = '22023';
  END IF;

  SELECT pg_catalog.jsonb_set(
    p_state,
    '{items}',
    coalesce(pg_catalog.jsonb_agg(
      CASE
        WHEN item->>'kind' = 'EXCEPTION_LINK'
          AND pg_catalog.jsonb_typeof(item->'edited_relationship') = 'object'
        THEN pg_catalog.jsonb_set(item, '{decision}', '"REJECTED"'::jsonb, false)
        ELSE item
      END ORDER BY ordinality
    ), '[]'::jsonb),
    false
  )
  INTO legacy_state
  FROM pg_catalog.jsonb_array_elements(p_state->'items')
    WITH ORDINALITY entries(item, ordinality)
  WHERE coalesce(item->>'kind', '') NOT IN ('RELATIONSHIP', 'USER_RELATIONSHIP');

  IF p_for_publish
    AND pg_catalog.jsonb_typeof(p_state->'summary'->'relationships') = 'array' THEN
    SELECT coalesce(pg_catalog.jsonb_agg(relationship ORDER BY ordinality), '[]'::jsonb)
    INTO legacy_relationships
    FROM pg_catalog.jsonb_array_elements(p_state->'summary'->'relationships')
      WITH ORDINALITY entries(relationship, ordinality)
    WHERE EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(p_state->'items') item
      WHERE item->>'kind' = 'EXCEPTION_LINK'
        AND item->>'decision' = 'ACCEPTED'
        AND (
          item->'edited_relationship' IS NULL
          OR item->'edited_relationship' = 'null'::jsonb
        )
        AND item->>'item_id' = relationship->>'review_item_id'
    );
    legacy_state := pg_catalog.jsonb_set(
      legacy_state, '{summary,relationships}', legacy_relationships, false
    );
  END IF;

  PERFORM product_private.product_phase3_validate_review_before_relationship_review(
    p_run_id, legacy_state, p_for_publish
  );

  IF p_for_publish THEN
    IF EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(p_state->'items') item
      WHERE item->>'kind' IN ('EXCEPTION_LINK', 'RELATIONSHIP', 'USER_RELATIONSHIP')
        AND item->>'decision' IN ('PENDING', 'UNRESOLVED')
    ) THEN
      RAISE EXCEPTION 'published relationship review is incomplete' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(p_state->'items') item
      CROSS JOIN LATERAL (
        SELECT CASE
          WHEN pg_catalog.jsonb_typeof(item->'edited_relationship') = 'object'
            THEN item->'edited_relationship'
          ELSE item->'original'
        END AS value
      ) effective
      WHERE item->>'kind' IN ('EXCEPTION_LINK', 'RELATIONSHIP', 'USER_RELATIONSHIP')
        AND item->>'decision' IN ('ACCEPTED', 'EDITED')
        AND (
          NOT EXISTS (
            SELECT 1 FROM pg_catalog.jsonb_array_elements(p_state->'items') endpoint
            WHERE endpoint->>'kind' IN ('PROPOSAL', 'USER_FACT')
              AND endpoint->>'source_id' = effective.value->>'from_proposal_id'
              AND endpoint->>'decision' IN ('ACCEPTED', 'EDITED')
          )
          OR NOT EXISTS (
            SELECT 1 FROM pg_catalog.jsonb_array_elements(p_state->'items') endpoint
            WHERE endpoint->>'kind' IN ('PROPOSAL', 'USER_FACT')
              AND endpoint->>'source_id' = effective.value->>'to_proposal_id'
              AND endpoint->>'decision' IN ('ACCEPTED', 'EDITED')
          )
        )
    ) THEN
      RAISE EXCEPTION 'published relationship endpoint is not accepted' USING ERRCODE = '22023';
    END IF;

    IF pg_catalog.jsonb_typeof(p_state->'summary'->'relationships') <> 'array'
      OR (SELECT count(*)
          FROM pg_catalog.jsonb_array_elements(p_state->'summary'->'relationships')) <>
        (SELECT count(*)
          FROM pg_catalog.jsonb_array_elements(p_state->'items') item
          WHERE item->>'kind' IN ('EXCEPTION_LINK', 'RELATIONSHIP', 'USER_RELATIONSHIP')
            AND item->>'decision' IN ('ACCEPTED', 'EDITED'))
      OR EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_array_elements(p_state->'items') item
        CROSS JOIN LATERAL (
          SELECT CASE
            WHEN pg_catalog.jsonb_typeof(item->'edited_relationship') = 'object'
              THEN item->'edited_relationship'
            ELSE item->'original'
          END AS value
        ) effective
        WHERE item->>'kind' IN ('EXCEPTION_LINK', 'RELATIONSHIP', 'USER_RELATIONSHIP')
          AND item->>'decision' IN ('ACCEPTED', 'EDITED')
          AND NOT EXISTS (
            SELECT 1
            FROM pg_catalog.jsonb_array_elements(p_state->'summary'->'relationships') relationship
            WHERE relationship = pg_catalog.jsonb_build_object(
              'review_item_id', item->>'item_id',
              'schema_version', coalesce(
                item->'original'->>'schema_version', 'PRODUCT_FACT_LINK/V1'
              ),
              'fact_link_id', coalesce(
                item->'original'->>'fact_link_id', item->>'source_id'
              ),
              'from_proposal_id', effective.value->>'from_proposal_id',
              'to_proposal_id', effective.value->>'to_proposal_id',
              'relationship_type', effective.value->>'relationship_type',
              'source_closure_id', item->>'source_closure_id',
              'source_span_ids', item->'source_span_ids'
            )
          )
      ) THEN
      RAISE EXCEPTION 'published relationship summary mismatch' USING ERRCODE = '22023';
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION product_private.product_phase3_validate_review(uuid, jsonb, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION product_private.product_phase3_validate_review_before_relationship_review(
  uuid, jsonb, boolean
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION product_private.product_phase3_validate_review(uuid, jsonb, boolean)
  TO service_role;
