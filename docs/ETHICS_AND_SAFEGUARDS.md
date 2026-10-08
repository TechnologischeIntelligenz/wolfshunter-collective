# WOLFSHUNTER COLLECTIVE ethics and safeguards

## Product promise

Collective is designed for transparent commerce: every participant sees the
relevant price, fee, margin, status, data source, and decision reason. The
system must preserve agreed payouts and must never redirect, withhold, or
misappropriate money outside a confirmed merchant or partner agreement.

## What AI may do

- summarize verified catalog, order, fulfillment, and diagnostic evidence;
- identify a possible deadline, stock, mapping, or service-level risk;
- suggest the least-invasive next step and show uncertainty;
- prepare a reversible, approval-gated action for a human operator or merchant;
- propose a temporary protection when a partner's contractual breach is
  evidenced and a pre-approved policy explicitly permits that protection.

## What AI may not do alone

- declare a person or company a fraudster;
- ban, blacklist, withhold money, change a payout, or terminate a partner;
- decide a return, refund, chargeback, or damages claim as the final authority;
- infer risk from nationality, language, location, protected characteristics,
  or other proxy attributes;
- silently reroute a customer order or expose one merchant's data to another;
- use a Shopify credential, Cloudflare token, or model key in a support reply.

## Emergency partner protection

If a supplier or other partner demonstrably misses a contractual deadline or
cannot fulfill an agreed order, the case must contain:

1. the original agreement and deadline;
2. the order or product evidence affected;
3. the partner's response or the documented absence of one;
4. the customer-protection risk and the least-invasive remedy;
5. notification to the affected parties and an appeal/review path.

The first implementation may only create a case, notify the responsible human,
and optionally reserve a reversible fallback. It must not automatically make a
final liability, refund, ban, or payout decision.

## Audit requirements

Every proposed or executed protection must record the tenant, evidence IDs,
policy version, actor (human or AI), model/provider if applicable, timestamp,
decision, notification status, and reversal path. Records must be deletable or
redactable under Shopify's compliance requests.

This is an engineering control document, not legal advice. The final
merchant-facing policy and dispute terms require legal review before public
launch.
