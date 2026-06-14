/*
 * Selectors + URLs for the Amazon Subscribe & Save cancel flow.
 * Captured from a real Playwright recorder run (see docs/.../*-design.md).
 * If Amazon changes its markup, this is the only file that should need edits.
 */
window.SNS_SELECTORS = {
  // The canonical subscription list page we always loop back to.
  listUrl:
    'https://www.amazon.com/auto-deliveries/subscriptionList?ref_=sns_discover_m_d_nav_mys',

  // How we recognize we're on the list page (path prefix, ref param can vary).
  listPathPrefix: '/auto-deliveries/subscriptionList',

  // Step 1: the per-subscription "Edit" button. First match = first subscription.
  // Its aria-label is "Edit, <product name>".
  editButton: 'input.a-button-input[aria-label^="Edit,"]',

  // Step 2: the "Cancel subscription" item revealed (via AJAX) after clicking Edit.
  cancelMenuItem:
    'a.actionLink.t-action-type-CANCEL, #sub-action-items a[data-csa-c-content-id="edit-subscription-action-CANCEL"]',

  // Step 3: the confirm button in the slide-over that appears ~2s later.
  confirmButton:
    'input[data-csa-c-content-id="confirm-cancel"], #confirmCancelLink input'
};
