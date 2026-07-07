const TRIGGER_CODE_ALIASES = {
  'superior proposal': 'SUPERIOR_PROPOSAL',
  'adverse recommendation change': 'BOARD_RECOMMENDATION_CHANGE',
  'board recommendation change': 'BOARD_RECOMMENDATION_CHANGE',
  'no vote': 'NAKED_NO_VOTE',
  'naked no vote': 'NAKED_NO_VOTE',
  'outside date': 'OUTSIDE_DATE_ELAPSED',
  'end date': 'OUTSIDE_DATE_ELAPSED',
  'drop dead date': 'MUTUAL_DROP_DEAD',
  'regulatory failure': 'BUYER_REG_FAILURE',
  'antitrust failure': 'BUYER_REG_FAILURE',
  'company breach': 'COMPANY_BREACH_MATERIAL',
  'buyer breach': 'BUYER_BREACH_MATERIAL',
  'legal restraint': 'LAW_ORDER_PERMANENT_ENJOIN',
  injunction: 'LAW_ORDER_PERMANENT_ENJOIN',
  'financing cooperation breach': 'COMPANY_BREACH_FINANCING_COOPERATION',
  'stockholder vote failure': 'STOCKHOLDER_VOTE_FAILED',
};

module.exports = { TRIGGER_CODE_ALIASES };
